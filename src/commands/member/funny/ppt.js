/**
 * Pedra, Papel e Tesoura (Jokenpô) no grupo, com escolha
 * secreta pelo privado do bot.
 *
 * As escolhas chegam por:
 * - privado: src/middlewares/onMesssagesUpsert.js (handleRpsPrivateMessage)
 * - grupo (contra o bot): src/middlewares/customMiddleware.js
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
  getGame,
  isBusy,
  isInGame,
  rematch,
  surrender,
  withPrefix,
} from "../../../services/rock-paper-scissors.js";
import { getRpsRanking } from "../../../utils/database.js";
import { onlyNumbers } from "../../../utils/index.js";
import {
  getSenderPlayerId,
  getTargetPlayerId,
  splitWords,
} from "../../../utils/playerId.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function helpText(prefix) {
  return `✊✋✌️ *JOKENPÔ — PEDRA, PAPEL E TESOURA*

⚔️ *${prefix}ppt @fulano [3|5|7]* — desafia (melhor de 3 por padrão)
🤖 *${prefix}ppt bot [3|5|7]* — encara o bot (ele aprende seus padrões!)
✅ *${prefix}ppt aceitar* / ❌ *${prefix}ppt recusar*
🔁 *${prefix}ppt revanche*
🏳️ *${prefix}ppt desistir*
🏆 *${prefix}ppt rank* — ranking do grupo

🔒 *Como funciona:* eu chamo cada jogador no privado e vocês escolhem em segredo (1 🪨, 2 📄, 3 ✂️). A revelação é no grupo!
⏱️ 60s por rodada. Quem não escolher perde o ponto.`;
}

export default {
  name: "ppt",
  description: "Pedra, papel e tesoura no grupo com escolha secreta!",
  commands: ["ppt", "jokenpo", "jokenpô", "pedrapapeltesoura"],
  usage: `${PREFIX}ppt @usuario`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    fullArgs,
    isGroup,
    prefix,
    remoteJid,
    sendReply,
    sendText,
    socket,
    webMessage,
  }) => {
    if (!isGroup) {
      throw new WarningError("O Jokenpô só funciona em grupos!");
    }

    const args = splitWords(fullArgs);
    const player = await getSenderPlayerId(socket, webMessage);
    if (!player) return;

    const reply = ({ text, mentions }) => sendReply(withPrefix(text, prefix), mentions);
    const send = (text, mentions) => sendText(withPrefix(text, prefix), mentions);

    const action = (args[0] || "").toLowerCase().trim();
    const game = getGame(remoteJid);

    switch (action) {
      case "ajuda":
      case "help":
        return sendReply(helpText(prefix));

      case "aceitar":
      case "aceito": {
        if (!game || game.status !== "pending") {
          throw new WarningError("Não há nenhum desafio de Jokenpô pendente aqui.");
        }

        if (game.players[1] !== player) {
          throw new WarningError("Esse desafio não é pra você! 👀");
        }

        return reply(await acceptInvite(remoteJid));
      }

      case "recusar":
      case "cancelar": {
        if (!game || game.status !== "pending" || !isInGame(game, player)) {
          throw new WarningError("Não há desafio seu para recusar/cancelar.");
        }

        cancelGame(remoteJid);

        return reply({
          text:
            game.players[1] === player
              ? `🐔 @${onlyNumbers(player)} arregou do Jokenpô contra @${onlyNumbers(
                  game.players[0]
                )}!`
              : "❌ Desafio cancelado.",
          mentions: game.players.filter((p) => p !== BOT_PLAYER),
        });
      }

      case "desistir":
      case "sair": {
        if (!game || game.status !== "playing" || !isInGame(game, player)) {
          throw new WarningError("Você não está em uma partida em andamento.");
        }

        return surrender(remoteJid, player);
      }

      case "revanche": {
        if (!game || game.status !== "finished") {
          throw new WarningError("Não há partida encerrada para revanche.");
        }

        if (!isInGame(game, player)) {
          throw new WarningError("Só quem jogou a última partida pode pedir revanche!");
        }

        return send(...Object.values(await rematch(remoteJid)));
      }

      case "rank":
      case "ranking":
      case "top": {
        const ranking = getRpsRanking(remoteJid).slice(0, 10);

        if (!ranking.length) {
          return sendReply(
            `🏆 Ninguém jogou Jokenpô ainda. Seja o primeiro: ${prefix}ppt @alguem`
          );
        }

        const lines = ranking.map(
          (entry, i) =>
            `${MEDALS[i] || `*${i + 1}.*`} @${onlyNumbers(entry.player)} — *${
              entry.points
            } pts*\n      ✅ ${entry.wins}  ❌ ${entry.losses}`
        );

        return sendReply(
          `🏆 *RANKING — JOKENPÔ* 🏆\n\n${lines.join("\n\n")}`,
          ranking.map((entry) => entry.player)
        );
      }

      default:
        break;
    }

    // Criar desafio.
    if (game && game.status !== "finished") {
      throw new WarningError("Já tem um Jokenpô rolando neste grupo! Espere acabar.");
    }

    if (game) {
      cancelGame(remoteJid);
    }

    const bestOfArg = args.map(Number).find((n) => [1, 3, 5, 7].includes(n));
    const bestOf = bestOfArg || 3;

    let challenged = null;

    if (["bot", "robo", "robô", "ia"].includes(action)) {
      challenged = BOT_PLAYER;
    } else {
      challenged = await getTargetPlayerId(socket, webMessage, args[0]);
    }

    if (!challenged) {
      return sendReply(helpText(prefix));
    }

    const botNumber = onlyNumbers((socket.user?.lid || "").split(":")[0]);
    if (challenged !== BOT_PLAYER && botNumber && onlyNumbers(challenged) === botNumber) {
      challenged = BOT_PLAYER;
    }

    if (challenged === player) {
      throw new WarningError("Jokenpô contra você mesmo? Sempre empata. 😅");
    }

    if (isBusy(player) || (challenged !== BOT_PLAYER && isBusy(challenged))) {
      throw new WarningError("Um dos jogadores já está em outra partida de Jokenpô!");
    }

    return reply(
      await createInvite({
        groupId: remoteJid,
        challenger: player,
        challenged,
        bestOf,
        send,
        socket,
      })
    );
  },
};
