/**
 * Contagem de mensagens por membro para o /rank.
 *
 * Os contadores ficam em memória e vão para o disco em lotes, porque gravar o
 * JSON a cada mensagem pesaria demais em grupos movimentados.
 *
 * @author bot_marc
 */
import { BOT_LID } from "../config.js";
import { addMessageCounts, getMessageCounts } from "../utils/database.js";
import { errorLog } from "../utils/logger.js";
import { bareJid } from "../utils/playerId.js";

const FLUSH_INTERVAL_IN_MILLISECONDS = 10_000;
const MAX_UNWRAP_DEPTH = 5;

// Envelopes que guardam a mensagem de verdade em `.message`.
const WRAPPER_KEYS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];

// O que não está aqui não conta: reações, votos, apagar e editar mensagem.
export const MESSAGE_CATEGORIES = [
  {
    key: "text",
    emoji: "📝",
    label: "texto",
    types: ["conversation", "extendedTextMessage"],
  },
  {
    key: "sticker",
    emoji: "🎭",
    label: "figurinha",
    types: ["stickerMessage", "lottieStickerMessage"],
  },
  { key: "audio", emoji: "🎤", label: "áudio", types: ["audioMessage"] },
  { key: "image", emoji: "🖼️", label: "imagem", types: ["imageMessage"] },
  {
    key: "video",
    emoji: "🎬",
    label: "vídeo",
    types: ["videoMessage", "ptvMessage"],
  },
  {
    key: "document",
    emoji: "📄",
    label: "documento",
    types: ["documentMessage"],
  },
  {
    key: "other",
    emoji: "📦",
    label: "outros",
    types: [
      "contactMessage",
      "contactsArrayMessage",
      "locationMessage",
      "liveLocationMessage",
      "pollCreationMessage",
      "pollCreationMessageV2",
      "pollCreationMessageV3",
      "eventMessage",
    ],
  },
];

let pendingByGroup = {};
let flushTimer = null;

/**
 * Descobre a categoria olhando só o conteúdo da própria mensagem. O baileysIs
 * do projeto também olha a mensagem citada, e contaria como figurinha um texto
 * que apenas responde a uma figurinha.
 *
 * @param {object} message
 * @returns {string | null}
 */
export function classifyMessage(message) {
  let content = message;

  for (let depth = 0; content && depth < MAX_UNWRAP_DEPTH; depth++) {
    const wrapper = WRAPPER_KEYS.find((key) => content[key]?.message);

    if (!wrapper) {
      break;
    }

    content = content[wrapper].message;
  }

  if (!content) {
    return null;
  }

  const category = MESSAGE_CATEGORIES.find(({ types }) =>
    types.some((type) => content[type]),
  );

  return category?.key ?? null;
}

function isBot(socket, userId) {
  return [socket.user?.lid, socket.user?.id, BOT_LID].some(
    (jid) => bareJid(jid) === userId,
  );
}

function flushPendingCounts() {
  clearTimeout(flushTimer);
  flushTimer = null;

  if (!Object.keys(pendingByGroup).length) {
    return;
  }

  try {
    addMessageCounts(pendingByGroup);
    pendingByGroup = {};
  } catch (error) {
    errorLog(`Não consegui salvar as contagens do /rank: ${error.message}`);
  }
}

function addToPending(groupId, userId, category) {
  pendingByGroup[groupId] ??= {};
  pendingByGroup[groupId][userId] ??= {};

  const counts = pendingByGroup[groupId][userId];

  counts[category] = (counts[category] || 0) + 1;

  flushTimer ??= setTimeout(
    flushPendingCounts,
    FLUSH_INTERVAL_IN_MILLISECONDS,
  ).unref();
}

/**
 * Conta uma mensagem de grupo. Mensagens do próprio bot ficam de fora.
 *
 * @param {{socket: object, webMessage: object, getPlayer: () => Promise<string | null>}} params
 */
export async function trackMessage({ socket, webMessage, getPlayer }) {
  const category = classifyMessage(webMessage.message);

  if (!category || webMessage.key?.fromMe) {
    return;
  }

  const player = await getPlayer();

  if (!player || isBot(socket, player)) {
    return;
  }

  addToPending(webMessage.key.remoteJid, player, category);
}

/**
 * @param {object} socket
 * @param {string} groupId
 * @returns {{since: string | null, ranking: {userId: string, counts: Record<string, number>, total: number}[]}}
 */
export function getMessageRanking(socket, groupId) {
  flushPendingCounts();

  const group = getMessageCounts(groupId);

  if (!group) {
    return { since: null, ranking: [] };
  }

  const ranking = Object.entries(group.users)
    .filter(([userId]) => !isBot(socket, userId))
    .map(([userId, counts]) => ({
      userId,
      counts,
      total: Object.values(counts).reduce((sum, amount) => sum + amount, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return { since: group.since, ranking };
}
