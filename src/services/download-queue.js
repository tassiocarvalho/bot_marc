/**
 * Fila dos downloads do YouTube: cada busca e download abre yt-dlp e ffmpeg,
 * e a VM tem pouca memória para rodar vários ao mesmo tempo.
 *
 * Os pedidos ficam salvos para sobreviver a um reinício, e cada um só monta
 * as funções de envio quando chega a vez, para usar a conexão atual.
 *
 * @author bot_marc
 */
import { WarningError } from "../errors/index.js";
import { errorLog } from "../utils/logger.js";

const MAX_RUNNING = 1;
const MAX_WAITING = 5;
const MAX_RESUME_AGE_IN_MILLISECONDS = 60 * 60 * 1000;

const waiting = [];
const busyUsers = new Set();
const handlers = new Map();
const savedRequests = new Set();
let running = 0;

let link = null;
let isOnline = false;
let hasResumed = false;
let onlineWaiters = [];

function persist() {
  try {
    link?.storage.write([...savedRequests]);
  } catch (error) {
    errorLog(`Não consegui salvar a fila de downloads: ${error.message}`);
  }
}

function releaseSlot() {
  const next = waiting.shift();

  // O próximo herda a vaga, então `running` só cai quando a fila esvazia.
  if (next) next();
  else running -= 1;
}

/**
 * Roda `job` quando chegar a vez e devolve o resultado dele.
 *
 * @template T
 * @param {string | undefined} userId
 * @param {() => Promise<T>} job
 * @param {(position: number) => Promise<unknown>} notifyQueued
 * @param {object} [request] Dados salvos para retomar depois de um reinício.
 * @returns {Promise<T>}
 */
export async function runInDownloadQueue(userId, job, notifyQueued, request) {
  if (userId && busyUsers.has(userId)) {
    throw new WarningError("Você já tem um download em andamento ou na fila. Aguarde ele terminar!");
  }

  const isFree = running < MAX_RUNNING;

  if (!isFree && waiting.length >= MAX_WAITING) {
    throw new WarningError("A fila de downloads está cheia. Tente de novo daqui a pouco!");
  }

  if (userId) busyUsers.add(userId);

  if (request) {
    savedRequests.add(request);
    persist();
  }

  try {
    if (isFree) {
      running += 1;
    } else {
      const turn = new Promise((resolve) => waiting.push(resolve));

      // Sem await: uma falha ao avisar não pode prender a vaga na fila.
      notifyQueued(waiting.length).catch(() => {});
      await turn;
    }

    try {
      return await job();
    } finally {
      releaseSlot();
    }
  } finally {
    if (userId) busyUsers.delete(userId);

    if (request) {
      savedRequests.delete(request);
      persist();
    }
  }
}

function waitUntilOnline() {
  if (!link || isOnline) return Promise.resolve();

  return new Promise((resolve) => onlineWaiters.push(resolve));
}

async function reportFailure(props, error) {
  try {
    if (error instanceof WarningError) {
      await props.sendWarningReply(error.message);
    } else {
      errorLog(`Erro no download da fila: ${error.message}`);
      await props.sendErrorReply(error.message);
    }
  } catch (sendError) {
    errorLog(`Não consegui avisar sobre o erro do download: ${sendError.message}`);
  }
}

function enqueue(request, originalProps, notifyQueued) {
  const job = async () => {
    await waitUntilOnline();

    const props = link
      ? link.createProps(link.socket, request.webMessage)
      : originalProps;

    if (!props) return;

    try {
      await handlers.get(request.command)(props);
    } catch (error) {
      await reportFailure(props, error);
    }
  };

  return runInDownloadQueue(request.userId, job, notifyQueued, request);
}

/**
 * Coloca o handler de um comando de download na fila.
 * Sem texto o comando só mostra o erro de uso, então não ocupa vaga.
 *
 * @param {string} command Nome que identifica o comando ao retomar a fila.
 * @param {(props: CommandHandleProps) => Promise<unknown>} handler
 */
export function withDownloadQueue(command, handler) {
  handlers.set(command, handler);

  return (props) => {
    if (!props.fullArgs.length) return handler(props);

    const request = {
      command,
      userId: props.userLid,
      webMessage: props.webMessage,
      queuedAt: Date.now(),
    };

    return enqueue(request, props, (position) =>
      props.sendReply(`⏳ Tem download em andamento. Você é o ${position}º da fila!`),
    );
  };
}

async function resumeSavedRequests() {
  if (hasResumed) return;
  hasResumed = true;

  try {
    await link.loadCommands();

    const oldest = Date.now() - MAX_RESUME_AGE_IN_MILLISECONDS;
    const requests = link.storage
      .read()
      .filter(({ command, queuedAt }) => handlers.has(command) && queuedAt >= oldest);

    persist();

    for (const request of requests) {
      enqueue(request, null, async () => {}).catch((error) =>
        errorLog(`Não consegui retomar um download: ${error.message}`),
      );
    }
  } catch (error) {
    errorLog(`Não consegui retomar a fila de downloads: ${error.message}`);
  }
}

/**
 * Liga a fila à conexão atual. Deve ser chamada a cada nova conexão.
 *
 * @param {{
 *   socket: object,
 *   createProps: (socket: object, webMessage: object) => CommandHandleProps | null,
 *   storage: { read: () => object[], write: (requests: object[]) => void },
 *   loadCommands: () => Promise<unknown>,
 * }} options
 */
export function connectDownloadQueue(options) {
  link = options;
  isOnline = false;

  const { socket } = options;

  socket.ev.on("connection.update", ({ connection }) => {
    if (socket !== link.socket) return;

    if (connection === "close") isOnline = false;
    if (connection !== "open") return;

    isOnline = true;
    resumeSavedRequests();

    const released = onlineWaiters;
    onlineWaiters = [];
    released.forEach((resolve) => resolve());
  });
}
