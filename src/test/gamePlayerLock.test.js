import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  acceptInvite as acceptCheckers,
  cancelGame as cancelCheckers,
  createInvite as inviteCheckers,
  getGame as getCheckersGame,
  playMove as playCheckers,
} from "../services/checkers.js";
import {
  acceptInvite as acceptVelha,
  cancelGame as cancelVelha,
  createInvite as inviteVelha,
  getGame as getVelhaGame,
  playMove as playVelha,
} from "../services/tic-tac-toe.js";
import {
  bareJid,
  getSenderPlayerId,
  getTargetPlayerId,
  splitWords,
} from "../utils/playerId.js";

const GROUP = "999@g.us";
const ALICE = "111@lid";
const BOB = "222@lid";
const INTRUDER = "333@lid";

const fakeSocket = (map = {}) => ({
  signalRepository: {
    lidMapping: { getLIDForPN: async (pn) => map[pn] || null },
  },
});

describe("playerId: mesma pessoa = mesmo ID", () => {
  it("remove o sufixo de dispositivo", () => {
    assert.equal(bareJid("111:12@lid"), "111@lid");
    assert.equal(bareJid("5571999@c.us"), "5571999@s.whatsapp.net");
  });

  it("prefere o LID quando a mensagem chega com o número", async () => {
    const byAlt = await getSenderPlayerId(fakeSocket(), {
      key: { participant: "5571999@s.whatsapp.net", participantAlt: "111@lid" },
    });
    const byLid = await getSenderPlayerId(fakeSocket(), {
      key: { participant: "111:3@lid", participantAlt: "5571999@s.whatsapp.net" },
    });
    assert.equal(byAlt, ALICE);
    assert.equal(byLid, ALICE);
  });

  it("converte número em LID pelo mapeamento do Baileys", async () => {
    const id = await getSenderPlayerId(
      fakeSocket({ "5571999@s.whatsapp.net": "111:0@lid" }),
      { key: { participant: "5571999@s.whatsapp.net" } }
    );
    assert.equal(id, ALICE);
  });

  it("usa a menção real e a mensagem respondida como adversário", async () => {
    const socket = fakeSocket({ "5571888@s.whatsapp.net": "222@lid" });
    const mention = await getTargetPlayerId(socket, {
      message: {
        extendedTextMessage: { contextInfo: { mentionedJid: ["5571888@s.whatsapp.net"] } },
      },
    });
    const replied = await getTargetPlayerId(socket, {
      message: {
        extendedTextMessage: {
          contextInfo: { participant: "222@lid", quotedMessage: { conversation: "oi" } },
        },
      },
    });
    assert.equal(mention, BOB);
    assert.equal(replied, BOB);
  });

  it("separa os argumentos por espaço", () => {
    assert.deepEqual(splitWords("  chute   cachorro "), ["chute", "cachorro"]);
    assert.deepEqual(splitWords("bot dificil"), ["bot", "dificil"]);
  });
});

describe("damas: só o jogador da vez joga", () => {
  afterEach(() => cancelCheckers(GROUP));

  it("ignora quem está fora da partida e barra o adversário fora da vez", () => {
    inviteCheckers({ groupId: GROUP, challenger: ALICE, challenged: BOB, send: async () => {} });
    acceptCheckers(GROUP);
    const game = getCheckersGame(GROUP);
    const boardBefore = [...game.board];

    assert.equal(playCheckers(GROUP, INTRUDER, "1"), null);
    assert.match(playCheckers(GROUP, BOB, "1").error, /vez/);
    assert.deepEqual(game.board, boardBefore);
    assert.equal(game.turn, "w");

    const ok = playCheckers(GROUP, ALICE, "1");
    assert.ok(ok.text);
    assert.equal(game.turn, "b");
    assert.match(playCheckers(GROUP, ALICE, "1").error, /vez/);
  });
});

describe("velha: só o jogador da vez joga", () => {
  afterEach(() => cancelVelha(GROUP));

  it("ignora intruso e barra jogada fora da vez", () => {
    inviteVelha({ groupId: GROUP, challenger: ALICE, challenged: BOB, send: async () => {} });
    acceptVelha(GROUP);
    const game = getVelhaGame(GROUP);

    assert.equal(playVelha(GROUP, INTRUDER, 5), null);
    assert.match(playVelha(GROUP, BOB, 5).error, /vez/);
    assert.ok(game.board.every((cell) => !cell));

    assert.ok(playVelha(GROUP, ALICE, 5).text);
    assert.match(playVelha(GROUP, ALICE, 1).error, /vez/);
  });
});
