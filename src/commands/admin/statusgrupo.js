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
  STATUS_MAX_SECONDS,
  STATUS_PART_MAX_SECONDS,
  getVideoDuration,
  prepareStatusVideo,
} from "../../services/statusVideo.js";
import {
  getContent,
  getRandomName,
  isGroup,
  removeFileIfExists,
} from "../../utils/index.js";

const MAX_VIDEO_IN_MINUTES = STATUS_MAX_SECONDS / 60;

function formatDuration(seconds) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");

  return `${minutes}:${rest}`;
}

export default {
  name: "statusgrupo",
  description: "Publica no status do grupo a mensagem marcada",
  commands: ["statusgrupo", "status-grupo", "statusgp"],
  usage: `${PREFIX}statusgrupo (respondendo a um texto, imagem ou vídeo; vídeos com mais de ${STATUS_PART_MAX_SECONDS}s viram várias partes)`,
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
    sendWaitReply,
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
    let partPaths = [];
    let postedParts = 0;

    try {
      await sendWaitReact();

      /** @type {object[]} */
      let contents = [];

      if (isVideo) {
        const videoMessage = getContent(webMessage, "video");
        const declaredSeconds = Number(videoMessage?.seconds) || 0;

        if (declaredSeconds > STATUS_MAX_SECONDS) {
          throw new WarningError(
            `O vídeo pode ter no máximo ${MAX_VIDEO_IN_MINUTES} minutos! ` +
              `Esse tem ${formatDuration(declaredSeconds)}.`,
          );
        }

        filePath = await downloadVideo(webMessage, getRandomName());

        const seconds =
          (await getVideoDuration(filePath).catch(() => 0)) || declaredSeconds;

        if (seconds > STATUS_MAX_SECONDS) {
          throw new WarningError(
            `O vídeo pode ter no máximo ${MAX_VIDEO_IN_MINUTES} minutos! ` +
              `Esse tem ${formatDuration(seconds)}.`,
          );
        }

        if (seconds > STATUS_PART_MAX_SECONDS) {
          const parts = Math.ceil(seconds / STATUS_PART_MAX_SECONDS);

          await sendWaitReply(
            `O vídeo tem ${formatDuration(seconds)}, vou dividir em ${parts} partes e publicar uma atrás da outra.`,
          );
        }

        partPaths = await prepareStatusVideo(
          filePath,
          seconds || STATUS_PART_MAX_SECONDS,
        );

        const videoCaption = caption || videoMessage?.caption || "";

        contents = partPaths.map((partPath, index) => ({
          video: fs.readFileSync(partPath),
          caption: index === 0 ? videoCaption : "",
          mimetype: "video/mp4",
        }));
      } else if (isImage) {
        const imageMessage = getContent(webMessage, "image");

        filePath = await downloadImage(webMessage, getRandomName());

        contents = [
          {
            image: fs.readFileSync(filePath),
            caption: caption || imageMessage?.caption || "",
          },
        ];
      } else {
        const text = caption || replyText;

        if (!text) {
          throw new WarningError(
            "A mensagem marcada não tem texto, imagem nem vídeo!",
          );
        }

        contents = [{ text }];
      }

      for (const content of contents) {
        await postGroupStatus({ socket, remoteJid, content });
        postedParts++;
      }

      await sendSuccessReact();
      await sendSuccessReply(
        contents.length > 1
          ? `Publicado no status do grupo em ${contents.length} partes!`
          : "Publicado no status do grupo!",
      );
    } catch (error) {
      if (error instanceof WarningError || error instanceof InvalidParameterError) {
        throw error;
      }

      const progress =
        postedParts > 0 ? ` Consegui publicar só ${postedParts} parte(s).` : "";

      await sendErrorReply(
        `Não consegui publicar no status do grupo.${progress} ${error.message}`,
      );
    } finally {
      removeFileIfExists(filePath);
      partPaths.forEach((partPath) => removeFileIfExists(partPath));
    }
  },
};
