import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  cleanTempDir,
  LOG_FILE_NAME,
  MAX_LOG_SIZE,
} from "../services/temp-cleanup.js";

const MB = 1024 * 1024;
const MINUTE = 60 * 1000;

function makeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "temp-cleanup-"));
}

function addFile(dir, name, sizeInMb, ageInMinutes, now) {
  const fullPath = path.join(dir, name);
  fs.writeFileSync(fullPath, Buffer.alloc(Math.round(sizeInMb * MB)));
  const time = new Date(now - ageInMinutes * MINUTE);
  fs.utimesSync(fullPath, time, time);
}

describe("limpeza da pasta temp", () => {
  it("apaga só sobras antigas e nunca o log", () => {
    const dir = makeDir();
    const now = Date.now();
    addFile(dir, "velho.mp4", 1, 90, now);
    addFile(dir, "baixando.mp4", 1, 0, now);
    addFile(dir, LOG_FILE_NAME, 0.1, 500, now);

    const { removed } = cleanTempDir({ dir, now });

    assert.deepEqual(removed, ["velho.mp4"]);
    assert.ok(fs.existsSync(path.join(dir, "baixando.mp4")));
    assert.ok(fs.existsSync(path.join(dir, LOG_FILE_NAME)));
  });

  it("acima de 100 MB apaga os parados há 10 min, mais antigos primeiro", () => {
    const dir = makeDir();
    const now = Date.now();
    addFile(dir, "a.mp4", 40, 30, now);
    addFile(dir, "b.mp4", 40, 20, now);
    addFile(dir, "c.mp4", 30, 15, now);
    addFile(dir, "em-uso.mp4", 60, 1, now);

    const { removed } = cleanTempDir({ dir, now });

    // 170 MB → 130 → 90: para assim que fica abaixo do limite.
    assert.deepEqual(removed, ["a.mp4", "b.mp4"]);
    assert.ok(fs.existsSync(path.join(dir, "c.mp4")));
    assert.ok(fs.existsSync(path.join(dir, "em-uso.mp4")));
  });

  it("abaixo do limite não mexe em arquivos recentes", () => {
    const dir = makeDir();
    const now = Date.now();
    addFile(dir, "a.mp4", 20, 30, now);

    assert.deepEqual(cleanTempDir({ dir, now }).removed, []);
  });

  it("zera o log quando passa do limite", () => {
    const dir = makeDir();
    const now = Date.now();
    addFile(dir, LOG_FILE_NAME, MAX_LOG_SIZE / MB + 1, 0, now);

    assert.equal(cleanTempDir({ dir, now }).logTruncated, true);
    assert.equal(fs.statSync(path.join(dir, LOG_FILE_NAME)).size, 0);
  });
});
