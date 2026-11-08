import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { buildPetSvg, PET_MOODS, renderPetSticker } from "../services/pet-art.js";
import {
  abandonPet,
  adoptPet,
  claimDaily,
  doAction,
  ensureAllGroupFolders,
  getRanking,
  groupDir,
  loadPet,
  moodOf,
  setPetsDir,
  wakeUp,
} from "../services/pet.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pets-"));
const GROUP = "120363000000000001@g.us";
const ALICE = "111@lid";
const BOB = "222@lid";
const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-11-08T12:00:00-03:00");

beforeEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  setPetsDir(tmp);
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("pet: persistência", () => {
  it("cria pasta do grupo e arquivo do dono com o ID salvo", () => {
    const { pet } = adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", name: "Mingau", now: T0 });
    const file = path.join(groupDir(GROUP), `${ALICE}.json`);

    assert.ok(fs.existsSync(path.join(groupDir(GROUP), "_grupo.json")));
    assert.ok(fs.existsSync(file));

    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.dono, ALICE);
    assert.equal(saved.grupo, GROUP);
    assert.equal(saved.nome, "Mingau");
    assert.equal(pet.pontos, 10);
  });

  it("não deixa adotar dois pets no mesmo grupo", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    assert.ok(adoptPet({ groupId: GROUP, ownerId: ALICE, species: "cachorro", now: T0 }).error);
  });

  it("cria pasta para todos os grupos do bot", async () => {
    const socket = {
      groupFetchAllParticipating: async () => ({
        "1@g.us": { id: "1@g.us", subject: "Grupo Um" },
        "2@g.us": { id: "2@g.us", subject: "Grupo Dois" },
      }),
    };
    assert.equal(await ensureAllGroupFolders(socket), 2);
    const info = JSON.parse(fs.readFileSync(path.join(groupDir("2@g.us"), "_grupo.json"), "utf8"));
    assert.deepEqual([info.id, info.nome], ["2@g.us", "Grupo Dois"]);
  });

  it("abandonar arquiva em vez de apagar", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    abandonPet(GROUP, ALICE, T0);
    assert.equal(loadPet(GROUP, ALICE, T0), null);
    assert.equal(fs.readdirSync(path.join(groupDir(GROUP), "_abandonados")).length, 1);
  });
});

describe("pet: cuidados e pontos", () => {
  it("comer dá pontos e respeita o tempo de espera", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "cachorro", now: T0 });
    const later = T0 + 5 * HOUR; // fome caiu para 60

    const first = doAction(GROUP, ALICE, "comer", later);
    assert.ok(!first.error, first.error);
    assert.ok(first.pet.pontos > 10);

    const again = doAction(GROUP, ALICE, "comer", later + 3 * HOUR);
    assert.match(again.error, /Calma/);
    assert.match(again.error, /1h|60 min/);
  });

  it("status caem com o tempo e o humor muda", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    const pet = loadPet(GROUP, ALICE, T0 + 15 * HOUR);
    assert.equal(pet.status.fome, 20);
    assert.equal(moodOf(pet, T0 + 15 * HOUR), "fome");
  });

  it("dormir bloqueia ações e recupera energia", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    const tired = T0 + 30 * HOUR;
    assert.ok(!doAction(GROUP, ALICE, "dormir", tired).error);
    assert.match(doAction(GROUP, ALICE, "brincar", tired + HOUR).error, /dormindo/);

    const awake = loadPet(GROUP, ALICE, tired + 3 * HOUR);
    assert.equal(awake.dormindoAte, null);
    assert.ok(awake.status.energia >= 100 - 1);
    assert.match(wakeUp(GROUP, ALICE, tired + 3 * HOUR).error, /acordado/);
  });

  it("presente diário só uma vez por dia e conta sequência", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    assert.ok(!claimDaily(GROUP, ALICE, T0).error);
    assert.ok(claimDaily(GROUP, ALICE, T0 + HOUR).error);
    const next = claimDaily(GROUP, ALICE, T0 + 24 * HOUR);
    assert.equal(next.pet.diario.sequencia, 2);
  });

  it("ranking ordena por pontos", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    adoptPet({ groupId: GROUP, ownerId: BOB, species: "cachorro", now: T0 });
    claimDaily(GROUP, BOB, T0);
    assert.deepEqual(getRanking(GROUP).map((pet) => pet.dono), [BOB, ALICE]);
  });

  it("pet de um grupo não aparece em outro", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "gato", now: T0 });
    assert.equal(loadPet("outro@g.us", ALICE, T0), null);
  });
});

describe("pet: figurinhas", () => {
  it("renderiza todos os humores dos dois bichos em 512x512", async () => {
    for (const species of ["gato", "cachorro"]) {
      for (const mood of PET_MOODS) {
        const buffer = await renderPetSticker({ species, color: null, mood, level: 10, name: "Teste" });
        assert.equal(buffer.subarray(8, 12).toString(), "WEBP");
      }
    }
  });

  it("escapa o nome no SVG", () => {
    assert.ok(!buildPetSvg({ species: "gato", name: "<script>" }).includes("<script>"));
  });
});
