/**
 * Figurinha com som a partir de um vídeo.
 *
 * @author bot_marc
 */
import { BOT_EMOJI, PREFIX, STICKER_AUTHOR } from "../../config.js";
import { InvalidParameterError, WarningError } from "../../errors/index.js";
import {
  AUDIO_STICKER_MAX_SECONDS,
  sendAudioSticker,
} from "../../services/audioSticker.js";
import {
  getContent,
  getRandomName,
  getUserName,
  removeFileIfExists,
} from "../../utils/index.js";

export default {
  name: "sticker-som",
  description: `Cria figurinha com som a partir de um vídeo (usa os primeiros ${AUDIO_STICKER_MAX_SECONDS}s).`,
  commands: ["fsom", "stickersom", "sticker-som", "figsom", "ssom"],
  usage: `${PREFIX}fsom (marque ou responda um vídeo com som)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    socket,
    remoteJid,
    webMessage,
    userLid,
    isVideo,
    downloadVideo,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
  }) => {
    if (!isVideo) {
      throw new InvalidParameterError(
        "Marque ou responda um vídeo com som para virar figurinha com som!",
      );
    }

    let videoPath = null;

    try {
      await sendWaitReact();

      const seconds = Number(getContent(webMessage, "video")?.seconds) || 0;

      videoPath = await downloadVideo(webMessage, getRandomName());

      await sendAudioSticker({
        socket,
        remoteJid,
        webMessage,
        videoPath,
        seconds,
        metadata: {
          username: getUserName(webMessage, userLid),
          botName: `${BOT_EMOJI} ${STICKER_AUTHOR}`,
        },
      });

      await sendSuccessReact();
    } catch (error) {
      if (
        error instanceof WarningError ||
        error instanceof InvalidParameterError
      ) {
        throw error;
      }

      await sendErrorReply(
        `Não consegui criar a figurinha com som. ${error.message}`,
      );
    } finally {
      removeFileIfExists(videoPath);
    }
  },
};
