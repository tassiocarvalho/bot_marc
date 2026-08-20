import { PREFIX } from "../../config.js";
import { isGroup, onlyNumbers } from "../../utils/index.js";
import { errorLog } from "../../utils/logger.js";

export default {
  name: "rebaixar",
  description: "Rebaixa um administrador para membro comum",
  commands: ["rebaixar", "rebaixa", "demote"],
  usage: `${PREFIX}rebaixar @usuario

ou

${PREFIX}rebaixar (respondendo a mensagem do administrador)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    args,
    isReply,
    replyLid,
    remoteJid,
    socket,
    sendWarningReply,
    sendSuccessReply,
    sendErrorReply,
  }) => {
    if (!isGroup(remoteJid)) {
      return sendWarningReply("Este comando só pode ser usado em grupo !");
    }

    if (!args.length && !isReply) {
      return sendWarningReply(
        "Marque um administrador ou responda a mensagem dele para rebaixar.",
      );
    }

    const mentionedLid = args[0] ? `${onlyNumbers(args[0])}@lid` : null;
    const userLid = isReply ? replyLid : mentionedLid;

    if (!userLid) {
      return sendWarningReply("Não consegui identificar o usuário!");
    }

    try {
      await socket.groupParticipantsUpdate(remoteJid, [userLid], "demote");

      await sendSuccessReply("Usuário rebaixado com sucesso!");
    } catch (error) {
      errorLog(`Erro ao rebaixar administrador: ${error.message}`);
      await sendErrorReply(
        "Ocorreu um erro ao tentar rebaixar o usuário. Eu preciso ser administrador do grupo para rebaixar outros administradores!",
      );
    }
  },
};
