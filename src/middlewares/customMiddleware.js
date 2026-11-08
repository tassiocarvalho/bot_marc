/**
 * Middleware customizado para adicionar lógica personalizada
 * sem modificar os arquivos principais do bot.
 *
 * Este middleware é chamado em dois momentos:
 * 1. Antes de processar qualquer mensagem (type: "message")
 * 2. Antes de processar eventos de participantes add/remove (type: "participant")
 *
 * @param {CustomMiddlewareProps} params - Parâmetros do middleware
 *
 * Para exemplos de uso, consulte:
 * - README.md (seção "Custom Middleware")
 *
 * @author bot_marc
 */
import {
  getGame as getCheckersGame,
  looksLikeMove,
  playMove as playCheckersMove,
  withPrefix as withCheckersPrefix,
} from "../services/checkers.js";
import {
  guessLetter,
  withPrefix as withHangmanPrefix,
} from "../services/hangman.js";
import { trackMessage } from "../services/message-ranking.js";
import {
  getGame as getRpsGame,
  playVsBotInGroup,
} from "../services/rock-paper-scissors.js";
import { getGame, playMove, withPrefix } from "../services/tic-tac-toe.js";
import { getPrefix, isActiveGroup } from "../utils/database.js";
import { errorLog } from "../utils/logger.js";
import { getSenderPlayerId } from "../utils/playerId.js";

export async function customMiddleware({
  socket,
  webMessage,
  type,
  commonFunctions,
  action,
  data,
}) {
  if (type === "message" && commonFunctions) {
    // ID canônico do jogador (LID), resolvido só quando algum jogo precisa.
    let playerPromise = null;
    const getPlayer = () =>
      (playerPromise ??= getSenderPlayerId(socket, webMessage).catch(() => null));

    const props = { ...commonFunctions, getPlayer };

    countMessageForRank(props);

    await handleTicTacToeMove(props);
    await handleRpsVsBotChoice(props);
    await handleCheckersMove(props);
    await handleHangmanLetter(props);
  }
}

/**
 * /rank: conta sem esperar, para a busca do ID não atrasar jogos e comandos.
 */
function countMessageForRank({
  socket,
  webMessage,
  isGroup,
  remoteJid,
  getPlayer,
}) {
  if (!isGroup || !isActiveGroup(remoteJid)) {
    return;
  }

  trackMessage({ socket, webMessage, getPlayer }).catch((error) =>
    errorLog(`Erro ao contar mensagem para o /rank: ${error.message}`),
  );
}

/**
 * Jogo da velha: o jogador da vez manda só o número (1-9).
 */
async function handleTicTacToeMove({
  fullMessage,
  isGroup,
  remoteJid,
  sendReply,
  getPlayer,
}) {
  const text = (fullMessage || "").trim();

  if (!isGroup || !/^[1-9]$/.test(text) || !getGame(remoteJid)) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const player = await getPlayer();
  if (!player) return;

  const result = playMove(remoteJid, player, Number(text));

  if (!result) {
    return;
  }

  await sendReply(
    withPrefix(result.error || result.text, getPrefix(remoteJid)),
    result.mentions
  );
}

/**
 * Jokenpô contra o bot: o jogador escolhe direto no grupo.
 */
async function handleRpsVsBotChoice({
  fullMessage,
  isGroup,
  remoteJid,
  sendReply,
  getPlayer,
}) {
  if (!isGroup || !fullMessage || fullMessage.length > 12) {
    return;
  }

  if (!getRpsGame(remoteJid)?.vsBot) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const player = await getPlayer();
  if (!player) return;

  const answer = await playVsBotInGroup(remoteJid, player, fullMessage);

  if (answer) {
    await sendReply(answer);
  }
}

/**
 * Damas: o jogador da vez manda o número da jogada (ou "c3 d4").
 */
async function handleCheckersMove({
  fullMessage,
  isGroup,
  remoteJid,
  sendReply,
  getPlayer,
}) {
  if (!isGroup || !looksLikeMove(fullMessage) || !getCheckersGame(remoteJid)) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const player = await getPlayer();
  if (!player) return;

  const result = playCheckersMove(remoteJid, player, fullMessage);

  if (!result) {
    return;
  }

  await sendReply(
    withCheckersPrefix(result.error || result.text, getPrefix(remoteJid)),
    result.mentions
  );
}

/**
 * Forca: a letra sozinha no grupo vai para a partida de quem mandou.
 */
async function handleHangmanLetter({
  fullMessage,
  isGroup,
  remoteJid,
  sendReply,
  getPlayer,
}) {
  const text = (fullMessage || "").trim();

  if (!isGroup || [...text].length !== 1) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const player = await getPlayer();
  if (!player) return;

  const result = guessLetter(remoteJid, player, text);

  if (!result) {
    return;
  }

  await sendReply(
    withHangmanPrefix(result.error || result.text, getPrefix(remoteJid)),
    result.mentions
  );
}
