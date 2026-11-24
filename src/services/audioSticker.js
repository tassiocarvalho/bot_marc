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

/** Mesmos parâmetros do /sticker de vídeo, cortado nos primeiros segundos. */
async function videoToAnimatedWebp(inputPath, outputPath) {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-t",
    String(AUDIO_STICKER_MAX_SECONDS),
    "-i",
    inputPath,
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
async function videoToOpus(inputPath, outputPath) {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-t",
    String(AUDIO_STICKER_MAX_SECONDS),
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
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

  const webpPath = path.resolve(TEMP_DIR, getRandomName("webp"));
  const audioPath = path.resolve(TEMP_DIR, getRandomName("ogg"));
  let stickerPath = null;

  try {
    await Promise.all([
      videoToAnimatedWebp(videoPath, webpPath),
      videoToOpus(videoPath, audioPath),
    ]);

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
          seconds: Math.max(
            1,
            Math.round(Math.min(seconds || 0, AUDIO_STICKER_MAX_SECONDS)),
          ),
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
    removeFileIfExists(webpPath);
    removeFileIfExists(audioPath);
    removeFileIfExists(stickerPath);
  }
}
