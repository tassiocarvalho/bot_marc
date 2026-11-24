/**
 * Baixa o vídeo de um reel/post do Instagram com o yt-dlp, de graça, sem
 * API paga.
 *
 * @author bot_marc
 */
import { PREFIX } from "../../../config.js";
import { InvalidParameterError, WarningError } from "../../../errors/index.js";
import { withDownloadQueue } from "../../../services/download-queue.js";
import {
  downloadFromInstagram,
  parseInstagramUrl,
} from "../../../services/ytdlp.js";
import { removeFileIfExists } from "../../../utils/index.js";

export default {
  name: "instagram",
  description: "Baixo vídeos e reels do Instagram",
  commands: ["instagram", "ig", "inst", "insta"],
  usage: `${PREFIX}insta https://www.instagram.com/reel/Cx789012345/`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: withDownloadQueue("instagram", async ({
    sendVideoFromFile,
    fullArgs,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError(
        "Você precisa enviar o link de um reel ou post do Instagram!",
      );
    }

    const url = parseInstagramUrl(fullArgs);

    if (!url) {
      throw new WarningError(
        "Esse link não é de um reel ou post do Instagram!",
      );
    }

    await sendWaitReact();

    let filePath = null;

    try {
      filePath = await downloadFromInstagram(url);

      await sendSuccessReact();

      await sendVideoFromFile(filePath);
    } catch (error) {
      if (error instanceof WarningError) {
        throw error;
      }

      await sendErrorReply(error.message);
    } finally {
      removeFileIfExists(filePath);
    }
  }),
};
