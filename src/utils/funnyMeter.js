/**
 * Base dos "medidores" de brincadeira (/gay, /lesbica, /corno, /petista,
 * /bolsonarista): sorteia de 0 a 100%, escolhe o GIF e a frase da faixa e
 * responde marcando o alvo.
 *
 * Os números de VIP_NUMBERS recebem um resultado fixo definido em cada
 * comando (por exemplo, imune no /gay e 100% no /bolsonarista).
 *
 * @author bot_marc
 */
import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../config.js";
import { getRandomNumber, numberVariants, onlyNumbers } from "./index.js";

export const FUNNY_DIR = path.resolve(ASSETS_DIR, "images", "funny");

export const SIGMA_GIF = path.resolve(FUNNY_DIR, "sigma.mp4");

/**
 * Números com resultado fixo nos medidores. Pode escrever em qualquer
 * formato: com ou sem +55, com ou sem o nono dígito, com espaço, traço
 * ou parênteses.
 */
export const VIP_NUMBERS = [
  "+55 75 98325-8635",
  "5575983258635",
  "557583258635",
  "(75) 98325-8635",
  "75983258635",
  "7583258635",
];

const LID_LOOKUP_TIMEOUT_MS = 3000;

/** Número sem DDI (10 ou 11 dígitos) ganha o 55 na frente. */
function withCountryCode(digits) {
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

/** Todas as formas aceitas (com e sem 55, com e sem o nono dígito). */
function vipVariants() {
  return new Set(
    VIP_NUMBERS.flatMap((number) =>
      numberVariants(withCountryCode(onlyNumbers(number))),
    ),
  );
}

/** "5575...:12@s.whatsapp.net" -> "5575..." */
function jidUser(jid) {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0];
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), LID_LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([
    Promise.resolve(promise).catch(() => null),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

/**
 * Diz se o alvo é um dos VIP_NUMBERS. O WhatsApp pode identificar a
 * pessoa pelo número ou pelo LID, então checa as duas coisas: compara os
 * números direto e, para LIDs, usa o mapeamento LID <-> número do Baileys.
 */
export async function isVipTarget(socket, jids) {
  const vip = vipVariants();
  const candidates = [...new Set(jids.filter(Boolean).map(String))];

  const matchesNumber = (value) =>
    numberVariants(withCountryCode(onlyNumbers(jidUser(value)))).some((n) =>
      vip.has(n),
    );

  if (candidates.some(matchesNumber)) {
    return true;
  }

  const lidMapping = socket?.signalRepository?.lidMapping;

  if (!lidMapping) {
    return false;
  }

  const lids = candidates
    .filter((jid) => jid.endsWith("@lid"))
    .map((jid) => `${jidUser(jid)}@lid`);

  if (!lids.length) {
    return false;
  }

  for (const lid of lids) {
    const pn = await withTimeout(lidMapping.getPNForLID?.(lid));

    if (pn && matchesNumber(pn)) {
      return true;
    }
  }

  const lidUsers = new Set(lids.map(jidUser));

  for (const number of vip) {
    const lid = await withTimeout(
      lidMapping.getLIDForPN?.(`${number}@s.whatsapp.net`),
    );

    if (lid && lidUsers.has(jidUser(lid))) {
      return true;
    }
  }

  return false;
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
 * Quem vai ser medido: a pessoa respondida, a mencionada ou, sem nenhuma
 * das duas, quem mandou o comando. Devolve também todas as formas em que
 * esse alvo pode ter chegado (LID ou número), para checar os VIPs.
 */
export function getMeterTarget({
  userLid,
  replyLid,
  args,
  isReply,
  webMessage,
}) {
  const contextInfo = contextInfoOf(webMessage);
  const key = webMessage?.key || {};

  if (isReply) {
    return {
      targetLid: replyLid,
      targetJids: [replyLid, contextInfo?.participant],
    };
  }

  if (args?.[0]) {
    const targetLid = `${onlyNumbers(args[0])}@lid`;

    return {
      targetLid,
      targetJids: [targetLid, args[0], ...(contextInfo?.mentionedJid || [])],
    };
  }

  return {
    targetLid: userLid,
    targetJids: [
      userLid,
      key.participant,
      key.participantAlt,
      key.remoteJid,
      key.remoteJidAlt,
    ].filter((jid) => !String(jid || "").endsWith("@g.us")),
  };
}

/**
 * Monta um comando medidor.
 *
 * @param {object} options
 * @param {string} options.name nome do comando
 * @param {string[]} options.commands aliases
 * @param {string} options.description
 * @param {string} options.title cabeçalho da resposta, ex.: "🏳️‍🌈 *GAYMETRO* 🏳️‍🌈"
 * @param {string} options.label o que vai depois da porcentagem, ex.: "gay"
 * @param {string} options.gifsDir pasta dos GIFs das faixas
 * @param {{ max: number, gif: string, phrase: string }[]} options.levels
 *   faixas em ordem crescente; a última deve ter max 100
 * @param {{ percentage: number, gif: string, phrase: string }} options.vip
 *   resultado fixo dos VIP_NUMBERS (gif com caminho absoluto)
 */
export function createMeterCommand({
  name,
  commands,
  description,
  title,
  label,
  gifsDir,
  levels,
  vip,
}) {
  return {
    name,
    description,
    commands,
    usage: `${PREFIX}${name} @usuario`,
    /**
     * @param {CommandHandleProps} props
     */
    handle: async (props) => {
      const { sendGifFromFile, socket } = props;
      const { targetLid, targetJids } = getMeterTarget(props);
      const mention = `@${onlyNumbers(targetLid)}`;

      if (vip && (await isVipTarget(socket, targetJids))) {
        await sendGifFromFile(
          vip.gif,
          `${title}\n\n${mention} é *${vip.percentage}%* ${label}!\n\n${vip.phrase}`,
          [targetLid],
        );

        return;
      }

      const percentage = getRandomNumber(0, 100);
      const level = levels.find((item) => percentage <= item.max);

      await sendGifFromFile(
        path.resolve(gifsDir, level.gif),
        `${title}\n\n${mention} é *${percentage}%* ${label}!\n\n${level.phrase}`,
        [targetLid],
      );
    },
  };
}
