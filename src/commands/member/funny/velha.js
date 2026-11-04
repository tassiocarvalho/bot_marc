/**
 * Jogo da Velha no grupo: desafie alguém (ou o bot)
 * e jogue mandando só o número da casa.
 *
 * As jogadas por número são capturadas em
 * src/middlewares/customMiddleware.js.
 *
 * @author bot_marc
 */
import { PREFIX } from "../../../config.js";
import { WarningError } from "../../../errors/index.js";
import {
  acceptInvite,
  BOT_PLAYER,
  cancelGame,
  createInvite,
  describeGame,
  getGame,
  isInGame,
  playMove,
  rematch,
  surrender,
  withPrefix,
} from "../../../services/tic-tac-toe.js";
import { getTicTacToeRanking } from "../../../utils/database.js";
import { onlyNumbers } from "../../../utils/index.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function helpText(prefix) {
  return `🎮 *JOGO DA VELHA* ❌⭕

⚔️ *${prefix}velha @fulano* — desafia alguém
🤖 *${prefix}velha bot [facil|normal|impossivel]* — encara o bot
✅ *${prefix}velha aceitar* / ❌ *${prefix}velha recusar*
🔢 Na sua vez, mande só o número da casa (1-9)
🔁 *${prefix}velha revanche* — inverte os lados (⭕ vira ❌ e começa)
🏳️ *${prefix}velha desistir*
👀 *${prefix}velha tabuleiro* — mostra a partida atual
🏆 *${prefix}velha rank* — ranking do grupo

📜 *Regras:* X sempre começa.
Vitória = 3 pts, empate = 1 pt.
⏱️ Demorou mais de 90s na sua vez? Perde por W.O.!`;
}

export default {
  name: "velha",
  description: "Jogo da velha no grupo: desafie alguém ou o bot!",
  commands: ["velha", "jogodavelha", "tictactoe", "ttt"],
  usage: `${PREFIX}velha @usuario`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    args,
    isGroup,
    isReply,
    prefix,
    remoteJid,
    replyLid,
    sendReply,
    sendText,
    socket,
    userLid,
  }) => {
    if (!isGroup) {
      throw new WarningError("O jogo da velha só funciona em grupos!");
    }

    const reply = ({ text, mentions }) =>
      sendReply(withPrefix(text, prefix), mentions);

    const send = (text, mentions) => sendText(withPrefix(text, prefix), mentions);

    const action = (args[0] || "").toLowerCase().trim();
    const game = getGame(remoteJid);

    // Jogada via comando: /velha 5
    if (/^[1-9]$/.test(action)) {
      const result = playMove(remoteJid, userLid, Number(action));

      if (!result) {
        throw new WarningError("Você não está em uma partida em andamento.");
      }

      return reply(result.error ? { text: result.error, mentions: result.mentions } : result);
    }

    switch (action) {
      case "ajuda":
      case "help":
        return sendReply(helpText(prefix));

      case "aceitar":
      case "aceito": {
        if (!game || game.status !== "pending") {
          throw new WarningError("Não há nenhum desafio pendente aqui.");
        }

        if (game.players.O !== userLid) {
          throw new WarningError("Esse desafio não é pra você! 👀");
        }

        return reply(acceptInvite(remoteJid));
      }

      case "recusar":
      case "cancelar": {
        if (!game || game.status !== "pending" || !isInGame(game, userLid)) {
          throw new WarningError("Não há desafio seu para recusar/cancelar.");
        }

        cancelGame(remoteJid);

        const fled = game.players.O === userLid;

        return reply({
          text: fled
            ? `🐔 @${onlyNumbers(userLid)} recusou o desafio de @${onlyNumbers(
                game.players.X
              )}. Cocoricó!`
            : "❌ Desafio cancelado.",
          mentions: [game.players.X, game.players.O],
        });
      }

      case "desistir":
      case "sair": {
        if (!game || game.status !== "playing" || !isInGame(game, userLid)) {
          throw new WarningError("Você não está em uma partida em andamento.");
        }

        return reply(surrender(remoteJid, userLid));
      }

      case "revanche": {
        if (!game || game.status !== "finished") {
          throw new WarningError("Não há partida encerrada para revanche.");
        }

        if (!isInGame(game, userLid)) {
          throw new WarningError("Só quem jogou a última partida pode pedir revanche!");
        }

        return send(...Object.values(rematch(remoteJid)));
      }

      case "tabuleiro":
      case "status": {
        const info = describeGame(remoteJid);

        if (!info) {
          throw new WarningError(`Nenhuma partida rolando. Use ${prefix}velha @alguem`);
        }

        return reply(info);
      }

      case "rank":
      case "ranking":
      case "top": {
        const ranking = getTicTacToeRanking(remoteJid).slice(0, 10);

        if (!ranking.length) {
          return sendReply(
            `🏆 Ninguém jogou ainda neste grupo. Seja o primeiro: ${prefix}velha @alguem`
          );
        }

        const lines = ranking.map(
          (entry, i) =>
            `${MEDALS[i] || `*${i + 1}.*`} @${onlyNumbers(entry.player)} — *${
              entry.points
            } pts*\n      ✅ ${entry.wins}  ❌ ${entry.losses}  🤝 ${entry.draws}`
        );

        return sendReply(
          `🏆 *RANKING — JOGO DA VELHA* 🏆\n\n${lines.join("\n\n")}`,
          ranking.map((entry) => entry.player)
        );
      }

      default:
        break;
    }

    // A partir daqui: criar desafio.
    if (game && game.status !== "finished") {
      throw new WarningError(
        `Já tem uma partida rolando neste grupo! Veja com ${prefix}velha tabuleiro`
      );
    }

    if (game) {
      cancelGame(remoteJid);
    }

    const botNumber = onlyNumbers((socket.user?.lid || "").split(":")[0]);

    let challenged = null;
    let difficulty;

    if (["bot", "robo", "robô", "ia"].includes(action)) {
      challenged = BOT_PLAYER;
      const level = (args[1] || "normal").toLowerCase();
      difficulty = ["facil", "fácil"].includes(level)
        ? "facil"
        : ["impossivel", "impossível", "dificil", "difícil", "hard"].includes(level)
        ? "impossivel"
        : "normal";
    } else if (isReply && replyLid) {
      challenged = replyLid;
    } else if (args[0] && onlyNumbers(args[0])) {
      challenged = `${onlyNumbers(args[0])}@lid`;
    }

    if (!challenged) {
      return sendReply(helpText(prefix));
    }

    if (challenged !== BOT_PLAYER && botNumber && onlyNumbers(challenged) === botNumber) {
      challenged = BOT_PLAYER;
      difficulty = "impossivel";
    }

    if (challenged === userLid) {
      throw new WarningError("Jogar contra si mesmo? Aí você empata sempre. 😅");
    }

    return reply(
      createInvite({
        groupId: remoteJid,
        challenger: userLid,
        challenged,
        send,
        difficulty,
      })
    );
  },
};
