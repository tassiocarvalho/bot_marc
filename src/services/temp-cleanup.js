/**
 * Limpeza da pasta assets/temp: downloads, figurinhas e conversões apagam os
 * próprios arquivos, mas um reinício ou erro no meio do caminho deixa sobras.
 *
 * Só apaga arquivos parados há algum tempo: um arquivo em uso foi escrito há
 * pouco (o mtime muda enquanto é gravado), então nada em andamento é tocado.
 *
 * @author bot_marc
 */
import fs from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "../config.js";
import { errorLog } from "../utils/logger.js";

const MB = 1024 * 1024;
const MINUTE = 60 * 1000;

export const LOG_FILE_NAME = "wa-logs.txt";
export const MAX_TEMP_SIZE = 100 * MB;
export const MAX_LOG_SIZE = 20 * MB;
/** Sobra comum: ninguém deixa arquivo parado por 1 hora. */
export const STALE_AGE = 60 * MINUTE;
/** Acima do limite de tamanho, apaga também o que está parado há 10 minutos. */
export const OVER_LIMIT_AGE = 10 * MINUTE;
const INTERVAL = 10 * MINUTE;

function listFiles(dir) {
  const files = [];

  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);

    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) files.push({ name, fullPath, size: stat.size, mtime: stat.mtimeMs });
    } catch {
      // apagado por outro comando enquanto listávamos
    }
  }

  return files;
}

function remove(file) {
  try {
    fs.unlinkSync(file.fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ dir?: string, now?: number }} [options]
 * @returns {{ removed: string[], logTruncated: boolean }}
 */
export function cleanTempDir({ dir = TEMP_DIR, now = Date.now() } = {}) {
  const removed = [];
  let logTruncated = false;

  if (!fs.existsSync(dir)) return { removed, logTruncated };

  const files = listFiles(dir);
  const log = files.find((file) => file.name === LOG_FILE_NAME);

  // O pino abre o log em modo append, então zerar não atrapalha quem escreve.
  if (log && log.size > MAX_LOG_SIZE) {
    try {
      fs.truncateSync(log.fullPath, 0);
      logTruncated = true;
    } catch (error) {
      errorLog(`Não consegui limpar o ${LOG_FILE_NAME}: ${error.message}`);
    }
  }

  let others = files
    .filter((file) => file.name !== LOG_FILE_NAME)
    .sort((a, b) => a.mtime - b.mtime);

  others = others.filter((file) => {
    if (now - file.mtime < STALE_AGE) return true;
    if (remove(file)) removed.push(file.name);
    return false;
  });

  let total = others.reduce((sum, file) => sum + file.size, 0);

  for (const file of others) {
    if (total < MAX_TEMP_SIZE) break;
    if (now - file.mtime < OVER_LIMIT_AGE) break;

    if (remove(file)) {
      removed.push(file.name);
      total -= file.size;
    }
  }

  return { removed, logTruncated };
}

function safeClean() {
  try {
    cleanTempDir();
  } catch (error) {
    errorLog(`Erro ao limpar a pasta temp: ${error.message}`);
  }
}

let timer = null;

/** Limpa agora e repete a cada 10 minutos. Chamar uma vez ao iniciar. */
export function startTempCleanup() {
  safeClean();
  if (timer) return;

  timer = setInterval(safeClean, INTERVAL);
  timer.unref();
}

export { safeClean as cleanTempDirSafely };
