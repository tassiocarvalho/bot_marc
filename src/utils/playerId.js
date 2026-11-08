/**
 * Identidade única de jogador para os jogos de grupo (forca, damas, velha, jokenpô).
 *
 * No Baileys 7 a mesma pessoa pode chegar como LID (123@lid) ou como número
 * (5511...@s.whatsapp.net), dependendo do addressing_mode de cada mensagem.
 * Aqui tudo vira o LID quando ele existe, para que a comparação
 * "é a vez deste jogador?" nunca falhe nem confunda pessoas.
 *
 * @author bot_marc
 */
import { onlyNumbers } from "./index.js";

const LID_LOOKUP_TIMEOUT_MS = 3000;

/** Remove o sufixo de dispositivo (":12") e normaliza o domínio. */
export function bareJid(jid) {
  if (!jid || typeof jid !== "string" || !jid.includes("@")) return null;
  const [user, server] = jid.split("@");
  const number = user.split(":")[0];
  if (!number) return null;
  return `${number}@${server === "c.us" ? "s.whatsapp.net" : server}`;
}

const isLid = (jid) => !!jid?.endsWith("@lid");

/** Converte número de telefone em LID usando o mapeamento do Baileys (se houver). */
async function pnToLid(socket, jid) {
  const lidMapping = socket?.signalRepository?.lidMapping;
  if (!lidMapping?.getLIDForPN) return null;

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), LID_LOOKUP_TIMEOUT_MS);
  });

  try {
    const lid = await Promise.race([lidMapping.getLIDForPN(jid).catch(() => null), timeout]);
    return isLid(lid) ? bareJid(lid) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve qualquer JID (LID ou número) para o ID canônico do jogador. */
export async function resolvePlayerId(socket, jid, altJid) {
  const main = bareJid(jid);
  const alt = bareJid(altJid);

  if (isLid(main)) return main;
  if (isLid(alt)) return alt;
  if (!main) return alt;

  return (await pnToLid(socket, main)) || main;
}

/** ID canônico de quem enviou a mensagem. */
export function getSenderPlayerId(socket, webMessage) {
  const key = webMessage?.key || {};
  return resolvePlayerId(socket, key.participant, key.participantAlt);
}

function contextInfoOf(webMessage) {
  const message = webMessage?.message || {};
  for (const content of Object.values(message)) {
    if (content && typeof content === "object" && content.contextInfo) {
      return content.contextInfo;
    }
  }
  return null;
}

/**
 * ID canônico do adversário: menção real (@), depois resposta a uma mensagem,
 * depois um número digitado. Retorna null se não houver alvo.
 */
export async function getTargetPlayerId(socket, webMessage, typedArg) {
  const contextInfo = contextInfoOf(webMessage);
  const mentioned = contextInfo?.mentionedJid?.[0];

  if (mentioned) return resolvePlayerId(socket, mentioned);
  if (contextInfo?.participant && contextInfo?.quotedMessage) {
    return resolvePlayerId(socket, contextInfo.participant);
  }

  const number = typedArg?.startsWith("@") ? onlyNumbers(typedArg) : "";
  if (!number) return null;

  // Número digitado sem menção real: pode ser telefone ou o próprio LID.
  return (await pnToLid(socket, `${number}@s.whatsapp.net`)) || `${number}@lid`;
}

/** Divide os argumentos por espaço (o args padrão só separa por / | \). */
export const splitWords = (text) => (text || "").trim().split(/\s+/).filter(Boolean);
