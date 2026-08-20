/**
 * Busca no YouTube e devolve o vídeo em mp4.
 *
 * @author bot_marc
 */
import {
  MAX_DOWNLOAD_DURATION_IN_MINUTES,
  PREFIX,
} from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import {
  downloadFromYouTube,
  searchOnYouTube,
} from "../../../services/ytdlp.js";
import {
  formatSecondsToMinutesAndSeconds,
  removeFileIfExists,
} from "../../../utils/index.js";

export default {
  name: "mp4",
  description: "Busco o vídeo no YouTube e envio o mp4",
  commands: ["mp4"],
  usage: `${PREFIX}mp4 Sweet Child O Mine`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    sendVideoFromFile,
    fullArgs,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa me dizer o nome do vídeo!",
      );
    }

    await sendWaitReact();

    const data = await searchOnYouTube(fullArgs);

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
      filePath = await downloadFromYouTube({ url: data.url, type: "video" });

      await sendSuccessReact();

      await sendVideoFromFile(
        filePath,
        `*Título*: ${data.title}

*Canal*: ${data.channel}
*Duração*: ${formatSecondsToMinutesAndSeconds(data.durationInSeconds)}
*Link*: ${data.url}`,
      );
    } catch (error) {
      await sendErrorReply(error.message);
    } finally {
      removeFileIfExists(filePath);
    }
  },
};
