import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import {
  connectDownloadQueue,
  runInDownloadQueue,
  withDownloadQueue,
} from "../services/download-queue.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const silent = async () => {};

describe("fila de downloads", () => {
  it("roda um por vez, na ordem, e informa a posição", async () => {
    const first = deferred();
    const order = [];
    const positions = [];

    const a = runInDownloadQueue("a", async () => {
      order.push("a");
      await first.promise;
    }, silent);
    const b = runInDownloadQueue("b", async () => order.push("b"), async (p) => positions.push(p));
    const c = runInDownloadQueue("c", async () => order.push("c"), async (p) => positions.push(p));

    await tick();
    assert.deepEqual(order, ["a"]);
    assert.deepEqual(positions, [1, 2]);

    first.resolve();
    await Promise.all([a, b, c]);
    assert.deepEqual(order, ["a", "b", "c"]);
  });

  it("segundo pedido da mesma pessoa entra na fila e roda sozinho", async () => {
    const first = deferred();
    const a = runInDownloadQueue("a", () => first.promise, silent);
    const second = runInDownloadQueue("a", async () => "segundo", silent);

    first.resolve();
    await a;
    assert.equal(await second, "segundo");
  });

  it("limita a 3 pedidos por pessoa e libera ao terminar", async () => {
    const first = deferred();
    const jobs = [
      runInDownloadQueue("a", () => first.promise, silent),
      runInDownloadQueue("a", async () => {}, silent),
      runInDownloadQueue("a", async () => {}, silent),
    ];

    await assert.rejects(runInDownloadQueue("a", async () => {}, silent), /já tem 3 downloads/);

    first.resolve();
    await Promise.all(jobs);
    assert.equal(await runInDownloadQueue("a", async () => "ok", silent), "ok");
  });

  it("recusa quando a fila enche", async () => {
    const first = deferred();
    const jobs = [runInDownloadQueue("r", () => first.promise, silent)];

    for (let i = 0; i < 5; i += 1) {
      jobs.push(runInDownloadQueue(`w${i}`, async () => {}, silent));
    }

    await assert.rejects(runInDownloadQueue("extra", async () => {}, silent), /fila de downloads está cheia/);

    first.resolve();
    await Promise.all(jobs);
  });

  it("erro no download e no aviso não travam a fila", async () => {
    const first = deferred();
    const a = runInDownloadQueue("a", () => first.promise, silent);
    const b = runInDownloadQueue("b", async () => "b", async () => {
      throw new Error("aviso falhou");
    });

    first.reject(new Error("falhou"));
    await assert.rejects(a, /falhou/);
    assert.equal(await b, "b");
    assert.equal(await runInDownloadQueue("a", async () => "de novo", silent), "de novo");
  });

  // Por último: depois daqui a fila fica ligada a uma conexão de mentira.
  it("retoma pedidos salvos e usa a conexão atual quando chega a vez", async () => {
    const first = deferred();
    const served = [];
    const saved = [];
    const newSocket = () => ({ ev: new EventEmitter() });
    const handler = withDownloadQueue("teste", async (props) => {
      served.push([props.webMessage.id, props.socket]);
      if (props.webMessage.id === "antigo") await first.promise;
    });
    const options = (socket) => ({
      socket,
      createProps: (current, webMessage) => ({ socket: current, webMessage }),
      storage: {
        read: () => [
          { command: "teste", userId: "antigo", webMessage: { id: "antigo" }, queuedAt: Date.now() },
          { command: "teste", userId: "velho", webMessage: { id: "velho" }, queuedAt: 0 },
        ],
        write: (requests) => saved.push(requests.map((request) => request.webMessage.id)),
      },
      loadCommands: async () => {},
    });

    const oldSocket = newSocket();
    connectDownloadQueue(options(oldSocket));
    oldSocket.ev.emit("connection.update", { connection: "open" });
    await tick();
    assert.deepEqual(served, [["antigo", oldSocket]]);

    const live = handler({
      fullArgs: "musica",
      userLid: "vivo",
      webMessage: { id: "vivo" },
      sendReply: silent,
    });
    await tick();
    assert.deepEqual(saved.at(-1), ["antigo", "vivo"]);

    oldSocket.ev.emit("connection.update", { connection: "close" });
    const currentSocket = newSocket();
    connectDownloadQueue(options(currentSocket));
    first.resolve();
    await tick();
    assert.equal(served.length, 1, "espera a conexão voltar");

    currentSocket.ev.emit("connection.update", { connection: "open" });
    await live;

    assert.deepEqual(served[1], ["vivo", currentSocket]);
    assert.deepEqual(saved.at(-1), []);
  });
});
