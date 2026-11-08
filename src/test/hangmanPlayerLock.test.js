import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  describeGame,
  getGame,
  guessLetter,
  guessWord,
  joinGame,
  leaveGame,
  startGame,
  stopGame,
  useHint,
} from "../services/hangman.js";

const GROUP = "123@g.us";
const OTHER_GROUP = "456@g.us";
const ALICE = "111@lid";
const BOB = "222@lid";
const STRANGER = "333@lid";

const start = (player, groupId = GROUP) =>
  startGame({ groupId, starter: player, category: null, send: async () => {} });

describe("forca: cada pessoa joga a própria partida", () => {
  afterEach(() => {
    stopGame(GROUP, ALICE);
    stopGame(GROUP, BOB);
    stopGame(OTHER_GROUP, ALICE);
  });

  it("abre uma forca por jogador ao mesmo tempo no grupo", () => {
    start(ALICE);
    const aliceGame = getGame(GROUP, ALICE);

    start(BOB);
    const bobGame = getGame(GROUP, BOB);

    assert.notEqual(aliceGame, bobGame);
    assert.equal(getGame(GROUP, ALICE), aliceGame);
    assert.equal(aliceGame.starter, ALICE);
    assert.equal(bobGame.starter, BOB);
  });

  it("a jogada só mexe na partida de quem mandou", () => {
    start(ALICE);
    start(BOB);
    const aliceGame = getGame(GROUP, ALICE);
    const bobGame = getGame(GROUP, BOB);

    assert.ok(guessLetter(GROUP, ALICE, "a"));

    assert.ok(aliceGame.guessed.has("a") || aliceGame.wrong.includes("a"));
    assert.ok(ALICE in aliceGame.scores);
    assert.equal(bobGame.lives, 6);
    assert.equal(bobGame.guessed.size, 0);
    assert.deepEqual(bobGame.wrong, []);
    assert.deepEqual(bobGame.scores, {});
  });

  it("ignora letra, chute e dica de quem não tem partida aberta", () => {
    start(ALICE);
    const aliceGame = getGame(GROUP, ALICE);

    assert.equal(guessLetter(GROUP, STRANGER, "a"), null);
    assert.equal(guessWord(GROUP, STRANGER, aliceGame.word), null);
    assert.equal(useHint(GROUP, STRANGER), null);
    assert.equal(describeGame(GROUP, STRANGER), null);

    assert.equal(getGame(GROUP, ALICE), aliceGame);
    assert.equal(aliceGame.lives, 6);
    assert.equal(aliceGame.hintUsed, false);
    assert.equal(aliceGame.guessed.size, 0);
    assert.deepEqual(aliceGame.wrong, []);
    assert.deepEqual(aliceGame.scores, {});
  });

  it("encerrar uma forca não afeta as outras", () => {
    start(ALICE);
    start(BOB);
    const bobGame = getGame(GROUP, BOB);

    assert.ok(stopGame(GROUP, ALICE));

    assert.equal(getGame(GROUP, ALICE), null);
    assert.equal(getGame(GROUP, BOB), bobGame);
    assert.equal(stopGame(GROUP, STRANGER), null);
  });

  it("a mesma pessoa tem partidas separadas em grupos diferentes", () => {
    start(ALICE);
    start(ALICE, OTHER_GROUP);

    assert.notEqual(getGame(GROUP, ALICE), getGame(OTHER_GROUP, ALICE));
  });

  it("quem entra joga a mesma palavra e pontua por conta própria", () => {
    start(ALICE);
    const game = getGame(GROUP, ALICE);

    assert.ok(joinGame(GROUP, BOB, ALICE));
    assert.equal(getGame(GROUP, BOB), game);
    assert.ok(guessLetter(GROUP, BOB, "a"));

    assert.ok(game.guessed.has("a") || game.wrong.includes("a"));
    assert.ok(BOB in game.scores);
    assert.equal(ALICE in game.scores, false);
  });

  it("não entra em quem não tem partida", () => {
    assert.equal(joinGame(GROUP, BOB, ALICE), null);
    assert.equal(getGame(GROUP, BOB), null);
  });

  it("quem entrou pode sair sem encerrar a partida", () => {
    start(ALICE);
    const game = getGame(GROUP, ALICE);
    joinGame(GROUP, BOB, ALICE);

    assert.ok(leaveGame(GROUP, BOB));

    assert.equal(getGame(GROUP, BOB), null);
    assert.equal(getGame(GROUP, ALICE), game);
    assert.deepEqual(game.players, [ALICE]);
    assert.equal(leaveGame(GROUP, ALICE), null);
  });

  it("encerrar a partida libera todo mundo que estava nela", () => {
    start(ALICE);
    joinGame(GROUP, BOB, ALICE);

    stopGame(GROUP, ALICE);

    assert.equal(getGame(GROUP, ALICE), null);
    assert.equal(getGame(GROUP, BOB), null);
  });
});
