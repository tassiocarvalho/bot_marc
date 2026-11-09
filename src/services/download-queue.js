/**
 * Fila dos downloads do YouTube: cada busca e download abre yt-dlp e ffmpeg,
 * e a VM tem pouca memória para rodar vários ao mesmo tempo.
 *
 * A fila fica em memória: reiniciar o bot descarta quem estava esperando.
 *
 * @author bot_marc
 */
import { WarningError } from "../errors/index.js";

const MAX_RUNNING = 1;
const MAX_WAITING = 5;

const waiting = [];
const busyUsers = new Set();
let running = 0;

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
 * @returns {Promise<T>}
 */
export async function runInDownloadQueue(userId, job, notifyQueued) {
  if (userId && busyUsers.has(userId)) {
    throw new WarningError("Você já tem um download em andamento ou na fila. Aguarde ele terminar!");
  }

  const isFree = running < MAX_RUNNING;

  if (!isFree && waiting.length >= MAX_WAITING) {
    throw new WarningError("A fila de downloads está cheia. Tente de novo daqui a pouco!");
  }

  if (userId) busyUsers.add(userId);

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
  }
}

/**
 * Coloca o handler de um comando de download na fila.
 * Sem texto o comando só mostra o erro de uso, então não ocupa vaga.
 *
 * @param {(props: CommandHandleProps) => Promise<unknown>} handler
 */
export const withDownloadQueue = (handler) => (props) => {
  if (!props.fullArgs.length) return handler(props);

  return runInDownloadQueue(
    props.userLid,
    () => handler(props),
    (position) =>
      props.sendReply(`⏳ Tem download em andamento. Você é o ${position}º da fila!`),
  );
};
