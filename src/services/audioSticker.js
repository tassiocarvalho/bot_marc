/**
 * Figurinha com som.
 *
 * O WhatsApp (ainda em beta no Android) manda a figurinha com som como
 * `audioStickerMessage` → `message.stickerMessage`, com o áudio em
 * `stickerMessage.audioMessage`. Aqui o vídeo vira a figurinha animada de
 * sempre e o som do próprio vídeo vai junto em ogg/opus. Quem não tem a
 * novidade vê só a figurinha animada.
 *
 * @author bot_marc
 */
import {
  generateWAMessageContent,
  generateWAMessageFromContent,
} from "baileys";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../config.js";
import { WarningError } from "../errors/index.js";
import "../utils/audioStickerProto.js";
import { getRandomName, removeFileIfExists } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";
import { addStickerMetadata } from "./sticker.js";

export const AUDIO_STICKER_MAX_SECONDS = 10;

const AUDIO_MIMETYPE = "audio/ogg; codecs=opus";
const FFMPEG_TIMEOUT_MS = 2 * 60_000;

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
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

async function hasAudioStream(inputPath) {
  const output = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    inputPath,
  ]);

  return output.trim().length > 0;
}

/**
 * Duração em segundos de um stream (`v:0`, `a:0`) ou do arquivo todo.
 * Devolve 0 se o ffprobe não souber.
 */
async function probeDuration(inputPath, stream = null) {
  const args = ["-v", "error"];

  if (stream) {
    args.push("-select_streams", stream, "-show_entries", "stream=duration");
  } else {
    args.push("-show_entries", "format=duration");
  }

  args.push("-of", "default=noprint_wrappers=1:nokey=1", inputPath);

  const seconds = Number.parseFloat((await run("ffprobe", args)).trim());

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

const MAX_TIMING_DRIFT_SECONDS = 0.1;
const MAX_FPS = 30;

/** "60000/1001" → 59.94 */
function parseFrameRate(value) {
  const [numerator, denominator = 1] = String(value || "0")
    .split("/")
    .map(Number);

  return denominator ? numerator / denominator : 0;
}

/**
 * Diz se o vídeo precisa ser renderizado de novo antes de virar figurinha:
 * - maior que o limite da figurinha (corta imagem e som juntos);
 * - imagem ou som não começam no zero, ou começam em tempos diferentes
 *   (típico do corte no editor do WhatsApp);
 * - o som dura mais que a imagem (sobrou áudio do vídeo original);
 * - FPS acima de MAX_FPS (vídeo de 60 FPS pesa e trava na conversão).
 * Se o ffprobe não conseguir ler, renderiza por garantia.
 */
async function needsRender(inputPath) {
  try {
    const output = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,start_time,duration,r_frame_rate,avg_frame_rate",
      "-of",
      "json",
      inputPath,
    ]);

    const streams = JSON.parse(output).streams || [];
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");

    if (!video || !audio) {
      return true;
    }

    const videoStart = Number(video.start_time) || 0;
    const audioStart = Number(audio.start_time) || 0;
    const videoDuration = Number(video.duration) || 0;
    const audioDuration = Number(audio.duration) || 0;

    if (!videoDuration || !audioDuration) {
      return true;
    }

    const fps = Math.max(
      parseFrameRate(video.avg_frame_rate),
      parseFrameRate(video.r_frame_rate),
    );

    return (
      videoDuration > AUDIO_STICKER_MAX_SECONDS ||
      fps > MAX_FPS + 0.5 ||
      Math.abs(videoStart) > MAX_TIMING_DRIFT_SECONDS ||
      Math.abs(audioStart) > MAX_TIMING_DRIFT_SECONDS ||
      Math.abs(audioStart - videoStart) > MAX_TIMING_DRIFT_SECONDS ||
      audioDuration > videoDuration + MAX_TIMING_DRIFT_SECONDS * 3
    );
  } catch {
    return true;
  }
}

/**
 * Recodifica o trecho num MP4 limpo: imagem e som começando juntos no
 * zero, no máximo MAX_FPS, sem edit list nem metadados. Vídeo cortado no
 * editor do WhatsApp costuma ter o áudio deslocado, e o ogg gerado dele não
 * toca na figurinha.
 * Se o som começar depois da imagem, o início é preenchido com silêncio
 * para continuar sincronizado.
 */
async function renderCleanClip(inputPath, outputPath, limit) {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-t",
    limit.toFixed(3),
    "-vf",
    "setpts=PTS-STARTPTS,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    "-fpsmax",
    String(MAX_FPS),
    "-af",
    "aresample=48000:async=1:first_pts=0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ac",
    "2",
    "-map_metadata",
    "-1",
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

/** Mesmos parâmetros do /sticker de vídeo, cortado em `limit` segundos. */
async function videoToAnimatedWebp(inputPath, outputPath, limit) {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-t",
    limit.toFixed(3),
    "-vf",
    "scale=350:350,fps=15",
    "-c:v",
    "libwebp",
    "-loop",
    "0",
    "-quality",
    "8",
    "-compression_level",
    "6",
    "-method",
    "6",
    "-preset",
    "picture",
    "-an",
    "-f",
    "webp",
    outputPath,
  ]);
}

/** Som em opus mono 48 kHz, o mesmo formato dos áudios do WhatsApp. */
async function videoToOpus(inputPath, outputPath, limit) {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-t",
    limit.toFixed(3),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
    "-map_metadata",
    "-1",
    "-avoid_negative_ts",
    "make_zero",
    "-f",
    "ogg",
    outputPath,
  ]);
}

/**
 * @param {object} params
 * @param {object} params.socket
 * @param {string} params.remoteJid
 * @param {object} params.webMessage mensagem que será citada
 * @param {string} params.videoPath vídeo já baixado
 * @param {number} params.seconds duração do vídeo
 * @param {{username: string, botName: string}} params.metadata
 */
export async function sendAudioSticker({
  socket,
  remoteJid,
  webMessage,
  videoPath,
  seconds,
  metadata,
}) {
  if (!(await hasAudioStream(videoPath))) {
    throw new WarningError(
      "Esse vídeo não tem som! Mande um vídeo com áudio para virar figurinha com som.",
    );
  }

  const renderedPath = path.resolve(TEMP_DIR, getRandomName("mp4"));
  const webpPath = path.resolve(TEMP_DIR, getRandomName("webp"));
  const audioPath = path.resolve(TEMP_DIR, getRandomName("ogg"));
  let stickerPath = null;

  try {
    // Vídeo cortado no editor do WhatsApp pode trazer o áudio inteiro do
    // original ou com o tempo deslocado. O som é cortado na duração real do
    // vídeo para não sobrar áudio além da animação.
    const videoSeconds =
      (await probeDuration(videoPath, "v:0").catch(() => 0)) ||
      seconds ||
      AUDIO_STICKER_MAX_SECONDS;
    const limit = Math.min(videoSeconds, AUDIO_STICKER_MAX_SECONDS);

    // Só renderiza de novo (vídeo e som juntos, como um editor faz) quando
    // o arquivo precisa; vídeo já certinho segue direto.
    let sourcePath = videoPath;

    if (await needsRender(videoPath)) {
      await renderCleanClip(videoPath, renderedPath, limit);
      sourcePath = renderedPath;
    }

    await Promise.all([
      videoToAnimatedWebp(sourcePath, webpPath, limit),
      videoToOpus(sourcePath, audioPath, limit),
    ]);

    const audioSeconds =
      (await probeDuration(audioPath).catch(() => 0)) || limit;

    stickerPath = await addStickerMetadata(
      await fs.promises.readFile(webpPath),
      metadata,
    );

    const upload = { upload: socket.waUploadToServer };

    const [{ stickerMessage }, { audioMessage }] = await Promise.all([
      generateWAMessageContent(
        { sticker: await fs.promises.readFile(stickerPath) },
        upload,
      ),
      generateWAMessageContent(
        {
          audio: await fs.promises.readFile(audioPath),
          mimetype: AUDIO_MIMETYPE,
          seconds: Math.max(1, Math.round(audioSeconds)),
        },
        upload,
      ),
    ]);

    const waMessage = generateWAMessageFromContent(
      remoteJid,
      {
        audioStickerMessage: {
          message: {
            stickerMessage: {
              ...stickerMessage,
              isAnimated: true,
              audioMessage,
            },
          },
        },
      },
      {
        quoted: JSON.parse(JSON.stringify(webMessage)),
        userJid: socket.user?.id,
      },
    );

    await socket.relayMessage(remoteJid, waMessage.message, {
      messageId: waMessage.key.id,
    });

    return waMessage;
  } finally {
    removeFileIfExists(renderedPath);
    removeFileIfExists(webpPath);
    removeFileIfExists(audioPath);
    removeFileIfExists(stickerPath);
  }
}
