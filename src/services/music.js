/**
 * /play: acha a música certa e baixa o MP3 completo pelo SoundCloud.
 *
 * Por que assim: o YouTube bloqueia o download a partir de IPs de datacenter,
 * mas a *busca* continua funcionando. Então o YouTube serve só de referência
 * (nome correto da música, artista e duração oficial) e o áudio vem do
 * SoundCloud, que não bloqueia.
 *
 * Para não mandar a música errada:
 *  - prévias de 30s são descartadas (faixas de gravadora sem assinatura);
 *  - remix, slowed, speed up, cover, ao vivo etc. são descartados, a menos
 *    que a pessoa tenha pedido essa versão;
 *  - o título precisa conter o nome da música;
 *  - a duração precisa bater com a oficial (tolerância pequena);
 *  - depois de baixar, o MP3 é medido. Se não bater, tenta o próximo.
 *  - se nada passar, avisa que não encontrou, em vez de mandar errado.
 *
 * O yt-dlp é chamado via execFile (sem shell), porque a busca vem do usuário.
 *
 * @author bot_marc
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../config.js";
import { getRandomName } from "../utils/index.js";
import { errorLog } from "../utils/logger.js";

const SEARCH_TIMEOUT_MS = 45_000;
const DOWNLOAD_TIMEOUT_MS = 150_000;
const MAX_BUFFER = 20 * 1024 * 1024;

const MIN_SONG_SECONDS = 45;
const MAX_CANDIDATES_TO_DOWNLOAD = 3;
const MAX_PARALLEL_DOWNLOADS = 2;

/** Palavras que indicam outra versão da música. */
const UNWANTED_VERSIONS = [
  "remix", "slowed", "reverb", "sped up", "speed up", "spedup", "nightcore",
  "8d", "cover", "karaoke", "instrumental", "acapella", "a capella",
  "bass boosted", "boosted", "com grave", "mashup", "bootleg", "remake",
  "ao vivo", "live", "edit", "vip", "flip", "loop", "1 hour", "1 hora",
  "versao", "version", "mix", "medley", "parody", "parodia", "tutorial",
  "trecho", "preview", "snippet", "megafunk", "mega funk", "rework",
];

/** Lixo comum em títulos do YouTube que não é parte do nome da música. */
const TITLE_NOISE =
  /\b(official|oficial|video|clipe|clip|audio|áudio|music|musica|música|lyrics?|letra|legendado|tradução|traducao|hd|hq|4k|visualizer|videoclipe|download|baixar|feat|ft|prod)\b/gi;

const STOPWORDS = new Set([
  "the", "a", "o", "e", "de", "da", "do", "das", "dos", "and", "of", "to",
  "in", "na", "no", "em", "um", "uma", "me", "mc", "dj", "x", "vs",
]);

export const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (text) =>
  normalize(text)
    .split(" ")
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));

const hasPhrase = (haystack, phrase) =>
  ` ${normalize(haystack)} `.includes(` ${normalize(phrase)} `);

/** Versões indesejadas presentes no texto que o usuário NÃO pediu. */
export function unwantedIn(text, query) {
  return UNWANTED_VERSIONS.filter(
    (word) => hasPhrase(text, word) && !hasPhrase(query, word)
  );
}

/** Remove parênteses, colchetes e ruído de título do YouTube. */
export function cleanTitle(title) {
  return String(title || "")
    .replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, " ")
    .replace(/["“”'`´]/g, "")
    .replace(TITLE_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const cleanChannel = (channel) =>
  String(channel || "")
    .replace(/\s*-\s*topic$/i, "")
    .replace(/vevo$/i, "")
    .replace(/\b(oficial|official|tv|channel|canal)\b/gi, "")
    .trim();

/**
 * Separa "Artista - Música" em { artist, song } usando o canal como pista.
 */
export function splitArtistSong(title, channel) {
  const cleaned = cleanTitle(title);
  const parts = cleaned.split(/\s+[-–—|:]\s+/).map((part) => part.trim()).filter(Boolean);
  const channelTokens = tokens(cleanChannel(channel));

  if (parts.length >= 2) {
    const overlap = (part) => tokens(part).filter((t) => channelTokens.includes(t)).length;
    // A parte mais parecida com o canal é o artista; a outra, a música.
    if (overlap(parts[1]) > overlap(parts[0])) {
      return { artist: parts[1], song: parts[0] };
    }
    return { artist: parts[0], song: parts.slice(1).join(" ") };
  }

  return { artist: cleanChannel(channel), song: cleaned };
}

function run(args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      { timeout, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const details = (stderr || error.message || "").trim();
          if (error.code === "ENOENT") {
            return reject(new Error("O yt-dlp não está instalado no servidor."));
          }
          const failure = new Error(error.killed ? "A busca demorou demais." : "Falha no yt-dlp.");
          failure.details = details;
          return reject(failure);
        }
        resolve(stdout);
      }
    );
  });
}

const parseJsonLines = (output) =>
  output
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

async function flatSearch(prefix, query, count) {
  const output = await run(
    ["--no-warnings", "--force-ipv4", "--flat-playlist", "--dump-json", `${prefix}${count}:${query}`],
    SEARCH_TIMEOUT_MS
  );
  return parseJsonLines(output);
}

/**
 * Escolhe, entre os resultados do YouTube, a referência da música
 * (título/artista/capa) e a faixa de durações aceitáveis.
 */
export function pickReference(results, query) {
  const videos = results
    .map((item, index) => ({
      index,
      id: item.id,
      title: item.title || "",
      channel: item.channel || item.uploader || "",
      duration: Number(item.duration) || 0,
    }))
    .filter((v) => v.id && v.duration >= MIN_SONG_SECONDS && v.duration <= 15 * 60);

  if (!videos.length) return null;

  const score = (v) => {
    let s = -v.index * 2;
    const text = `${v.title} ${v.channel}`;
    if (/ - topic$/i.test(v.channel)) s += 8;
    if (/official audio|audio oficial|áudio oficial/i.test(v.title)) s += 6;
    if (/official|oficial/i.test(v.title)) s += 3;
    s -= unwantedIn(text, query).length * 10;
    if (/full scene|trailer|reaction|react|explica|analise|análise/i.test(v.title)) s -= 10;
    return s;
  };

  const best = [...videos].sort((a, b) => score(b) - score(a))[0];
  const { artist, song } = splitArtistSong(best.title, best.channel);
  const songTokens = tokens(song);

  // Durações de outros vídeos da MESMA música (lyric video, áudio oficial...)
  // formam a faixa aceitável — vídeos oficiais às vezes têm intro a mais.
  const sameSong = videos.filter((v) => {
    if (unwantedIn(v.title, query).length) return false;
    const vt = tokens(v.title);
    const hits = songTokens.filter((t) => vt.includes(t)).length;
    return songTokens.length ? hits / songTokens.length >= 0.75 : false;
  });
  const durations = (sameSong.length ? sameSong : [best]).map((v) => v.duration);

  return {
    id: best.id,
    title: best.title,
    channel: best.channel,
    artist,
    song,
    duration: best.duration,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    thumbnail: `https://i.ytimg.com/vi/${best.id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${best.id}`,
  };
}

/** Tolerância de duração: 5% ou 6s, o que for maior. */
export function durationFits(duration, ref) {
  const slack = (value) => Math.max(6, value * 0.05);
  return duration >= ref.minDuration - slack(ref.minDuration) &&
    duration <= ref.maxDuration + slack(ref.maxDuration);
}

export const isPreview = (duration) => duration >= 29 && duration <= 31.5;

/**
 * Filtra e ordena os resultados do SoundCloud contra a referência.
 * Sem referência (YouTube fora do ar), usa só o texto da busca.
 */
export function rankSoundCloud(results, { reference, query }) {
  const songTokens = tokens(reference ? reference.song : query);
  const artistTokens = tokens(reference ? reference.artist : "");

  return results
    .map((item, index) => ({
      index,
      url: item.url || item.webpage_url,
      title: item.title || "",
      uploader: item.uploader || "",
      duration: Number(item.duration) || 0,
    }))
    .filter((c) => {
      if (!c.url || !c.duration) return false;
      if (isPreview(c.duration) || c.duration < MIN_SONG_SECONDS) return false;
      if (unwantedIn(c.title, query).length) return false;

      const text = tokens(`${c.title} ${c.uploader}`);
      const songHits = songTokens.filter((t) => text.includes(t)).length;
      if (!songTokens.length || songHits / songTokens.length < 0.8) return false;

      if (reference) return durationFits(c.duration, reference);
      return c.duration <= 10 * 60;
    })
    .map((c) => {
      const uploader = tokens(c.uploader);
      const title = tokens(c.title);
      const artistInUploader = artistTokens.filter((t) => uploader.includes(t)).length;
      const artistInTitle = artistTokens.filter((t) => title.includes(t)).length;
      const center = reference ? (reference.minDuration + reference.maxDuration) / 2 : c.duration;

      const score =
        (artistTokens.length ? (artistInUploader / artistTokens.length) * 20 : 0) +
        (artistTokens.length ? (artistInTitle / artistTokens.length) * 8 : 0) -
        Math.abs(c.duration - center) / 4 -
        c.index;

      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
}

function probeDuration(file) {
  return new Promise((resolve) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { timeout: 20_000 },
      (error, stdout) => resolve(error ? 0 : Number(stdout.trim()) || 0)
    );
  });
}

let activeDownloads = 0;
const waiting = [];

async function withDownloadSlot(task) {
  if (activeDownloads >= MAX_PARALLEL_DOWNLOADS) {
    await new Promise((resolve) => waiting.push(resolve));
  }
  activeDownloads += 1;
  try {
    return await task();
  } finally {
    activeDownloads -= 1;
    waiting.shift()?.();
  }
}

async function downloadCandidate(candidate) {
  const base = path.resolve(TEMP_DIR, getRandomName());
  const file = `${base}.mp3`;

  try {
    await run(
      [
        "--no-warnings", "--no-progress", "--quiet", "--no-playlist",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "mp3", "--audio-quality", "160K",
        "--max-filesize", "25M",
        "-o", `${base}.%(ext)s`,
        candidate.url,
      ],
      DOWNLOAD_TIMEOUT_MS
    );
  } catch (error) {
    errorLog(`SoundCloud falhou (${candidate.title}): ${error.details || error.message}`);
  }

  // Remove sobras (.part, original antes da conversão).
  for (const name of fs.readdirSync(TEMP_DIR)) {
    const full = path.join(TEMP_DIR, name);
    if (name.startsWith(`${path.basename(base)}.`) && full !== file) {
      fs.rmSync(full, { force: true });
    }
  }

  return fs.existsSync(file) ? file : null;
}

/**
 * Busca e baixa a música.
 * @returns {Promise<{file: string, reference: object|null, track: object, duration: number}>}
 */
export async function findAndDownloadSong(query) {
  let reference = null;
  try {
    reference = pickReference(await flatSearch("ytsearch", query, 8), query);
  } catch (error) {
    errorLog(`Busca no YouTube falhou, seguindo só com o SoundCloud: ${error.details || error.message}`);
  }

  const searches = reference
    ? [`${reference.artist} ${reference.song}`, reference.song, query]
    : [query];

  const seen = new Set();
  let candidates = [];
  for (const search of [...new Set(searches.map((s) => s.trim()).filter(Boolean))]) {
    const ranked = rankSoundCloud(await flatSearch("scsearch", search, 20), { reference, query });
    for (const c of ranked) {
      if (!seen.has(c.url)) {
        seen.add(c.url);
        candidates.push(c);
      }
    }
    if (candidates.length >= MAX_CANDIDATES_TO_DOWNLOAD) break;
  }

  candidates = candidates.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES_TO_DOWNLOAD);

  if (!candidates.length) {
    return { reference, file: null };
  }

  return withDownloadSlot(async () => {
    for (const track of candidates) {
      const file = await downloadCandidate(track);
      if (!file) continue;

      const duration = await probeDuration(file);
      const okLength =
        duration >= MIN_SONG_SECONDS &&
        !isPreview(duration) &&
        Math.abs(duration - track.duration) <= 8;

      if (okLength) return { file, reference, track, duration };

      errorLog(`Descartado após baixar (${track.title}): ${duration}s, esperado ${track.duration}s`);
      fs.rmSync(file, { force: true });
    }
    return { reference, file: null };
  });
}
