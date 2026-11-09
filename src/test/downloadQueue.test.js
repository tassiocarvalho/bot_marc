import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInDownloadQueue } from "../services/download-queue.js";

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

  it("recusa segundo pedido da mesma pessoa e libera ao terminar", async () => {
    const first = deferred();
    const a = runInDownloadQueue("a", () => first.promise, silent);

    await assert.rejects(runInDownloadQueue("a", async () => {}, silent), /já tem um download/);

    first.resolve();
    await a;
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
});
