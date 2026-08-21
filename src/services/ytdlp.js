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
  TEMP_DIR,
  YTDLP_COOKIES_FILE,
  YTDLP_PROXY,
} from "../config.js";
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
  const args = [];

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

  const output = await runYtDlpWithFallback([
    ...buildAuthArgs(),
    "--no-playlist",
    "--force-ipv4",
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
