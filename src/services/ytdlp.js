/**
 * Serviço de busca e download do YouTube usando yt-dlp.
 *
 * Os argumentos são passados via execFile (array), nunca interpolados em
 * uma string de shell, porque a busca vem do texto que o usuário envia.
 *
 * @author bot_marc
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../config.js";
import { getRandomName } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

const TIMEOUT_IN_MILLISECONDS = 300_000;
const MAX_BUFFER_IN_BYTES = 10 * 1024 * 1024;
const SEPARATOR = "|||";

const AUDIO_MAX_FILESIZE = "16M";
const VIDEO_MAX_FILESIZE = "64M";
const VIDEO_MAX_HEIGHT = 480;

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      {
        timeout: TIMEOUT_IN_MILLISECONDS,
        maxBuffer: MAX_BUFFER_IN_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const details = (stderr || error.message || "").trim();

          errorLog(`yt-dlp falhou: ${details}`);

          if (error.code === "ENOENT") {
            reject(
              new Error(
                "O yt-dlp não está instalado ou não está no PATH do sistema.",
              ),
            );
            return;
          }

          if (error.killed) {
            reject(new Error("O download demorou demais e foi cancelado."));
            return;
          }

          reject(new Error("Não consegui baixar esse conteúdo do YouTube."));
          return;
        }

        resolve(stdout.trim());
      },
    );
  });
}

/**
 * Busca o primeiro resultado do YouTube para o termo informado.
 *
 * @param {string} query Termo de busca digitado pelo usuário.
 * @returns {Promise<{title: string, channel: string, durationInSeconds: number, url: string, thumbnail: string} | null>}
 */
export async function searchOnYouTube(query) {
  const template = [
    "%(title)s",
    "%(channel)s",
    "%(duration)s",
    "%(webpage_url)s",
    "%(thumbnail)s",
  ].join(SEPARATOR);

  const output = await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--print",
    template,
    `ytsearch1:${query}`,
  ]);

  if (!output) {
    return null;
  }

  const [title, channel, duration, url, thumbnail] = output
    .split("\n")[0]
    .split(SEPARATOR);

  if (!url) {
    return null;
  }

  return {
    title: title || "Sem título",
    channel: channel || "Desconhecido",
    durationInSeconds: Number(duration) || 0,
    url,
    thumbnail: thumbnail && thumbnail !== "NA" ? thumbnail : null,
  };
}

/**
 * Baixa um vídeo do YouTube como mp3 ou mp4 na pasta temporária.
 *
 * @param {{url: string, type: "audio" | "video"}} params
 * @returns {Promise<string>} Caminho do arquivo baixado.
 */
export async function downloadFromYouTube({ url, type }) {
  const isAudio = type === "audio";
  const extension = isAudio ? "mp3" : "mp4";
  const basePath = path.resolve(TEMP_DIR, getRandomName());
  const outputPath = `${basePath}.${extension}`;

  const commonArgs = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--quiet",
    "--output",
    `${basePath}.%(ext)s`,
  ];

  const formatArgs = isAudio
    ? [
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "5",
        "--max-filesize",
        AUDIO_MAX_FILESIZE,
      ]
    : [
        "--format",
        [
          `bv*[vcodec^=avc1][height<=${VIDEO_MAX_HEIGHT}]+ba[acodec^=mp4a]`,
          `b[vcodec^=avc1][height<=${VIDEO_MAX_HEIGHT}]`,
          `bv*[height<=${VIDEO_MAX_HEIGHT}]+ba`,
          `b[height<=${VIDEO_MAX_HEIGHT}]`,
          "b",
        ].join("/"),
        "--merge-output-format",
        "mp4",
        "--postprocessor-args",
        "ffmpeg:-movflags +faststart",
        "--max-filesize",
        VIDEO_MAX_FILESIZE,
      ];

  await runYtDlp([...commonArgs, ...formatArgs, url]);

  if (!fs.existsSync(outputPath)) {
    throw new Error(
      isAudio
        ? "O áudio passou do limite de tamanho ou não pôde ser convertido."
        : "O vídeo passou do limite de tamanho ou não pôde ser convertido.",
    );
  }

  return outputPath;
}
