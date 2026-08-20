/**
 * Busca no YouTube e devolve o áudio em mp3.
 *
 * @author bot_marc
 */
import { PREFIX } from "../../../config.js";
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
  name: "mp3",
  description: "Busco a música no YouTube e envio o mp3",
  commands: ["mp3"],
  usage: `${PREFIX}mp3 Sweet Child O Mine`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
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
        "Você precisa me dizer o nome da música!",
      );
    }

    await sendWaitReact();

    const data = await searchOnYouTube(fullArgs);

    if (!data) {
      throw new WarningError("Não encontrei nada com esse nome!");
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
  },
};
