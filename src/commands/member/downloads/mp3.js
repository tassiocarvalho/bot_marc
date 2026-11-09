/**
 * Encontra no YouTube (por nome ou link) e devolve o áudio em mp3.
 *
 * @author bot_marc
 */
import {
  MAX_DOWNLOAD_DURATION_IN_MINUTES,
  PREFIX,
} from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { withDownloadQueue } from "../../../services/download-queue.js";
import {
  downloadFromYouTube,
  findOnYouTube,
} from "../../../services/ytdlp.js";
import {
  formatSecondsToMinutesAndSeconds,
  removeFileIfExists,
} from "../../../utils/index.js";

export default {
  name: "mp3",
  description: "Busco a música no YouTube, por nome ou link, e envio o mp3",
  commands: [
    "mp3",
    "play",
    "play-audio",
    "pa",
    "yt-mp3",
    "youtube-mp3",
    "yt-audio",
    "youtube-audio",
  ],
  usage: `${PREFIX}play Billie Jean`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: withDownloadQueue("mp3", async ({
    sendAudioFromFile,
    sendImageFromURL,
    sendReply,
    fullArgs,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa me dizer o nome da música ou enviar um link do YouTube!",
      );
    }

    await sendWaitReact();

    const data = await findOnYouTube(fullArgs);

    if (!data) {
      throw new WarningError("Não encontrei nada com esse nome!");
    }

    if (data.durationInSeconds > MAX_DOWNLOAD_DURATION_IN_MINUTES * 60) {
      throw new WarningError(
        `Só baixo conteúdo de até ${MAX_DOWNLOAD_DURATION_IN_MINUTES} minutos! Esse tem ${formatSecondsToMinutesAndSeconds(
          data.durationInSeconds,
        )}.`,
      );
    }

    let filePath = null;

    try {
      filePath = await downloadFromYouTube({ url: data.url, type: "audio" });

      await sendSuccessReact();

      const caption = `*Título*: ${data.title}

*Canal*: ${data.channel}
*Duração*: ${formatSecondsToMinutesAndSeconds(data.durationInSeconds)}
*Link*: ${data.url}`;

      if (data.thumbnail) {
        await sendImageFromURL(data.thumbnail, caption);
      } else {
        await sendReply(caption);
      }

      await sendAudioFromFile(filePath);
    } catch (error) {
      await sendErrorReply(error.message);
    } finally {
      removeFileIfExists(filePath);
    }
  }),
};
