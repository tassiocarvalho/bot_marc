import { PREFIX } from "../../config.js";
import { isGroup, onlyNumbers } from "../../utils/index.js";
import { errorLog } from "../../utils/logger.js";

export default {
  name: "promover",
  description: "Promove um usuário a administrador do grupo",
  commands: ["promover", "promove", "promote", "add-adm"],
  usage: `${PREFIX}promover @usuario

ou

${PREFIX}promover (respondendo a mensagem do usuário)`,
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
        "Marque um usuário ou responda a mensagem dele para promover.",
      );
    }

    const mentionedLid = args[0] ? `${onlyNumbers(args[0])}@lid` : null;
    const userLid = isReply ? replyLid : mentionedLid;

    if (!userLid) {
      return sendWarningReply("Não consegui identificar o usuário!");
    }

    try {
      await socket.groupParticipantsUpdate(remoteJid, [userLid], "promote");

      await sendSuccessReply("Usuário promovido com sucesso!");
    } catch (error) {
      errorLog(`Erro ao promover usuário: ${error.message}`);
      await sendErrorReply(
        "Ocorreu um erro ao tentar promover o usuário. Eu preciso ser administrador do grupo para promover outros usuários!",
      );
    }
  },
};
