/**
 * Publica no status do grupo a mensagem marcada pelo administrador.
 *
 * @author bot_marc
 */
import fs from "node:fs";
import { PREFIX } from "../../config.js";
import { InvalidParameterError, WarningError } from "../../errors/index.js";
import { postGroupStatus } from "../../services/groupStatus.js";
import {
  getContent,
  getRandomName,
  isGroup,
  removeFileIfExists,
} from "../../utils/index.js";

const MAX_VIDEO_IN_SECONDS = 50;

export default {
  name: "statusgrupo",
  description: "Publica no status do grupo a mensagem marcada",
  commands: ["statusgrupo", "status-grupo", "statusgp"],
  usage: `${PREFIX}statusgrupo (respondendo a um texto, imagem ou vídeo de até ${MAX_VIDEO_IN_SECONDS}s)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    socket,
    remoteJid,
    webMessage,
    isReply,
    isImage,
    isVideo,
    replyText,
    fullArgs,
    downloadImage,
    downloadVideo,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
    sendSuccessReply,
  }) => {
    if (!isGroup(remoteJid)) {
      throw new WarningError("Este comando só funciona em grupo!");
    }

    if (!isReply) {
      throw new InvalidParameterError(
        "Responda ao texto, imagem ou vídeo que você quer publicar no status do grupo!",
      );
    }

    const caption = fullArgs?.trim() || "";
    let filePath = null;

    try {
      await sendWaitReact();

      let content = null;

      if (isVideo) {
        const videoMessage = getContent(webMessage, "video");
        const seconds = Number(videoMessage?.seconds) || 0;

        if (seconds > MAX_VIDEO_IN_SECONDS) {
          throw new WarningError(
            `O vídeo precisa ter no máximo ${MAX_VIDEO_IN_SECONDS} segundos! Esse tem ${seconds}s.`,
          );
        }

        filePath = await downloadVideo(webMessage, getRandomName());

        content = {
          video: fs.readFileSync(filePath),
          caption: caption || videoMessage?.caption || "",
          mimetype: "video/mp4",
        };
      } else if (isImage) {
        const imageMessage = getContent(webMessage, "image");

        filePath = await downloadImage(webMessage, getRandomName());

        content = {
          image: fs.readFileSync(filePath),
          caption: caption || imageMessage?.caption || "",
        };
      } else {
        const text = caption || replyText;

        if (!text) {
          throw new WarningError(
            "A mensagem marcada não tem texto, imagem nem vídeo!",
          );
        }

        content = { text };
      }

      await postGroupStatus({ socket, remoteJid, content });

      await sendSuccessReact();
      await sendSuccessReply("Publicado no status do grupo!");
    } catch (error) {
      if (error instanceof WarningError || error instanceof InvalidParameterError) {
        throw error;
      }

      await sendErrorReply(
        `Não consegui publicar no status do grupo. ${error.message}`,
      );
    } finally {
      removeFileIfExists(filePath);
    }
  },
};
