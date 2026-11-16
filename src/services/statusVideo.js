/**
 * Prepara vídeos para o status do grupo.
 *
 * O WhatsApp recusa status de vídeo longo ou pesado (a publicação fica com
 * o "X" de falha). Aqui o vídeo é dividido em partes de até
 * STATUS_PART_MAX_SECONDS, como o próprio WhatsApp faz, e cada parte é
 * recodificada em H.264/AAC com o tamanho limitado a STATUS_PART_MAX_MB.
 *
 * @author bot_marc
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { TEMP_DIR } from "../config.js";
import { getRandomName, removeFileIfExists } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

export const STATUS_PART_MAX_SECONDS = 59;
export const STATUS_MAX_SECONDS = 10 * 60;

const STATUS_PART_MAX_MB = 14;
const MAX_SHORT_SIDE = 720;
const MAX_VIDEO_KBPS = 2500;
const MIN_VIDEO_KBPS = 400;
const AUDIO_KBPS = 128;
const ENCODE_TIMEOUT_MS = 5 * 60_000;

function run(command, args, timeout = ENCODE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          errorLog(`${command} falhou: ${stderr || error.message}`);
          return reject(error);
        }

        resolve(stdout);
      },
    );
  });
}

export async function getVideoDuration(inputPath) {
  const output = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ],
    30_000,
  );

  const seconds = Number.parseFloat(output.trim());

  return Number.isFinite(seconds) ? seconds : 0;
}

/**
 * Divide em partes de tamanho parecido, para não sobrar um pedaço de 2s
 * no final.
 */
export function planParts(durationInSeconds) {
  const count = Math.max(
    1,
    Math.ceil(durationInSeconds / STATUS_PART_MAX_SECONDS),
  );
  const length = durationInSeconds / count;

  return Array.from({ length: count }, (_, index) => ({
    start: index * length,
    length,
  }));
}

function videoKbpsFor(lengthInSeconds) {
  const totalKbps = (STATUS_PART_MAX_MB * 8 * 1024) / lengthInSeconds;

  return Math.round(
    Math.min(MAX_VIDEO_KBPS, Math.max(MIN_VIDEO_KBPS, totalKbps - AUDIO_KBPS)),
  );
}

async function encodePart(inputPath, { start, length }) {
  const outputPath = path.join(TEMP_DIR, getRandomName("mp4"));
  const kbps = videoKbpsFor(length);

  // Lado menor limitado a 720px, mantendo a proporção (vale para vídeo em
  // pé e deitado) e com dimensões pares, que o H.264 exige.
  const scale =
    `scale='if(gte(iw,ih),-2,min(${MAX_SHORT_SIDE},iw))':` +
    `'if(gte(iw,ih),min(${MAX_SHORT_SIDE},ih),-2)',format=yuv420p`;

  try {
    await run("ffmpeg", [
      "-nostdin",
      "-y",
      "-loglevel",
      "error",
      "-ss",
      start.toFixed(3),
      "-t",
      length.toFixed(3),
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      scale,
      "-fpsmax",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "main",
      "-b:v",
      `${kbps}k`,
      "-maxrate",
      `${kbps}k`,
      "-bufsize",
      `${kbps * 2}k`,
      "-c:a",
      "aac",
      "-b:a",
      `${AUDIO_KBPS}k`,
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return outputPath;
  } catch (error) {
    removeFileIfExists(outputPath);
    throw error;
  }
}

/**
 * Gera as partes do vídeo prontas para o status. Quem chama deve apagar os
 * arquivos devolvidos.
 *
 * @param {string} inputPath
 * @param {number} durationInSeconds
 * @returns {Promise<string[]>}
 */
export async function prepareStatusVideo(inputPath, durationInSeconds) {
  const outputs = [];

  try {
    for (const part of planParts(durationInSeconds)) {
      outputs.push(await encodePart(inputPath, part));
    }

    return outputs;
  } catch (error) {
    outputs.forEach(removeFileIfExists);
    throw error;
  }
}
