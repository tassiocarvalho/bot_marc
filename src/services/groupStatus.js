/**
 * Publicação de status de grupo.
 *
 * O baileys oficial não expõe a opção `groupStatus` no envio — só o fork
 * @neoxr/baileys tem. Mas o proto dele já aceita `groupStatusMessageV2` e
 * `contextInfo.isGroupStatus`, então montamos o embrulho aqui e entregamos
 * via relayMessage. Assim o projeto não precisa trocar de biblioteca, o que
 * quebraria os 47 arquivos que importam "baileys" e o patch do postinstall.
 *
 * @author bot_marc
 */
import {
  generateWAMessageContent,
  generateWAMessageFromContent,
} from "baileys";

/**
 * @param {{socket: object, remoteJid: string, content: object}} params
 * content é o mesmo objeto aceito pelo sendMessage: { text }, { image, caption }
 * ou { video, caption }.
 */
export async function postGroupStatus({ socket, remoteJid, content }) {
  const inner = await generateWAMessageContent(content, {
    upload: socket.waUploadToServer,
  });

  const messageType = Object.keys(inner)[0];
  const target = inner[messageType];

  if (target && typeof target === "object") {
    target.contextInfo = {
      ...(target.contextInfo || {}),
      isGroupStatus: true,
    };
  }

  const message = generateWAMessageFromContent(
    remoteJid,
    { groupStatusMessageV2: { message: inner } },
    {},
  );

  await socket.relayMessage(remoteJid, message.message, {
    messageId: message.key.id,
  });

  return message;
}
