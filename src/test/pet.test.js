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
  describePet,
  doAction,
  ensureAllGroupFolders,
  getRanking,
  groupDir,
  loadPet,
  moodOf,
  renamePet,
  savePet,
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
  it("comer dá pontos e só volta a pagar depois da espera", () => {
    adoptPet({ groupId: GROUP, ownerId: ALICE, species: "cachorro", now: T0 });
    const later = T0 + 5 * HOUR; // fome caiu para 60

    const first = doAction(GROUP, ALICE, "comer", later);
    assert.ok(!first.error, first.error);
    assert.ok(first.pet.pontos > 10);
    const paid = first.pet.pontos;

    const again = doAction(GROUP, ALICE, "comer", later + 3 * HOUR);
    assert.ok(!again.error, again.error);
    assert.equal(again.pet.pontos, paid);
    assert.match(again.text, /Sem pontos/);
    assert.match(again.text, /1h|60 min/);

    const third = doAction(GROUP, ALICE, "comer", later + 5 * HOUR);
    assert.ok(third.pet.pontos > paid);
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
    const { pet } = doAction(GROUP, ALICE, "dormir", tired);
    assert.ok(pet.dormindoAte);
    assert.match(doAction(GROUP, ALICE, "brincar", tired + HOUR).error, /dormindo/);

    const wakeAt = pet.dormindoAte;
    const awake = loadPet(GROUP, ALICE, wakeAt);
    assert.equal(awake.dormindoAte, null);
    assert.equal(Math.round(awake.status.energia), 100);
    assert.match(wakeUp(GROUP, ALICE, wakeAt).error, /acordado/);
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

describe("pet: estado e tempo", () => {
  const ACTION_NAMES = ["comer", "brincar", "carinho", "banho", "passear", "dormir"];

  /** Coloca o pet em um estado exato; ranAt marca todas as ações como feitas nessa hora. */
  function petWith(stats, { ranAt, species = "gato" } = {}) {
    if (!loadPet(GROUP, ALICE, T0)) adoptPet({ groupId: GROUP, ownerId: ALICE, species, now: T0 });
    const pet = loadPet(GROUP, ALICE, T0);
    Object.assign(pet.status, stats);
    pet.dormindoAte = null;
    pet.ultimoTick = T0;
    pet.esperas = ranAt ? Object.fromEntries(ACTION_NAMES.map((name) => [name, ranAt])) : {};
    savePet(pet);
    return pet;
  }

  const FULL = { fome: 100, felicidade: 100, energia: 100, limpeza: 100 };
  const suggestedAction = (error) => error.match(/\{prefix\}pet (\w+)/)?.[1];

  it("cansado dorme mesmo tendo dormido há pouco, só não ganha pontos", () => {
    petWith({ ...FULL, energia: 10 }, { ranAt: T0 });
    const points = loadPet(GROUP, ALICE, T0).pontos;

    const refused = doAction(GROUP, ALICE, "brincar", T0);
    assert.equal(suggestedAction(refused.error), "dormir");

    const slept = doAction(GROUP, ALICE, "dormir", T0);
    assert.ok(!slept.error, slept.error);
    assert.ok(slept.pet.dormindoAte > T0);
    assert.equal(slept.pet.pontos, points);
    assert.match(slept.text, /Sem pontos/);
  });

  it("não dá para ganhar pontos dormindo e acordando sem parar", () => {
    petWith({ ...FULL, energia: 40 });
    const first = doAction(GROUP, ALICE, "dormir", T0);
    const points = first.pet.pontos;

    wakeUp(GROUP, ALICE, T0 + 60000);
    const second = doAction(GROUP, ALICE, "dormir", T0 + 120000);

    assert.ok(!second.error, second.error);
    assert.equal(second.pet.pontos, points);
  });

  it("recompensa perdida não reinicia a contagem da espera", () => {
    petWith({ ...FULL, energia: 40 }, { ranAt: T0 });

    doAction(GROUP, ALICE, "dormir", T0 + 7 * HOUR);
    const pet = loadPet(GROUP, ALICE, T0 + 7 * HOUR);

    assert.equal(pet.esperas.dormir, T0);
  });

  it("dormindo, dormir avisa que já dorme", () => {
    petWith({ ...FULL, energia: 10 }, { ranAt: T0 });
    doAction(GROUP, ALICE, "dormir", T0);

    const again = doAction(GROUP, ALICE, "dormir", T0 + HOUR);

    assert.match(again.error, /já está dormindo/);
    assert.equal(again.mood, "sono");
  });

  it("dorme só o que precisa e acorda com a energia cheia", () => {
    petWith({ ...FULL, energia: 70 });

    const { pet } = doAction(GROUP, ALICE, "dormir", T0);

    assert.equal(pet.dormindoAte, T0 + HOUR);
    assert.equal(loadPet(GROUP, ALICE, T0 + HOUR - 1).dormindoAte, T0 + HOUR);
    assert.equal(loadPet(GROUP, ALICE, T0 + HOUR).dormindoAte, null);
    assert.equal(Math.round(loadPet(GROUP, ALICE, T0 + HOUR).status.energia), 100);
  });

  it("acordar antes da hora mantém só a energia recuperada", () => {
    petWith({ ...FULL, energia: 10 });
    doAction(GROUP, ALICE, "dormir", T0);

    const { pet } = wakeUp(GROUP, ALICE, T0 + HOUR);

    assert.equal(pet.dormindoAte, null);
    assert.equal(Math.round(pet.status.energia), 40);
  });

  it("dormindo gasta menos do que acordado", () => {
    petWith({ ...FULL, energia: 10 });
    doAction(GROUP, ALICE, "dormir", T0);
    const asleep = loadPet(GROUP, ALICE, T0 + 2 * HOUR).status;

    petWith({ ...FULL, energia: 10 });
    const awake = loadPet(GROUP, ALICE, T0 + 2 * HOUR).status;

    assert.equal(asleep.fome, 96);
    assert.equal(awake.fome, 92);
    assert.equal(asleep.felicidade, 100);
    assert.equal(awake.felicidade, 95);
    assert.equal(asleep.limpeza, 99);
    assert.equal(awake.limpeza, 96);
  });

  it("energia que sobraria do sono não esconde o gasto depois de acordar", () => {
    const pet = petWith({ ...FULL, energia: 70 });
    pet.dormindoAte = T0 + 3 * HOUR; // formato antigo: sono fixo de 3h
    savePet(pet);

    assert.equal(loadPet(GROUP, ALICE, T0 + 8 * HOUR).status.energia, 90);
  });

  it("comandos recusados em sequência não congelam o tempo", () => {
    petWith(FULL);

    for (let i = 1; i < 60; i += 1) {
      assert.ok(doAction(GROUP, ALICE, "dormir", T0 + i * 5 * 60 * 1000).error);
    }

    const status = loadPet(GROUP, ALICE, T0 + 5 * HOUR).status;
    assert.equal(Math.round(status.fome), 80);
    assert.equal(Math.round(status.limpeza), 90);
  });

  it("não aguenta brincar nem passear com fome ou sem energia", () => {
    petWith({ ...FULL, energia: 14 });
    assert.equal(suggestedAction(doAction(GROUP, ALICE, "brincar", T0).error), "dormir");

    petWith({ ...FULL, energia: 24 });
    assert.equal(suggestedAction(doAction(GROUP, ALICE, "passear", T0).error), "dormir");

    petWith({ ...FULL, fome: 5 });
    assert.equal(suggestedAction(doAction(GROUP, ALICE, "brincar", T0).error), "comer");
    assert.equal(suggestedAction(doAction(GROUP, ALICE, "passear", T0).error), "comer");
  });

  it("satisfeito recusa o que não precisa", () => {
    petWith(FULL);

    assert.match(doAction(GROUP, ALICE, "comer", T0).error, /barriga cheia/);
    assert.match(doAction(GROUP, ALICE, "banho", T0).error, /limpinho/);
    assert.match(doAction(GROUP, ALICE, "dormir", T0).error, /cheio de energia/);
  });

  it("feliz ainda topa lazer valendo pontos, mas não repetir sem parar", () => {
    petWith(FULL);
    const points = loadPet(GROUP, ALICE, T0).pontos;

    const played = doAction(GROUP, ALICE, "brincar", T0);
    assert.ok(!played.error, played.error);
    assert.ok(played.pet.pontos > points);

    petWith(FULL, { ranAt: T0 });
    assert.match(doAction(GROUP, ALICE, "brincar", T0).error, /radiante/);
    assert.match(doAction(GROUP, ALICE, "carinho", T0).error, /derretendo/);
  });

  it("nenhum estado manda fazer algo que depois é recusado", () => {
    const hintActions = {
      "está com fome": "comer",
      "está com sono": "dormir",
      "precisa de banho": "banho",
      "quer brincar": "brincar",
    };
    const values = [0, 9, 14, 24, 39, 100];

    const attempt = (stats, action) => {
      petWith(stats, { ranAt: T0 });
      return doAction(GROUP, ALICE, action, T0);
    };

    const assertSuggestionWorks = (stats, error) => {
      const suggestion = suggestedAction(error);
      assert.ok(!attempt(stats, suggestion).error, `${suggestion} recusado em ${JSON.stringify(stats)}`);
    };

    for (const fome of values) {
      for (const energia of values) {
        for (const rest of [0, 100]) {
          const stats = { fome, energia, felicidade: rest, limpeza: rest };
          const shown = describePet(petWith(stats, { ranAt: T0 }), T0);

          for (const [hint, action] of Object.entries(hintActions)) {
            if (!shown.includes(hint)) continue;
            const { error } = attempt(stats, action);
            if (!error) continue;
            assert.ok(suggestedAction(error), `pede ${action}, mas recusa sem saída: ${error}`);
            assertSuggestionWorks(stats, error);
          }

          for (const action of ACTION_NAMES) {
            const { error } = attempt(stats, action);
            if (error && suggestedAction(error)) assertSuggestionWorks(stats, error);
          }
        }
      }
    }
  });

  it("dormindo, o status não pede cuidado e a figurinha é de sono", () => {
    petWith({ ...FULL, fome: 20, energia: 10 });
    doAction(GROUP, ALICE, "dormir", T0);
    const now = T0 + 10 * 60 * 1000;

    const shown = describePet(loadPet(GROUP, ALICE, now), now);
    assert.match(shown, /descansando/);
    assert.doesNotMatch(shown, /está com sono|está com fome/);

    const daily = claimDaily(GROUP, ALICE, now);
    assert.equal(daily.mood, "sono");
    assert.match(daily.text, /antes de dormir/);
    assert.equal(renamePet(GROUP, ALICE, "Novo", now).mood, "sono");
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
