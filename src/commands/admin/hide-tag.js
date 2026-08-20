import { PREFIX } from "../../config.js";

export default {
  name: "hide-tag",
  description: "Este comando marcará todos do grupo",
  commands: ["hide-tag", "to-tag", "marcar", "marca", "tag-all"],
  usage: `${PREFIX}hidetag motivo

ou

${PREFIX}hidetag (respondendo a mensagem que quer divulgar)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    fullArgs,
    replyText,
    sendText,
    socket,
    remoteJid,
    sendReact,
  }) => {
    const { participants } = await socket.groupMetadata(remoteJid);
    const mentions = participants.map(({ id }) => id);

    const message = fullArgs || replyText || "";

    await sendReact("📢");
    await sendText(`📢 Marcando todos!\n\n${message}`, mentions);
  },
};
