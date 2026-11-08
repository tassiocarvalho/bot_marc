import { PREFIX } from "../../config.js";
import { InvalidParameterError } from "../../errors/index.js";
import { Ffmpeg } from "../../services/ffmpeg.js";
import { getRandomName, removeFileIfExists } from "../../utils/index.js";

export default {
  name: "togif",
  description: "Transformo figurinhas animadas em GIF",
  commands: ["togif", "gif"],
  usage: `${PREFIX}togif (marque a figurinha) ou ${PREFIX}togif (responda a figurinha)`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    isSticker,
    downloadSticker,
    webMessage,
    sendWaitReact,
    sendSuccessReact,
    sendGifFromFile,
  }) => {
    if (!isSticker) {
      throw new InvalidParameterError("Você precisa enviar uma figurinha!");
    }

    await sendWaitReact();

    const ffmpeg = new Ffmpeg();
    let inputPath = null;
    let outputPath = null;

    try {
      inputPath = await downloadSticker(webMessage, getRandomName());
      outputPath = await ffmpeg.convertAnimatedStickerToGif(inputPath);
      await sendSuccessReact();
      await sendGifFromFile(outputPath);
    } finally {
      removeFileIfExists(inputPath);
      removeFileIfExists(outputPath);
    }
  },
};
