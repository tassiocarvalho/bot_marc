/**
 * Jogo de Damas (regras brasileiras) no grupo.
 * O bot lista as jogadas válidas numeradas e o jogador manda só o número.
 *
 * As jogadas são capturadas em src/middlewares/customMiddleware.js.
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
  offerDraw,
  playMove,
  rematch,
  surrender,
  withPrefix,
} from "../../../services/checkers.js";
import { getCheckersRanking } from "../../../utils/database.js";
import { onlyNumbers } from "../../../utils/index.js";

const MEDALS = ["🥇", "🥈", "🥉"];

function helpText(prefix) {
  return `♟️ *JOGO DE DAMAS* ♟️

⚔️ *${prefix}dama @fulano* — desafia alguém
🤖 *${prefix}dama bot [facil|normal|dificil]* — encara o bot
✅ *${prefix}dama aceitar* / ❌ *${prefix}dama recusar*
🔢 Na sua vez, mande só o *número* da jogada da lista
   _(ou digite as casas, tipo *c3 d4*)_
🤝 *${prefix}dama empate* — propõe/aceita empate
🏳️ *${prefix}dama desistir*
👀 *${prefix}dama tabuleiro*
🔁 *${prefix}dama revanche* — inverte as cores
🏆 *${prefix}dama rank*

📜 *Regras (brasileiras):*
• ⚪ Brancas começam
• Peça anda 1 casa pra frente, mas *captura pra frente e pra trás*
• *Captura é obrigatória* e tem que pegar o *máximo* de peças
• Chegou na última fileira = 👑 *DAMA* (🤍/🖤), que anda e captura à distância
• Vence quem capturar tudo ou trancar o adversário
⏱️ 3 min por jogada, senão é W.O.`;
}

export default {
  name: "dama",
  description: "Jogo de damas no grupo: desafie alguém ou o bot!",
  commands: ["dama", "damas", "checkers"],
  usage: `${PREFIX}dama @usuario`,
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
      throw new WarningError("O jogo de damas só funciona em grupos!");
    }

    const reply = ({ text, mentions }) => sendReply(withPrefix(text, prefix), mentions);
    const send = (text, mentions) => sendText(withPrefix(text, prefix), mentions);

    const action = (args[0] || "").toLowerCase().trim();
    const game = getGame(remoteJid);

    // Jogada via comando: /dama 3  ou  /dama c3 d4
    if (/^\d{1,2}$/.test(action) || /^[a-h][1-8]$/.test(action)) {
      const result = playMove(remoteJid, userLid, args.join(" "));
      if (!result) throw new WarningError("Você não está em uma partida em andamento.");
      return reply(result.error ? { text: result.error, mentions: result.mentions } : result);
    }

    const playing = game && game.status === "playing" && isInGame(game, userLid);

    switch (action) {
      case "ajuda":
      case "help":
      case "regras":
        return sendReply(helpText(prefix));

      case "aceitar":
      case "aceito":
        if (!game || game.status !== "pending") {
          throw new WarningError("Não há nenhum desafio de damas pendente aqui.");
        }
        if (game.players.b !== userLid) {
          throw new WarningError("Esse desafio não é pra você! 👀");
        }
        return reply(acceptInvite(remoteJid));

      case "recusar":
      case "cancelar":
        if (!game || game.status !== "pending" || !isInGame(game, userLid)) {
          throw new WarningError("Não há desafio seu para recusar/cancelar.");
        }
        cancelGame(remoteJid);
        return reply({
          text:
            game.players.b === userLid
              ? `🐔 @${onlyNumbers(userLid)} fugiu do tabuleiro de @${onlyNumbers(game.players.w)}!`
              : "❌ Desafio cancelado.",
          mentions: [game.players.w, game.players.b],
        });

      case "desistir":
      case "sair":
        if (!playing) throw new WarningError("Você não está em uma partida em andamento.");
        return reply(surrender(remoteJid, userLid));

      case "empate":
        if (!playing) throw new WarningError("Você não está em uma partida em andamento.");
        return reply(offerDraw(remoteJid, userLid));

      case "revanche":
        if (!game || game.status !== "finished") {
          throw new WarningError("Não há partida encerrada para revanche.");
        }
        if (!isInGame(game, userLid)) {
          throw new WarningError("Só quem jogou a última partida pode pedir revanche!");
        }
        return send(...Object.values(rematch(remoteJid)));

      case "tabuleiro":
      case "status": {
        const info = describeGame(remoteJid);
        if (!info) throw new WarningError(`Nenhuma partida rolando. Use ${prefix}dama @alguem`);
        return reply(info);
      }

      case "rank":
      case "ranking":
      case "top": {
        const ranking = getCheckersRanking(remoteJid).slice(0, 10);
        if (!ranking.length) {
          return sendReply(`🏆 Ninguém jogou damas ainda. Seja o primeiro: ${prefix}dama @alguem`);
        }
        const lines = ranking.map(
          (entry, i) =>
            `${MEDALS[i] || `*${i + 1}.*`} @${onlyNumbers(entry.player)} — *${entry.points} pts*\n      ✅ ${
              entry.wins
            }  ❌ ${entry.losses}  🤝 ${entry.draws}`
        );
        return sendReply(
          `🏆 *RANKING — DAMAS* 🏆\n\n${lines.join("\n\n")}`,
          ranking.map((entry) => entry.player)
        );
      }

      default:
        break;
    }

    // Criar desafio.
    if (game && game.status !== "finished") {
      throw new WarningError(`Já tem uma partida de damas rolando! Veja com ${prefix}dama tabuleiro`);
    }
    if (game) cancelGame(remoteJid);

    let challenged = null;
    let difficulty;

    if (["bot", "robo", "robô", "ia"].includes(action)) {
      challenged = BOT_PLAYER;
      const level = (args[1] || "normal").toLowerCase();
      difficulty = ["facil", "fácil"].includes(level)
        ? "facil"
        : ["dificil", "difícil", "hard", "impossivel"].includes(level)
        ? "dificil"
        : "normal";
    } else if (isReply && replyLid) {
      challenged = replyLid;
    } else if (args[0] && onlyNumbers(args[0])) {
      challenged = `${onlyNumbers(args[0])}@lid`;
    }

    if (!challenged) return sendReply(helpText(prefix));

    const botNumber = onlyNumbers((socket.user?.lid || "").split(":")[0]);
    if (challenged !== BOT_PLAYER && botNumber && onlyNumbers(challenged) === botNumber) {
      challenged = BOT_PLAYER;
    }

    if (challenged === userLid) {
      throw new WarningError("Damas contra você mesmo? Aí não tem graça. 😅");
    }

    return reply(
      createInvite({ groupId: remoteJid, challenger: userLid, challenged, send, difficulty })
    );
  },
};
