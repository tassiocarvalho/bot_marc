/**
 * Serviços de processamento de imagens usando ffmpeg.
 *
 * @author bot_marc
 */
import { exec } from "child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { TEMP_DIR } from "../config.js";
import { InvalidParameterError } from "../errors/index.js";
import { getRandomNumber, removeFileIfExists } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

const DEFAULT_FRAME_DELAY_IN_MILLISECONDS = 100;
const GIF_FPS = 30;

class Ffmpeg {
  constructor() {
    this.tempDir = TEMP_DIR;
  }

  async _executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          errorLog(`Command error: ${stderr}`);
          return reject(error);
        }
        resolve(stdout);
      });
    });
  }

  async _createTempFilePath(extension = "png") {
    return path.join(
      this.tempDir,
      `${getRandomNumber(10_000, 99_999)}.${extension}`,
    );
  }

  async applyBlur(inputPath, intensity = "7:5") {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf boxblur=${intensity} ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async convertToGrayscale(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf format=gray ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async mirrorImage(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf hflip ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async adjustContrast(inputPath, contrast = 1.2) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf eq=contrast=${contrast} ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async applyPixelation(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -i ${inputPath} -vf 'scale=iw/6:ih/6, scale=iw*10:ih*10:flags=neighbor' ${outputPath}`;
    await this._executeCommand(command);
    return outputPath;
  }

  async convertStickerToImage(inputPath) {
    const outputPath = await this._createTempFilePath();
    const command = `ffmpeg -y -i "${inputPath}" "${outputPath}"`;
    await this._executeCommand(command);
    return outputPath;
  }

  /**
   * Converte uma figurinha animada em MP4, o formato que o WhatsApp
   * reproduz como GIF. O ffmpeg não decodifica WebP animado, então o sharp
   * extrai os frames e o ffmpeg só faz a codificação.
   */
  async convertAnimatedStickerToGif(inputPath) {
    const {
      pages = 1,
      delay = [],
      width,
      pageHeight,
    } = await sharp(inputPath, { animated: true }).metadata();

    if (pages < 2) {
      throw new InvalidParameterError(
        "Essa figurinha não é animada! Use o comando toimage.",
      );
    }

    const framesDir = await fs.mkdtemp(path.join(this.tempDir, "gif-"));
    const outputPath = await this._createTempFilePath("mp4");

    try {
      const { data, info } = await sharp(inputPath, { animated: true })
        .flatten({ background: "#ffffff" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const frameSize = width * pageHeight * info.channels;
      const concatLines = ["ffconcat version 1.0"];

      for (let index = 0; index < pages; index++) {
        const frameName = `${index}.png`;

        await sharp(data.subarray(index * frameSize, (index + 1) * frameSize), {
          raw: { width, height: pageHeight, channels: info.channels },
        })
          .png({ compressionLevel: 1 })
          .toFile(path.join(framesDir, frameName));

        const delayInMilliseconds =
          delay[index] || DEFAULT_FRAME_DELAY_IN_MILLISECONDS;

        concatLines.push(
          `file ${frameName}`,
          `duration ${delayInMilliseconds / 1000}`,
        );
      }

      // O concat ignora a duração do último item se ele não for repetido.
      concatLines.push(`file ${pages - 1}.png`);

      const concatPath = path.join(framesDir, "frames.ffconcat");
      await fs.writeFile(concatPath, concatLines.join("\n"));

      const filters = `fps=${GIF_FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`;
      const command = `ffmpeg -nostdin -y -loglevel error -f concat -safe 0 -i "${concatPath}" -vf "${filters}" -c:v libx264 -movflags +faststart -an "${outputPath}"`;
      await this._executeCommand(command, { timeout: 60_000 });

      return outputPath;
    } catch (error) {
      removeFileIfExists(outputPath);
      throw error;
    } finally {
      await fs.rm(framesDir, { recursive: true, force: true });
    }
  }

  async cleanup(filePath) {
    removeFileIfExists(filePath);
  }
}

export { Ffmpeg };
