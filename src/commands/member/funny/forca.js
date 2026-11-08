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
  getGame,
  guessLetter,
  guessWord,
  joinGame,
  leaveGame,
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

▶️ *${prefix}forca* — palavra aleatória
📂 *${prefix}forca animal* — escolhe a categoria
📋 *${prefix}forca categorias*
🔤 Mande *uma letra* no grupo pra chutar
👤 Cada pessoa pode abrir a própria forca, ao mesmo tempo
👥 *${prefix}forca entrar @fulano* — joga a mesma palavra junto
🚪 *${prefix}forca parar* — quem entrou sai; quem abriu encerra
🎯 *${prefix}forca chute PALAVRA* — arrisca a palavra
💡 *${prefix}forca dica* — revela uma letra (custa 1 vida)
👀 *${prefix}forca status* · 🛑 *${prefix}forca parar*
🏆 *${prefix}forca rank*

📜 *Pontos:*
✅ Letra certa: +1 por vez que aparece
❌ Letra errada: -1 e perde 1 vida (são 6 ❤️)
🎯 Acertou a palavra: +5 + 1 por letra escondida
💥 Errou o chute: -2 e perde 2 vidas
🏁 Quem completar a última letra: +3`;
}

export default {
  name: "forca",
  description: "Jogo da forca no grupo, com mais de mil palavras!",
  commands: ["forca", "hangman"],
  usage: `${PREFIX}forca [categoria]`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ fullArgs, isGroup, prefix, remoteJid, sendReply, sendText, socket, webMessage }) => {
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
        if (game) {
          throw new WarningError(`Você já está em uma forca! Para sair: ${prefix}forca parar`);
        }
        const owner = await getTargetPlayerId(socket, webMessage, args[1]);
        if (!owner) throw new WarningError(`De quem é a forca? Ex.: ${prefix}forca entrar @fulano`);
        const joined = joinGame(remoteJid, player, owner);
        if (!joined) throw new WarningError("Essa pessoa não tem forca aberta.");
        return reply(joined);
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
      // "/forca a" chuta letra; "/forca cachorro" chuta palavra.
      if (action && [...action].length === 1) return answer(guessLetter(remoteJid, player, action));
      if (action) return answer(guessWord(remoteJid, player, fullArgs));
      return reply(describeGame(remoteJid, player));
    }

    let category = null;
    if (action) {
      category = findCategory(fullArgs);
      if (!category) {
        throw new WarningError(`Categoria não encontrada! Veja: ${prefix}forca categorias`);
      }
    }

    return reply(startGame({ groupId: remoteJid, starter: player, category, send }));
  },
};
