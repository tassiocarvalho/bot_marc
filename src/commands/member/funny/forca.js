/**
 * Jogo da Forca no grupo: cada pessoa joga a própria partida e pode
 * entrar na de outra para jogarem a mesma palavra.
 * As letras soltas são capturadas em src/middlewares/customMiddleware.js.
 *
 * @author bot_marc
 */
import { PREFIX } from "../../../config.js";
import { WarningError } from "../../../errors/index.js";
import {
  categoriesText,
  describeGame,
  findCategory,
  findLevel,
  getGame,
  guessLetter,
  guessWord,
  joinGame,
  leaveGame,
  levelsText,
  startGame,
  stopGame,
  totalWords,
  useHint,
  withPrefix,
} from "../../../services/hangman.js";
import { getHangmanRanking } from "../../../utils/database.js";
import { onlyNumbers } from "../../../utils/index.js";
import {
  getSenderPlayerId,
  getTargetPlayerId,
  splitWords,
} from "../../../utils/playerId.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function helpText(prefix) {
  return `🪢 *JOGO DA FORCA* — ${totalWords()} palavras!

▶️ *${prefix}forca* — categoria e nível aleatórios
🎚️ *${prefix}forca dificil* — escolhe o nível (facil, medio, dificil)
📂 *${prefix}forca animal* — escolhe a categoria
🎯 *${prefix}forca animal dificil* — categoria e nível
📋 *${prefix}forca categorias* · 📊 *${prefix}forca niveis*
🔤 Mande *uma letra* no grupo pra chutar
👤 Cada pessoa pode abrir a própria forca, ao mesmo tempo
👥 *${prefix}forca entrar* — joga a mesma palavra junto (responda ao tabuleiro ou marque quem abriu)
☝️ Cada pessoa só fica em uma forca por vez
🚪 *${prefix}forca parar* — quem entrou sai; quem abriu encerra
🎯 *${prefix}forca chute PALAVRA* — arrisca a palavra
💡 *${prefix}forca dica* — revela uma letra (custa 1 vida)
👀 *${prefix}forca status* · 🛑 *${prefix}forca parar*
🏆 *${prefix}forca rank*

❤️ São 6 vidas: letra errada tira 1, chute errado tira 2.

📜 *Pontos por nível:*

${levelsText()}`;
}

export default {
  name: "forca",
  description: "Jogo da forca no grupo, com mais de mil palavras!",
  commands: ["forca", "hangman"],
  usage: `${PREFIX}forca [categoria]`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ fullArgs, isGroup, prefix, remoteJid, replyText, sendReply, sendText, socket, webMessage }) => {
    if (!isGroup) {
      throw new WarningError("A forca só funciona em grupos!");
    }

    const args = splitWords(fullArgs);
    const player = await getSenderPlayerId(socket, webMessage);
    if (!player) return;

    const reply = ({ text, mentions }) => sendReply(withPrefix(text, prefix), mentions);
    const send = (text, mentions) => sendText(withPrefix(text, prefix), mentions);
    const answer = (result) =>
      reply(result.error ? { text: result.error, mentions: result.mentions } : result);

    const action = (args[0] || "").toLowerCase().trim();
    const game = getGame(remoteJid, player);

    const assertHasGame = () => {
      if (!game) {
        throw new WarningError(`Você não tem forca aberta. Comece com ${prefix}forca`);
      }
    };

    switch (action) {
      case "ajuda":
      case "help":
      case "regras":
        return sendReply(helpText(prefix));

      case "categorias":
      case "categoria":
        return sendReply(`📂 *CATEGORIAS DA FORCA*\n\n${categoriesText()}\n\nEx.: *${prefix}forca fruta*`);

      case "niveis":
      case "nivel":
      case "níveis":
      case "nível":
      case "dificuldades":
        return sendReply(`🎚️ *NÍVEIS DA FORCA*\n\n${levelsText()}\n\nEx.: *${prefix}forca dificil*`);

      case "rank":
      case "ranking":
      case "top": {
        const ranking = getHangmanRanking(remoteJid).slice(0, 10);
        if (!ranking.length) {
          return sendReply(`🏆 Ninguém jogou forca ainda. Comece com ${prefix}forca`);
        }
        const lines = ranking.map(
          (e, i) =>
            `${MEDALS[i] || `*${i + 1}.*`} @${onlyNumbers(e.player)} — *${e.points} pts*\n      🎯 ${e.words} palavra${
              e.words === 1 ? "" : "s"
            } matada${e.words === 1 ? "" : "s"} · 🎮 ${e.games} rodada${e.games === 1 ? "" : "s"}`
        );
        return sendReply(`🏆 *RANKING — FORCA* 🏆\n\n${lines.join("\n\n")}`, ranking.map((e) => e.player));
      }

      case "entrar":
      case "juntar": {
        const target = await getTargetPlayerId(socket, webMessage, args[1]);
        return answer(joinGame(remoteJid, player, { target, quotedText: replyText }));
      }

      case "chute":
      case "chutar":
      case "palavra": {
        assertHasGame();
        const word = args.slice(1).join(" ").trim();
        if (!word) throw new WarningError(`Diga a palavra! Ex.: ${prefix}forca chute cachorro`);
        return answer(guessWord(remoteJid, player, word));
      }

      case "dica":
        assertHasGame();
        return answer(useHint(remoteJid, player));

      case "status":
      case "tabuleiro":
        assertHasGame();
        return reply(describeGame(remoteJid, player));

      case "parar":
      case "encerrar":
      case "cancelar":
        assertHasGame();
        if (game.starter !== player) return reply(leaveGame(remoteJid, player));
        return send(...Object.values(stopGame(remoteJid, player)));

      default:
        break;
    }

    if (game) {
      // Sem isso, "/forca dificil" viraria um chute errado e tiraria 2 vidas.
      if (findLevel(action)) {
        throw new WarningError(`Você já está em uma forca! Para sair: ${prefix}forca parar`);
      }

      // "/forca a" chuta letra; "/forca cachorro" chuta palavra.
      if (action && [...action].length === 1) return answer(guessLetter(remoteJid, player, action));
      if (action) return answer(guessWord(remoteJid, player, fullArgs));
      return reply(describeGame(remoteJid, player));
    }

    const level = args.map(findLevel).find(Boolean) || null;
    const categoryText = args.filter((word) => !findLevel(word)).join(" ");

    let category = null;
    if (categoryText) {
      category = findCategory(categoryText);
      if (!category) {
        throw new WarningError(
          `Categoria não encontrada! Veja: ${prefix}forca categorias\nNíveis: facil, medio, dificil`
        );
      }
    }

    return answer(startGame({ groupId: remoteJid, starter: player, category, level, send }));
  },
};
