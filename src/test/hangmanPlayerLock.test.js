import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getGame,
  guessLetter,
  guessWord,
  isGamePlayer,
  startGame,
  stopGame,
  useHint,
} from "../services/hangman.js";

const GROUP = "123@g.us";
const STARTER = "111@lid";
const INTRUDER = "222@lid";

const start = () =>
  startGame({ groupId: GROUP, starter: STARTER, category: null, send: async () => {} });

describe("forca: só quem iniciou pode jogar", () => {
  afterEach(() => stopGame(GROUP));

  it("identifica o jogador pelo userLid", () => {
    start();
    const game = getGame(GROUP);
    assert.equal(isGamePlayer(game, STARTER), true);
    assert.equal(isGamePlayer(game, INTRUDER), false);
  });

  it("ignora letra, chute e dica de outra pessoa sem mexer na partida", () => {
    start();
    const game = getGame(GROUP);
    const word = game.word;

    assert.equal(guessLetter(GROUP, INTRUDER, "a"), null);
    assert.equal(guessWord(GROUP, INTRUDER, word), null);
    assert.equal(useHint(GROUP, INTRUDER), null);

    assert.equal(getGame(GROUP), game);
    assert.equal(game.lives, 6);
    assert.equal(game.hintUsed, false);
    assert.equal(game.guessed.size, 0);
    assert.deepEqual(game.wrong, []);
    assert.deepEqual(game.scores, {});
  });

  it("continua aceitando a jogada de quem iniciou", () => {
    start();
    const game = getGame(GROUP);
    const result = guessLetter(GROUP, STARTER, "a");

    assert.ok(result);
    assert.ok(game.guessed.has("a") || game.wrong.includes("a"));
    assert.ok(STARTER in game.scores);
  });
});
