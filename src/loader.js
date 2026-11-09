/**
 * Este script é responsável
 * por carregar os eventos
 * que serão escutados pelo
 * socket do WhatsApp.
 *
 * @author bot_marc
 */
import { onCall } from "./middlewares/onCall.js";
import { onMessagesUpsert } from "./middlewares/onMesssagesUpsert.js";
import { connectDownloadQueue } from "./services/download-queue.js";
import { badMacHandler } from "./utils/badMacHandler.js";
import { getDownloadQueue, saveDownloadQueue } from "./utils/database.js";
import { loadCommonFunctions } from "./utils/loadCommonFunctions.js";
import { errorLog } from "./utils/logger.js";

export function load(socket) {
  connectDownloadQueue({
    socket,
    createProps: (currentSocket, webMessage) =>
      loadCommonFunctions({ socket: currentSocket, webMessage }),
    storage: { read: getDownloadQueue, write: saveDownloadQueue },
    loadCommands: () =>
      Promise.all([
        import("./commands/member/downloads/mp3.js"),
        import("./commands/member/downloads/mp4.js"),
      ]),
  });

  const safeEventHandler = async (callback, data, eventName) => {
    try {
      await callback(data);
    } catch (error) {
      if (badMacHandler.handleError(error, eventName)) {
        return;
      }
      errorLog(`Erro ao processar evento ${eventName}: ${error.message}`);
      if (error.stack) {
        errorLog(`Stack trace: ${error.stack}`);
      }
    }
  };

  socket.ev.on("messages.upsert", async (data) => {
    const startProcess = Date.now();
    safeEventHandler(
      () =>
        onMessagesUpsert({
          socket,
          messages: data.messages,
          startProcess,
        }),
      data,
      "messages.upsert",
    );
  });

  socket.ev.process((events) => {
    if (events?.call?.length) {
      safeEventHandler(
        () => onCall({ socket, calls: events.call }),
        events.call,
        "call",
      );
    }
  });

  process.on("uncaughtException", (error) => {
    if (badMacHandler.handleError(error, "uncaughtException")) {
      return;
    }
    errorLog(`Erro não capturado: ${error.message}`);
  });

  process.on("unhandledRejection", (reason) => {
    if (badMacHandler.handleError(reason, "unhandledRejection")) {
      return;
    }
    errorLog(`Promessa rejeitada não tratada: ${reason}`);
  });
}
