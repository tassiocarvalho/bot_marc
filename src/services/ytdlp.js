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
import {
  INSTAGRAM_COOKIES_FILE,
  TEMP_DIR,
  YTDLP_COOKIES_FILE,
  YTDLP_PROXY,
} from "../config.js";
import { WarningError } from "../errors/index.js";
import { getRandomName } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

const TIMEOUT_IN_MILLISECONDS = 300_000;
const MAX_BUFFER_IN_BYTES = 10 * 1024 * 1024;
const SEPARATOR = "|||";

const AUDIO_MAX_FILESIZE = "16M";
const VIDEO_MAX_FILESIZE = "64M";
const VIDEO_MAX_HEIGHT = 480;

// O YouTube quebra de tempos em tempos o "player client" que o yt-dlp usa por
// padrao: a extracao continua respondendo (titulo e duracao vem normal), mas a
// URL da midia devolve 403 na hora de baixar. Qual cliente funciona muda a cada
// mudanca deles, entao em vez de fixar um, tentamos em ordem e deixamos o
// padrao por ultimo -- ele volta a ser o melhor assim que o upstream conserta.
const YOUTUBE_CLIENTS = [null, "web_safari,mweb"];

// So vale trocar de cliente se o erro for do tipo que trocar resolve. Video
// privado, removido ou falta de rede falha igual em todos.
const isClientError = (details) =>
  /\b403\b|Forbidden|Requested format is not available|needs to be reloaded|Sign in to confirm|player response|nsig|Failed to extract/i.test(
    details,
  );

function buildError(message, details) {
  const error = new Error(message);

  error.details = details;

  return error;
}

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
              buildError(
                "O yt-dlp não está instalado ou não está no PATH do sistema.",
                details,
              ),
            );
            return;
          }

          if (error.killed) {
            reject(
              buildError("O download demorou demais e foi cancelado.", details),
            );
            return;
          }

          if (details.includes("confirm you") && details.includes("bot")) {
            reject(
              buildError(
                "O YouTube bloqueou este servidor. Configure YTDLP_COOKIES_FILE ou YTDLP_PROXY no config.js.",
                details,
              ),
            );
            return;
          }

          reject(
            buildError(
              "Não consegui baixar esse conteúdo do YouTube.",
              details,
            ),
          );
          return;
        }

        resolve(stdout.trim());
      },
    );
  });
}

/**
 * Roda o yt-dlp tentando cada player_client da lista ate um dar certo.
 *
 * O yt-dlp sai com codigo 0 mesmo quando aborta por --max-filesize, entao
 * codigo de saida sozinho nao prova sucesso: quem chama passa `validate` para
 * conferir se o arquivo esperado realmente apareceu.
 *
 * @param {string[]} args
 * @param {{beforeRetry?: () => void, validate?: () => boolean}} [hooks]
 */
async function runYtDlpWithFallback(args, hooks = {}) {
  const { beforeRetry, validate } = hooks;

  let lastError;

  for (const client of YOUTUBE_CLIENTS) {
    const clientArgs = client
      ? ["--extractor-args", `youtube:player_client=${client}`]
      : [];

    try {
      const output = await runYtDlp([...clientArgs, ...args]);

      if (!validate || validate()) {
        return output;
      }

      lastError = buildError(
        "O yt-dlp terminou sem gerar o arquivo esperado.",
        "saida vazia",
      );

      errorLog(
        `yt-dlp nao gerou arquivo com player_client=${client || "padrão"}.`,
      );
    } catch (error) {
      lastError = error;

      if (!isClientError(error.details || "")) {
        throw error;
      }

      errorLog(
        `yt-dlp falhou com player_client=${client || "padrão"}, tentando o proximo.`,
      );
    }

    beforeRetry?.();
  }

  throw lastError;
}

/**
 * Monta os argumentos de autenticacao/rede do yt-dlp.
 *
 * Sao necessarios quando o bot roda em nuvem: o YouTube bloqueia IPs de
 * datacenter e exige cookies de uma sessao logada ou um proxy residencial.
 *
 * @returns {string[]}
 */
function buildAuthArgs() {
  // Sem runtime JS o yt-dlp perde formatos do YouTube, e por padrao ele so
  // procura o deno. O node ja existe em qualquer ambiente que roda o bot.
  const args = ["--js-runtimes", "node"];

  if (YTDLP_COOKIES_FILE) {
    if (fs.existsSync(YTDLP_COOKIES_FILE)) {
      args.push("--cookies", YTDLP_COOKIES_FILE);
    } else {
      errorLog(
        `YTDLP_COOKIES_FILE aponta para um arquivo inexistente: ${YTDLP_COOKIES_FILE}`,
      );
    }
  }

  if (YTDLP_PROXY) {
    args.push("--proxy", YTDLP_PROXY);
  }

  return args;
}

const LOOKS_LIKE_LINK =
  /^(?:https?:\/\/|(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/)/i;
const YOUTUBE_HOST = /^(?:(?:www|m|music)\.)?youtube\.com$|^youtu\.be$/i;

/**
 * Valida um link digitado pelo usuário.
 *
 * Só o link remontado pelo URL chega ao yt-dlp: um texto solto como
 * "--exec comando" seria lido por ele como uma opção de linha de comando.
 *
 * @param {string} link
 * @returns {string | null}
 */
function parseYouTubeUrl(link) {
  try {
    const url = new URL(/^https?:/i.test(link) ? link : `https://${link}`);

    return YOUTUBE_HOST.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Lê os dados do primeiro vídeo de uma busca (ytsearch1:) ou de um link.
 *
 * @param {string} target
 * @returns {Promise<{title: string, channel: string, durationInSeconds: number, url: string, thumbnail: string} | null>}
 */
async function fetchVideoInfo(target) {
  const template = [
    "%(title)s",
    "%(channel)s",
    "%(duration)s",
    "%(webpage_url)s",
    "%(thumbnail)s",
    "%(is_live)s",
  ].join(SEPARATOR);

  const output = await runYtDlpWithFallback([
    ...buildAuthArgs(),
    "--no-playlist",
    "--playlist-items",
    "1",
    "--force-ipv4",
    "--no-warnings",
    "--skip-download",
    "--print",
    template,
    target,
  ]);

  if (!output) {
    return null;
  }

  const [title, channel, duration, url, thumbnail, isLive] = output
    .split("\n")[0]
    .split(SEPARATOR);

  if (!url) {
    return null;
  }

  // Sem esse corte, o yt-dlp grava a live até estourar o timeout.
  if (isLive === "True") {
    throw new WarningError("Não consigo baixar transmissões ao vivo!");
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
 * Encontra um vídeo do YouTube pelo nome ou por um link.
 *
 * @param {string} input Nome da música/vídeo ou link digitado pelo usuário.
 * @returns {ReturnType<typeof fetchVideoInfo>}
 */
export async function findOnYouTube(input) {
  const text = input.trim();

  if (!LOOKS_LIKE_LINK.test(text)) {
    return fetchVideoInfo(`ytsearch1:${text}`);
  }

  const url = parseYouTubeUrl(text.split(/\s+/)[0]);

  if (!url) {
    throw new WarningError("Só consigo baixar links do YouTube!");
  }

  return fetchVideoInfo(url);
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
    "--force-ipv4",
    "--no-warnings",
    "--no-progress",
    "--quiet",
    "--output",
    `${basePath}.%(ext)s`,
  ];

  const formatArgs = isAudio
    ? [
        "--format",
        "bestaudio[ext=m4a]/bestaudio/best",
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

  // Uma tentativa que falhou deixa .part e afins com o mesmo nome-base; sem
  // limpar, o yt-dlp da tentativa seguinte acha que ja baixou.
  const limparParciais = () => {
    try {
      const base = path.basename(basePath);

      for (const arquivo of fs.readdirSync(TEMP_DIR)) {
        if (arquivo.startsWith(`${base}.`)) {
          fs.unlinkSync(path.join(TEMP_DIR, arquivo));
        }
      }
    } catch {
      // limpeza best-effort: se falhar, a proxima tentativa e que sofre
    }
  };

  await runYtDlpWithFallback(
    [...buildAuthArgs(), ...commonArgs, ...formatArgs, url],
    {
      beforeRetry: limparParciais,
      validate: () => fs.existsSync(outputPath),
    },
  );
  if (!fs.existsSync(outputPath)) {
    throw new Error(
      isAudio
        ? "O áudio passou do limite de tamanho ou não pôde ser convertido."
        : "O vídeo passou do limite de tamanho ou não pôde ser convertido.",
    );
  }

  return outputPath;
}

const INSTAGRAM_HOST = /^(?:(?:www|m)\.)?instagram\.com$|^instagr\.am$/i;
const INSTAGRAM_MEDIA_PATH = /^\/(?:[\w.]+\/)?(?:reels?|p|tv|share)\//i;

/**
 * Valida um link do Instagram (reel, post ou IGTV) e devolve ele limpo, sem
 * os parâmetros de rastreio (?igsh=...). Igual ao YouTube, só o link
 * remontado chega ao yt-dlp.
 *
 * @param {string} input
 * @returns {string | null}
 */
export function parseInstagramUrl(input) {
  const link = String(input || "").trim().split(/\s+/)[0];

  try {
    const url = new URL(/^https?:/i.test(link) ? link : `https://${link}`);

    if (!INSTAGRAM_HOST.test(url.hostname)) {
      return null;
    }

    if (!INSTAGRAM_MEDIA_PATH.test(url.pathname)) {
      return null;
    }

    return `https://www.instagram.com${url.pathname}`;
  } catch {
    return null;
  }
}

function buildInstagramAuthArgs() {
  const args = [];
  const cookies = INSTAGRAM_COOKIES_FILE || YTDLP_COOKIES_FILE;

  if (cookies) {
    if (fs.existsSync(cookies)) {
      args.push("--cookies", cookies);
    } else {
      errorLog(`Arquivo de cookies do Instagram não existe: ${cookies}`);
    }
  }

  if (YTDLP_PROXY) {
    args.push("--proxy", YTDLP_PROXY);
  }

  return args;
}

/** Troca a mensagem genérica do yt-dlp por uma que explica o problema. */
function instagramError(details) {
  if (/login|log in|rate-limit|rate limit|cookies|checkpoint|401|429/i.test(details)) {
    return new WarningError(
      "O Instagram pediu login para liberar esse vídeo. O dono do bot precisa configurar INSTAGRAM_COOKIES_FILE.",
    );
  }

  if (/no video formats|There is no video|No video/i.test(details)) {
    return new WarningError("Esse post não tem vídeo, só foto!");
  }

  if (/private|not available|404|Unable to extract|doesn't exist/i.test(details)) {
    return new WarningError(
      "Não achei esse vídeo. Ele pode ser privado, ter sido apagado ou o link está errado.",
    );
  }

  return null;
}

const WHATSAPP_MAX_SIDE = 1280;

function runFfmpegTool(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: TIMEOUT_IN_MILLISECONDS, maxBuffer: MAX_BUFFER_IN_BYTES, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          errorLog(`${command} falhou: ${(stderr || error.message || "").trim()}`);
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

/**
 * Diz se o mp4 já toca no WhatsApp: H.264 8 bits (yuv420p), áudio AAC (ou
 * sem áudio) e no máximo WHATSAPP_MAX_SIDE de lado. Reels costumam vir em
 * VP9, AV1 ou HEVC, que o WhatsApp recusa com "algo errado com o arquivo".
 */
async function isWhatsAppFriendly(filePath) {
  try {
    const output = await runFfmpegTool("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,profile,pix_fmt,width,height",
      "-of",
      "json",
      filePath,
    ]);

    const streams = JSON.parse(output).streams || [];
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");

    if (!video) {
      return false;
    }

    return (
      video.codec_name === "h264" &&
      video.pix_fmt === "yuv420p" &&
      /baseline|main|^high$/i.test(video.profile || "") &&
      Math.max(video.width || 0, video.height || 0) <= WHATSAPP_MAX_SIDE &&
      (!audio || audio.codec_name === "aac")
    );
  } catch {
    return false;
  }
}

/** Converte para H.264/AAC num mp4 que o WhatsApp aceita. */
async function convertForWhatsApp(inputPath, outputPath) {
  await runFfmpegTool("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    `scale=w='min(${WHATSAPP_MAX_SIDE},iw)':h='min(${WHATSAPP_MAX_SIDE},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
    "-fpsmax",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-profile:v",
    "main",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

/**
 * Baixa o vídeo de um reel/post do Instagram em mp4 na pasta temporária,
 * já num formato que o WhatsApp toca. Em carrossel, pega o primeiro vídeo.
 *
 * @param {string} url link já validado por parseInstagramUrl
 * @returns {Promise<string>} caminho do mp4
 */
export async function downloadFromInstagram(url) {
  const basePath = path.resolve(TEMP_DIR, getRandomName());
  const downloadedPath = `${basePath}.mp4`;
  const convertedPath = `${basePath}-wa.mp4`;

  try {
    await runYtDlp([
      ...buildInstagramAuthArgs(),
      "--playlist-items",
      "1",
      "--force-ipv4",
      "--no-warnings",
      "--no-progress",
      "--quiet",
      "--format",
      [
        `bv*[vcodec^=avc1][height<=${WHATSAPP_MAX_SIDE}]+ba`,
        `b[vcodec^=avc1][height<=${WHATSAPP_MAX_SIDE}]`,
        "b[ext=mp4]",
        "bv*+ba",
        "b",
      ].join("/"),
      "--merge-output-format",
      "mp4",
      "--remux-video",
      "mp4",
      "--max-filesize",
      VIDEO_MAX_FILESIZE,
      "--output",
      `${basePath}.%(ext)s`,
      url,
    ]);
  } catch (error) {
    throw instagramError(error.details || "") ||
      new Error("Não consegui baixar esse vídeo do Instagram.");
  }

  if (!fs.existsSync(downloadedPath)) {
    throw new WarningError(
      "O vídeo passou do limite de tamanho ou não pôde ser convertido.",
    );
  }

  if (await isWhatsAppFriendly(downloadedPath)) {
    return downloadedPath;
  }

  try {
    await convertForWhatsApp(downloadedPath, convertedPath);
  } catch {
    fs.rmSync(convertedPath, { force: true });
    throw new Error("Baixei o vídeo, mas não consegui converter para o WhatsApp.");
  } finally {
    fs.rmSync(downloadedPath, { force: true });
  }

  return convertedPath;
}
