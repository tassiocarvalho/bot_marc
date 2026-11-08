/**
 * Motor do Jogo da Forca para grupos.
 *
 * - Cada pessoa joga a própria partida, e várias rolam ao mesmo tempo no grupo.
 * - Quem quiser jogar junto entra na partida de outra pessoa. Abrir para o grupo
 *   todo não serve: letras soltas da conversa ("k", "s", "n") gastariam vidas.
 * - Letra certa: +1 ponto por ocorrência. Letra errada: -1 ponto e -1 vida.
 * - Chutar a palavra: acertou = +5 + 1 por letra escondida; errou = -2 pontos e -2 vidas.
 * - Acentos e Ç são ignorados no chute (A revela Á, Ã, Â...).
 *
 * @author bot_marc
 */
import { addHangmanScores } from "../utils/database.js";
import { onlyNumbers } from "../utils/index.js";
import { HANGMAN_CATEGORIES, HANGMAN_WORDS } from "./hangman-words.js";

const MAX_LIVES = 6;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const RECENT_LIMIT = 80;

const FACES = ["💀", "😱", "😰", "😨", "😟", "😐", "🙂"];

/** @type {Map<string, any>} partida em que cada jogador está, por grupo */
const games = new Map();
/** @type {Map<string, string[]>} palavras recentes por grupo (evita repetir) */
const recentWords = new Map();

const gameKey = (groupId, player) => `${groupId}|${player}`;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const mention = (player) => `@${onlyNumbers(player)}`;

/** Troca o marcador {prefix} pelo prefixo real do grupo. */
export const withPrefix = (text, prefix) => text.replaceAll("{prefix}", prefix);

export const normalize = (text) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const isLetter = (char) => /[a-z]/.test(normalize(char));

export function findCategory(text) {
  const wanted = normalize(text).replace(/[^a-z ]/g, "").trim();
  if (!wanted) return null;

  return (
    HANGMAN_CATEGORIES.find((category) =>
      normalize(category)
        .replace(/[^a-z ]/g, "")
        .trim()
        .split(" ")
        .some((part) => part.startsWith(wanted) || wanted.startsWith(part))
    ) || null
  );
}

export function categoriesText() {
  return HANGMAN_CATEGORIES.map(
    (category) => `${category} _(${HANGMAN_WORDS[category].length})_`
  ).join("\n");
}

export const totalWords = () =>
  Object.values(HANGMAN_WORDS).reduce((sum, list) => sum + list.length, 0);

function drawGallows(lives) {
  const errors = MAX_LIVES - lives;
  const head = errors >= 1 ? FACES[lives] : "";
  const body =
    errors >= 4 ? "/|\\" : errors >= 3 ? "/|" : errors >= 2 ? " |" : "";
  const legs = errors >= 6 ? "/ \\" : errors >= 5 ? "/" : "";

  return [
    "  ┌────┐",
    "  │    │",
    `  │    ${head}`,
    `  │   ${body}`,
    `  │   ${legs}`,
    "  │",
    "══╧══",
  ].join("\n");
}

function maskedWord(game) {
  return [...game.word]
    .map((char) => {
      if (!isLetter(char)) return char === "-" ? "-" : char;
      return game.guessed.has(normalize(char)) ? char.toUpperCase() : "_";
    })
    .join(" ");
}

const hiddenCount = (game) =>
  [...game.word].filter((c) => isLetter(c) && !game.guessed.has(normalize(c))).length;

const lettersCount = (word) => [...word].filter(isLetter).length;

function livesBar(lives) {
  return "❤️".repeat(lives) + "🖤".repeat(MAX_LIVES - lives);
}

function boardText(game, narration = "") {
  const wrong = game.wrong.length
    ? `\n❌ *Erradas:* ${game.wrong.map((l) => l.toUpperCase()).join(" ")}`
    : "";

  return `🪢 *JOGO DA FORCA*\n🎮 *${game.players.length > 1 ? "Jogadores" : "Jogador"}:* ${game.players.map(mention).join(", ")}\n📂 *Dica:* ${game.category} · 🔤 ${lettersCount(
    game.word
  )} letras\n${narration ? `\n${narration}\n` : ""}\n\`\`\`\n${drawGallows(
    game.lives
  )}\n\n${maskedWord(game)}\n\`\`\`\n${livesBar(game.lives)}${wrong}\n\n👉 Mande *uma letra* no grupo\n🎯 Sabe a palavra? *{prefix}forca chute PALAVRA*\n👥 Jogar junto: *{prefix}forca entrar ${mention(game.starter)}*`;
}

function scoreboard(game) {
  const entries = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";

  const medals = ["🥇", "🥈", "🥉"];
  return `\n\n🏅 *Pontuação da rodada:*\n${entries
    .map(([player, pts], i) => `${medals[i] || "▫️"} ${mention(player)}: *${pts}* pt${Math.abs(pts) === 1 ? "" : "s"}`)
    .join("\n")}`;
}

// Inclui quem saiu no meio, para o placar marcar todo mundo que pontuou.
const allPlayers = (game) => [...new Set([...game.players, ...Object.keys(game.scores)])];

function closeGame(groupId, game) {
  clearTimeout(game.timer);

  for (const player of game.players) {
    games.delete(gameKey(groupId, player));
  }
}

function touch(groupId, game) {
  const key = gameKey(groupId, game.starter);

  clearTimeout(game.timer);
  game.timer = setTimeout(async () => {
    if (games.get(key) !== game) return;
    closeGame(groupId, game);
    await game
      .send(
        `💤 A forca ficou abandonada...\nA palavra era: *${game.word.toUpperCase()}*${scoreboard(game)}`,
        allPlayers(game)
      )
      .catch(() => {});
  }, IDLE_TIMEOUT_MS);
}

export function getGame(groupId, player) {
  return games.get(gameKey(groupId, player)) || null;
}

export function startGame({ groupId, starter, category, send }) {
  const chosenCategory = category || pick(HANGMAN_CATEGORIES);
  const recent = recentWords.get(groupId) || [];
  const options = HANGMAN_WORDS[chosenCategory].filter((w) => !recent.includes(w));
  const word = pick(options.length ? options : HANGMAN_WORDS[chosenCategory]);

  recent.push(word);
  recentWords.set(groupId, recent.slice(-RECENT_LIMIT));

  const game = {
    word,
    category: chosenCategory,
    guessed: new Set(),
    wrong: [],
    lives: MAX_LIVES,
    scores: {},
    starter,
    players: [starter],
    hintUsed: false,
    send,
    timer: null,
  };

  games.set(gameKey(groupId, starter), game);
  touch(groupId, game);

  return { text: boardText(game, "🎬 *Nova palavra sorteada!* Valendo pontos!"), mentions: [starter] };
}

export function stopGame(groupId, player) {
  const game = getGame(groupId, player);
  if (!game) return null;
  closeGame(groupId, game);
  return {
    text: `🛑 Forca encerrada. A palavra era: *${game.word.toUpperCase()}*${scoreboard(game)}`,
    mentions: allPlayers(game),
  };
}

/** Coloca a pessoa na partida de outra. Retorna null se a outra não tiver partida. */
export function joinGame(groupId, player, owner) {
  const game = getGame(groupId, owner);
  if (!game) return null;

  game.players.push(player);
  games.set(gameKey(groupId, player), game);
  touch(groupId, game);

  return {
    text: boardText(game, `🤝 ${mention(player)} entrou na partida!`),
    mentions: game.players,
  };
}

/** Tira da partida quem entrou nela. Quem abriu encerra com stopGame. */
export function leaveGame(groupId, player) {
  const game = getGame(groupId, player);
  if (!game || game.starter === player) return null;

  game.players = game.players.filter((current) => current !== player);
  games.delete(gameKey(groupId, player));

  return {
    text: `👋 ${mention(player)} saiu da forca de ${mention(game.starter)}.`,
    mentions: [player, game.starter],
  };
}

function addScore(game, player, points) {
  game.scores[player] = (game.scores[player] || 0) + points;
}

function finish(groupId, game, won, narration, winner) {
  closeGame(groupId, game);
  addHangmanScores(groupId, game.scores, won ? winner : null);

  const ending = won
    ? `🎉 *SALVOU O BONECO!* 🎉\nA palavra era *${game.word.toUpperCase()}*${
        winner ? `\n👑 Quem matou a charada: ${mention(winner)}` : ""
      }`
    : `💀 *ENFORCADO!* 💀\nA palavra era *${game.word.toUpperCase()}*`;

  return {
    text: `${narration}\n\n\`\`\`\n${drawGallows(game.lives)}\n\n${[...game.word]
      .map((c) => (c === "-" ? "-" : c.toUpperCase()))
      .join(" ")}\n\`\`\`\n${ending}${scoreboard(game)}\n\n🔁 Outra? *{prefix}forca*`,
    mentions: allPlayers(game),
  };
}

/**
 * Chute de uma letra na partida de quem mandou.
 * Retorna null se a pessoa não tiver partida aberta.
 */
export function guessLetter(groupId, player, rawLetter) {
  const game = getGame(groupId, player);
  if (!game) return null;

  const letter = normalize(rawLetter);
  if (!/^[a-z]$/.test(letter)) return null;

  touch(groupId, game);

  if (game.guessed.has(letter) || game.wrong.includes(letter)) {
    return { error: `🔁 A letra *${letter.toUpperCase()}* já foi! Tenta outra.`, mentions: [] };
  }

  const hits = [...game.word].filter((c) => normalize(c) === letter).length;

  if (hits) {
    game.guessed.add(letter);
    addScore(game, player, hits);

    const narration = `✅ ${mention(player)} acertou o *${letter.toUpperCase()}*${
      hits > 1 ? ` — ${hits} vezes! 🔥` : "!"
    } (+${hits})`;

    if (!hiddenCount(game)) {
      addScore(game, player, 3);
      return finish(groupId, game, true, `${narration}\n🏁 Última letra! (+3 bônus)`, player);
    }

    return { text: boardText(game, narration), mentions: game.players };
  }

  game.wrong.push(letter);
  game.lives -= 1;
  addScore(game, player, -1);

  const narration = `❌ ${mention(player)} errou: não tem *${letter.toUpperCase()}*! (-1)${
    game.lives === 1 ? "\n😱 *ÚLTIMA VIDA!* Pensa bem!" : ""
  }`;

  if (game.lives <= 0) return finish(groupId, game, false, narration, null);

  return { text: boardText(game, narration), mentions: game.players };
}

/**
 * Chute da palavra inteira.
 */
export function guessWord(groupId, player, text) {
  const game = getGame(groupId, player);
  if (!game) return null;

  touch(groupId, game);

  const attempt = normalize(text).replace(/\s+/g, "-");

  if (attempt === normalize(game.word)) {
    const bonus = 5 + hiddenCount(game);
    addScore(game, player, bonus);
    for (const c of game.word) if (isLetter(c)) game.guessed.add(normalize(c));
    return finish(
      groupId,
      game,
      true,
      `🎯 ${mention(player)} chutou *${text.toUpperCase()}* e ACERTOU EM CHEIO! (+${bonus})`,
      player
    );
  }

  game.lives = Math.max(0, game.lives - 2);
  addScore(game, player, -2);

  const narration = `💥 ${mention(player)} chutou *${text.toUpperCase()}*... e errou feio! (-2 vidas, -2 pts)`;

  if (game.lives <= 0) return finish(groupId, game, false, narration, null);

  return { text: boardText(game, narration), mentions: game.players };
}

/** Revela uma letra ao custo de 1 vida (uma vez por partida). */
export function useHint(groupId, player) {
  const game = getGame(groupId, player);
  if (!game) return null;

  if (game.hintUsed) return { error: "💡 A dica já foi usada nesta palavra!", mentions: [] };
  if (game.lives <= 1) return { error: "💡 Com uma vida só não dá pra pedir dica! 😬", mentions: [] };

  const hidden = [...new Set([...game.word].filter((c) => isLetter(c) && !game.guessed.has(normalize(c))).map(normalize))];
  if (hidden.length <= 1) return { error: "💡 Falta só uma letra, sem dica! 😏", mentions: [] };

  const letter = pick(hidden);
  game.guessed.add(letter);
  game.hintUsed = true;
  game.lives -= 1;
  touch(groupId, game);

  return {
    text: boardText(game, `💡 ${mention(player)} pediu dica: a letra *${letter.toUpperCase()}* foi revelada! (-1 vida)`),
    mentions: game.players,
  };
}

export function describeGame(groupId, player) {
  const game = getGame(groupId, player);
  return game ? { text: boardText(game), mentions: game.players } : null;
}
