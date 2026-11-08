/**
 * Motor do Jogo da Forca para grupos.
 *
 * - Cada pessoa joga a própria partida, e várias rolam ao mesmo tempo no grupo.
 * - Ninguém fica em duas partidas ao mesmo tempo, nem em grupos diferentes.
 * - Quem quiser jogar junto entra na partida de outra pessoa. Abrir para o grupo
 *   todo não serve: letras soltas da conversa ("k", "s", "n") gastariam vidas.
 * - Os pontos ganhos e perdidos dependem do nível (HANGMAN_LEVELS).
 * - Letra errada custa 1 vida; chute errado custa 2.
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
const BOARD_OWNER = /Jogador(?:es)?:\* @(\d+)/;

// hit: por letra certa · miss: letra errada · wordBonus: acertar a palavra
// wrongWord: chute errado · finishBonus: completar a última letra
export const HANGMAN_LEVELS = {
  facil: { label: "Fácil", emoji: "🟢", hit: 1, miss: 1, wordBonus: 5, wrongWord: 2, finishBonus: 3 },
  medio: { label: "Médio", emoji: "🟡", hit: 2, miss: 2, wordBonus: 10, wrongWord: 3, finishBonus: 6 },
  dificil: { label: "Difícil", emoji: "🔴", hit: 3, miss: 3, wordBonus: 20, wrongWord: 5, finishBonus: 10 },
};

const FACES = ["💀", "😱", "😰", "😨", "😟", "😐", "🙂"];

/** @type {Map<string, any>} partida em que cada jogador está (só uma, em qualquer grupo) */
const games = new Map();
/** @type {Map<string, string[]>} palavras recentes por grupo (evita repetir) */
const recentWords = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const mention = (player) => `@${onlyNumbers(player)}`;
const rules = (game) => HANGMAN_LEVELS[game.level];
const wordsIn = (category) => Object.values(HANGMAN_WORDS[category]).flat();

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
        // Sem esse corte, o "e" de "Roupa e acessório" casa com "escola".
        .filter((part) => part.length > 2)
        .some((part) => part.startsWith(wanted) || wanted.startsWith(part))
    ) || null
  );
}

/** Reconhece o nível digitado (com ou sem acento). */
export function findLevel(text) {
  const wanted = normalize(text);

  return Object.hasOwn(HANGMAN_LEVELS, wanted) ? wanted : null;
}

export function levelsText() {
  return Object.values(HANGMAN_LEVELS)
    .map(
      (level) => `${level.emoji} *${level.label}*
✅ Letra certa: +${level.hit} por vez que aparece
❌ Letra errada: -${level.miss}
🎯 Acertou a palavra: +${level.wordBonus} + ${level.hit} por letra escondida
💥 Errou o chute: -${level.wrongWord}
🏁 Completou a última letra: +${level.finishBonus}`
    )
    .join("\n\n");
}

export function categoriesText() {
  return HANGMAN_CATEGORIES.map(
    (category) => `${category} _(${wordsIn(category).length})_`
  ).join("\n");
}

export const totalWords = () =>
  HANGMAN_CATEGORIES.reduce((sum, category) => sum + wordsIn(category).length, 0);

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
  )} letras\n🎚️ *Nível:* ${rules(game).emoji} ${rules(game).label}\n${narration ? `\n${narration}\n` : ""}\n\`\`\`\n${drawGallows(
    game.lives
  )}\n\n${maskedWord(game)}\n\`\`\`\n${livesBar(game.lives)}${wrong}\n\n👉 Mande *uma letra* no grupo\n🎯 Sabe a palavra? *{prefix}forca chute PALAVRA*\n👥 Quer jogar junto? Responda com *{prefix}forca entrar*`;
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

function closeGame(game) {
  clearTimeout(game.timer);

  for (const player of game.players) {
    games.delete(player);
  }
}

function touch(game) {
  clearTimeout(game.timer);
  game.timer = setTimeout(async () => {
    if (games.get(game.starter) !== game) return;
    closeGame(game);
    await game
      .send(
        `💤 A forca ficou abandonada...\nA palavra era: *${game.word.toUpperCase()}*${scoreboard(game)}`,
        allPlayers(game)
      )
      .catch(() => {});
  }, IDLE_TIMEOUT_MS);
}

export function getGame(groupId, player) {
  const game = games.get(player);

  return game?.groupId === groupId ? game : null;
}

function busyText(groupId, player) {
  return games.get(player).groupId === groupId
    ? "Você já está em uma forca! Para sair: *{prefix}forca parar*"
    : "Você já está em uma forca em outro grupo! Termine por lá ou espere 3 minutos sem jogar.";
}

/** Pede o nível antes de começar. Quem já está em uma forca recebe o aviso. */
export function levelPrompt(groupId, player, categoryText) {
  if (games.has(player)) {
    return { error: busyText(groupId, player), mentions: [] };
  }

  const command = ["{prefix}forca", categoryText].filter(Boolean).join(" ");
  const options = Object.entries(HANGMAN_LEVELS)
    .map(([key, { emoji }]) => `${emoji} *${command} ${key}*`)
    .join("\n");

  return {
    text: `🪢 *JOGO DA FORCA*\n🎚️ Escolha a dificuldade:\n\n${options}\n\nQuanto mais difícil, mais pontos você ganha e perde.\n📊 Detalhes: *{prefix}forca niveis*`,
    mentions: [],
  };
}

export function startGame({ groupId, starter, category, level, send }) {
  if (games.has(starter)) {
    return { error: busyText(groupId, starter), mentions: [] };
  }

  const chosenCategory = category || pick(HANGMAN_CATEGORIES);
  const list = HANGMAN_WORDS[chosenCategory][level];
  const recent = recentWords.get(groupId) || [];
  const options = list.filter((w) => !recent.includes(w));
  const word = pick(options.length ? options : list);

  recent.push(word);
  recentWords.set(groupId, recent.slice(-RECENT_LIMIT));

  const game = {
    groupId,
    word,
    category: chosenCategory,
    level,
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

  games.set(starter, game);
  touch(game);

  return { text: boardText(game, "🎬 *Nova palavra sorteada!* Valendo pontos!"), mentions: [starter] };
}

export function stopGame(groupId, player) {
  const game = getGame(groupId, player);
  if (!game) return null;
  closeGame(game);
  return {
    text: `🛑 Forca encerrada. A palavra era: *${game.word.toUpperCase()}*${scoreboard(game)}`,
    mentions: allPlayers(game),
  };
}

/**
 * Coloca a pessoa em uma partida do grupo. Vale, nesta ordem: o tabuleiro
 * respondido, a pessoa marcada ou a única partida aberta.
 *
 * @param {string} groupId
 * @param {string} player
 * @param {{target?: string | null, quotedText?: string}} choice
 */
export function joinGame(groupId, player, { target, quotedText }) {
  if (games.has(player)) {
    return { error: busyText(groupId, player), mentions: [] };
  }

  const open = [...new Set(games.values())].filter((item) => item.groupId === groupId);
  const boardOwner = quotedText?.match(BOARD_OWNER)?.[1];
  const boardGame = boardOwner && open.find((item) => onlyNumbers(item.starter) === boardOwner);
  const game =
    boardGame || (target ? getGame(groupId, target) : open.length === 1 ? open[0] : null);

  if (!game) {
    if (target) return { error: "Essa pessoa não tem forca aberta.", mentions: [] };

    if (!open.length) {
      return { error: "Não tem nenhuma forca aberta. Comece com *{prefix}forca*", mentions: [] };
    }

    return {
      error: `Tem mais de uma forca aberta! Responda ao tabuleiro ou marque quem abriu:\n${open
        .map((item) => mention(item.starter))
        .join("\n")}`,
      mentions: open.map((item) => item.starter),
    };
  }

  game.players.push(player);
  games.set(player, game);
  touch(game);

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
  games.delete(player);

  return {
    text: `👋 ${mention(player)} saiu da forca de ${mention(game.starter)}.`,
    mentions: [player, game.starter],
  };
}

function addScore(game, player, points) {
  game.scores[player] = (game.scores[player] || 0) + points;
}

function finish(groupId, game, won, narration, winner) {
  closeGame(game);
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

  touch(game);

  if (game.guessed.has(letter) || game.wrong.includes(letter)) {
    return { error: `🔁 A letra *${letter.toUpperCase()}* já foi! Tenta outra.`, mentions: [] };
  }

  const hits = [...game.word].filter((c) => normalize(c) === letter).length;

  const { hit, miss, finishBonus } = rules(game);

  if (hits) {
    const points = hits * hit;

    game.guessed.add(letter);
    addScore(game, player, points);

    const narration = `✅ ${mention(player)} acertou o *${letter.toUpperCase()}*${
      hits > 1 ? ` — ${hits} vezes! 🔥` : "!"
    } (+${points})`;

    if (!hiddenCount(game)) {
      addScore(game, player, finishBonus);
      return finish(groupId, game, true, `${narration}\n🏁 Última letra! (+${finishBonus} bônus)`, player);
    }

    return { text: boardText(game, narration), mentions: game.players };
  }

  game.wrong.push(letter);
  game.lives -= 1;
  addScore(game, player, -miss);

  const narration = `❌ ${mention(player)} errou: não tem *${letter.toUpperCase()}*! (-${miss})${
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

  touch(game);

  const attempt = normalize(text).replace(/\s+/g, "-");
  const { hit, wordBonus, wrongWord } = rules(game);

  if (attempt === normalize(game.word)) {
    const bonus = wordBonus + hiddenCount(game) * hit;
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
  addScore(game, player, -wrongWord);

  const narration = `💥 ${mention(player)} chutou *${text.toUpperCase()}*... e errou feio! (-2 vidas, -${wrongWord} pts)`;

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
  touch(game);

  return {
    text: boardText(game, `💡 ${mention(player)} pediu dica: a letra *${letter.toUpperCase()}* foi revelada! (-1 vida)`),
    mentions: game.players,
  };
}

export function describeGame(groupId, player) {
  const game = getGame(groupId, player);
  return game ? { text: boardText(game), mentions: game.players } : null;
}
