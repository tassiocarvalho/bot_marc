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
import { playVsBotInGroup } from "../services/rock-paper-scissors.js";
import { getGame, playMove, withPrefix } from "../services/tic-tac-toe.js";
import { isActiveGroup } from "../utils/database.js";

export async function customMiddleware({
  socket,
  webMessage,
  type,
  commonFunctions,
  action,
  data,
}) {
  if (type === "message" && commonFunctions) {
    await handleTicTacToeMove(commonFunctions);
    await handleRpsVsBotChoice(commonFunctions);
  }
}

/**
 * Jogo da velha: o jogador da vez manda só o número (1-9).
 */
async function handleTicTacToeMove({
  fullMessage,
  isGroup,
  prefix,
  remoteJid,
  sendReply,
  userLid,
}) {
  const text = (fullMessage || "").trim();

  if (!isGroup || !/^[1-9]$/.test(text) || !getGame(remoteJid)) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const result = playMove(remoteJid, userLid, Number(text));

  if (!result) {
    return;
  }

  await sendReply(
    withPrefix(result.error || result.text, prefix),
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
  userLid,
}) {
  if (!isGroup || !fullMessage || fullMessage.length > 12) {
    return;
  }

  if (!isActiveGroup(remoteJid)) {
    return;
  }

  const answer = await playVsBotInGroup(remoteJid, userLid, fullMessage);

  if (answer) {
    await sendReply(answer);
  }
}
