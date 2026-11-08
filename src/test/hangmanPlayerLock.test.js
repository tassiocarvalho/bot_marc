import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HANGMAN_CATEGORIES, HANGMAN_WORDS } from "../services/hangman-words.js";
import {
  describeGame,
  findCategory,
  findLevel,
  getGame,
  guessLetter,
  guessWord,
  HANGMAN_LEVELS,
  joinGame,
  leaveGame,
  normalize,
  startGame,
  stopGame,
  useHint,
} from "../services/hangman.js";

const GROUP = "123@g.us";
const OTHER_GROUP = "456@g.us";
const ALICE = "111@lid";
const BOB = "222@lid";
const CAROL = "333@lid";
const STRANGER = "444@lid";
const BOT = "999@lid";

const start = (player, groupId = GROUP) =>
  startGame({ groupId, starter: player, category: null, send: async () => {} });

describe("forca: partidas por jogador", () => {
  afterEach(() => {
    for (const player of [ALICE, BOB, CAROL]) {
      stopGame(GROUP, player);
      stopGame(OTHER_GROUP, player);
    }
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

  it("não deixa a mesma pessoa em duas forcas, nem em grupos diferentes", () => {
    start(ALICE);
    const game = getGame(GROUP, ALICE);

    assert.match(start(ALICE).error, /já está em uma forca/);
    assert.equal(getGame(GROUP, ALICE), game);

    assert.match(start(ALICE, OTHER_GROUP).error, /outro grupo/);
    assert.equal(getGame(OTHER_GROUP, ALICE), null);
    assert.equal(guessLetter(OTHER_GROUP, ALICE, "a"), null);
    assert.equal(game.guessed.size + game.wrong.length, 0);

    start(BOB, OTHER_GROUP);
    assert.match(joinGame(GROUP, BOB, { target: ALICE }).error, /outro grupo/);
    assert.deepEqual(game.players, [ALICE]);

    assert.ok(joinGame(GROUP, CAROL, { target: ALICE }).text);
    assert.match(joinGame(GROUP, CAROL, { target: ALICE }).error, /já está em uma forca/);
    assert.deepEqual(game.players, [ALICE, CAROL]);
  });

  it("volta a poder jogar depois que a partida acaba", () => {
    start(ALICE);
    stopGame(GROUP, ALICE);

    assert.ok(start(ALICE, OTHER_GROUP).text);
    assert.ok(getGame(OTHER_GROUP, ALICE));
  });

  it("quem entra joga a mesma palavra e pontua por conta própria", () => {
    start(ALICE);
    const game = getGame(GROUP, ALICE);

    assert.ok(joinGame(GROUP, BOB, { target: ALICE }).text);
    assert.equal(getGame(GROUP, BOB), game);
    assert.ok(guessLetter(GROUP, BOB, "a"));

    assert.ok(game.guessed.has("a") || game.wrong.includes("a"));
    assert.ok(BOB in game.scores);
    assert.equal(ALICE in game.scores, false);
  });

  it("não entra em quem não tem partida", () => {
    start(ALICE);

    assert.match(joinGame(GROUP, BOB, { target: CAROL }).error, /não tem forca aberta/);
    assert.equal(getGame(GROUP, BOB), null);
  });

  it("sem marcar ninguém, entra na única partida aberta do grupo", () => {
    start(ALICE);
    start(CAROL, OTHER_GROUP);

    assert.ok(joinGame(GROUP, BOB, {}).text);
    assert.equal(getGame(GROUP, BOB), getGame(GROUP, ALICE));
  });

  it("avisa quando não há partida ou há mais de uma", () => {
    assert.match(joinGame(GROUP, CAROL, {}).error, /nenhuma forca aberta/);

    start(ALICE);
    start(BOB);
    const result = joinGame(GROUP, CAROL, {});

    assert.match(result.error, /mais de uma forca/);
    assert.deepEqual(result.mentions, [ALICE, BOB]);
    assert.equal(getGame(GROUP, CAROL), null);
  });

  it("respondendo ao tabuleiro, entra naquela partida", () => {
    start(ALICE);
    start(BOB);
    const { text: quotedText } = describeGame(GROUP, BOB);

    assert.ok(joinGame(GROUP, CAROL, { target: BOT, quotedText }).text);
    assert.equal(getGame(GROUP, CAROL), getGame(GROUP, BOB));
  });

  it("quem entrou pode sair sem encerrar a partida", () => {
    start(ALICE);
    const game = getGame(GROUP, ALICE);
    joinGame(GROUP, BOB, { target: ALICE });

    assert.ok(leaveGame(GROUP, BOB));

    assert.equal(getGame(GROUP, BOB), null);
    assert.equal(getGame(GROUP, ALICE), game);
    assert.deepEqual(game.players, [ALICE]);
    assert.equal(leaveGame(GROUP, ALICE), null);
  });

  it("encerrar a partida libera todo mundo que estava nela", () => {
    start(ALICE);
    joinGame(GROUP, BOB, { target: ALICE });

    stopGame(GROUP, ALICE);

    assert.equal(getGame(GROUP, ALICE), null);
    assert.equal(getGame(GROUP, BOB), null);
  });
});

describe("forca: níveis de dificuldade", () => {
  const LEVELS = Object.keys(HANGMAN_LEVELS);
  const startAt = (level, category = null) =>
    startGame({ groupId: GROUP, starter: ALICE, category, level, send: async () => {} });
  const lettersOf = (word) => [...new Set([...normalize(word)].filter((c) => /[a-z]/.test(c)))];

  afterEach(() => stopGame(GROUP, ALICE));

  it("toda categoria tem palavras em todos os níveis, sem repetir", () => {
    for (const category of HANGMAN_CATEGORIES) {
      const words = Object.values(HANGMAN_WORDS[category]).flat();

      assert.deepEqual(Object.keys(HANGMAN_WORDS[category]), LEVELS, category);
      assert.equal(new Set(words).size, words.length, `repetida em ${category}`);

      for (const level of LEVELS) {
        assert.ok(HANGMAN_WORDS[category][level].length, `${category}/${level}`);
      }
    }
  });

  it("sorteia a palavra da categoria e do nível pedidos", () => {
    const category = HANGMAN_CATEGORIES[0];

    for (const level of LEVELS) {
      startAt(level, category);
      const game = getGame(GROUP, ALICE);

      assert.equal(game.level, level);
      assert.ok(HANGMAN_WORDS[category][level].includes(game.word));
      stopGame(GROUP, ALICE);
    }
  });

  it("pontua e desconta conforme o nível", () => {
    for (const level of LEVELS) {
      const { hit, miss, wrongWord } = HANGMAN_LEVELS[level];
      startAt(level);
      const game = getGame(GROUP, ALICE);
      const [letter] = lettersOf(game.word);
      const occurrences = [...normalize(game.word)].filter((c) => c === letter).length;
      const absent = [..."kwyxzqjhfbvgpdutscrnmlioea"].find((c) => !lettersOf(game.word).includes(c));

      guessLetter(GROUP, ALICE, letter);
      assert.equal(game.scores[ALICE], occurrences * hit);

      guessLetter(GROUP, ALICE, absent);
      assert.equal(game.scores[ALICE], occurrences * hit - miss);

      guessWord(GROUP, ALICE, "palavra errada");
      assert.equal(game.scores[ALICE], occurrences * hit - miss - wrongWord);
      assert.equal(game.lives, 3);
      stopGame(GROUP, ALICE);
    }
  });

  it("nível mais alto sempre vale mais e tira mais", () => {
    const [easy, medium, hard] = LEVELS.map((level) => HANGMAN_LEVELS[level]);

    for (const rule of ["hit", "miss", "wordBonus", "wrongWord", "finishBonus"]) {
      assert.ok(easy[rule] < medium[rule] && medium[rule] < hard[rule], rule);
    }
  });

  it("reconhece o nível com ou sem acento", () => {
    assert.equal(findLevel("Difícil"), "dificil");
    assert.equal(findLevel("medio"), "medio");
    assert.equal(findLevel("animal"), null);
    assert.equal(findLevel("constructor"), null);
  });

  it("não confunde a categoria com o 'e' de outro nome", () => {
    assert.match(findCategory("escola"), /Escola/);
    assert.match(findCategory("esporte"), /Esporte/);
    assert.match(findCategory("frase"), /Ditados/);
  });
});
