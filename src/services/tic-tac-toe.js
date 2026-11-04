/**
 * Motor do Jogo da Velha (X ⭕ O) para grupos.
 *
 * - Uma partida por grupo, mantida em memória.
 * - X sempre começa; na revanche os símbolos se invertem.
 * - Jogadas: o jogador da vez manda só o número (1-9) no grupo.
 * - Pode jogar contra o próprio bot (com minimax).
 *
 * @author bot_marc
 */
import { addTicTacToeResult } from "../utils/database.js";
import { onlyNumbers } from "../utils/index.js";

export const BOT_PLAYER = "bot";

const INVITE_TIMEOUT_MS = 60 * 1000;
const TURN_TIMEOUT_MS = 90 * 1000;
const REMATCH_WINDOW_MS = 3 * 60 * 1000;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const SYMBOL_EMOJI = { X: "❌", O: "⭕" };
const WIN_EMOJI = { X: "❎", O: "🟢" };

const TAUNTS = [
  "Jogada calculada... ou foi sorte? 🤔",
  "A tensão tá no ar! 😬",
  "Isso foi frio. 🥶",
  "O tabuleiro tá pegando fogo! 🔥",
  "Hmm, interessante... 🧐",
  "Sem pressão. Só o grupo inteiro olhando. 👀",
  "Respira e pensa! 🧘",
];

const BOT_TAUNTS = [
  "🤖 Calculei 255.168 partidas possíveis. Sua vez, humano.",
  "🤖 Bip bop. Previsível.",
  "🤖 Meu processador nem esquentou.",
  "🤖 Interessante... mas inútil.",
  "🤖 Eu vi essa jogada chegando há 3 rodadas.",
];

/** @type {Map<string, any>} */
const games = new Map();

const mention = (player) =>
  player === BOT_PLAYER ? "🤖 *Bot*" : `@${onlyNumbers(player)}`;

const mentionsOf = (...players) =>
  players.filter((player) => player && player !== BOT_PLAYER);

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const other = (symbol) => (symbol === "X" ? "O" : "X");

function getWinner(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], line };
    }
  }

  return null;
}

const isFull = (board) => board.every(Boolean);

const freeCells = (board) =>
  board.map((cell, index) => (cell ? null : index)).filter((i) => i !== null);

/** Quantas linhas o símbolo pode fechar na próxima jogada. */
function countThreats(board, symbol) {
  return LINES.filter((line) => {
    const cells = line.map((i) => board[i]);
    return (
      cells.filter((cell) => cell === symbol).length === 2 &&
      cells.filter((cell) => !cell).length === 1
    );
  }).length;
}

export function renderBoard(board, winLine = []) {
  const cell = (index) => {
    const value = board[index];
    if (!value) return NUMBER_EMOJIS[index];
    return winLine.includes(index) ? WIN_EMOJI[value] : SYMBOL_EMOJI[value];
  };

  const row = (r) => `      ${cell(r * 3)} ┃ ${cell(r * 3 + 1)} ┃ ${cell(r * 3 + 2)}`;

  return [row(0), "     ━━━╋━━━╋━━━", row(1), "     ━━━╋━━━╋━━━", row(2)].join(
    "\n"
  );
}

function scoreLine(game) {
  const x = game.players.X;
  const o = game.players.O;
  const sx = game.series[x] || 0;
  const so = game.series[o] || 0;

  return `📊 *Placar da série:* ${mention(x)} ${sx} x ${so} ${mention(o)}${
    game.series.draws ? ` (🤝 ${game.series.draws} empate${game.series.draws > 1 ? "s" : ""})` : ""
  }`;
}

function header(game) {
  return `🎮 *JOGO DA VELHA* — Rodada ${game.round}\n${SYMBOL_EMOJI.X} ${mention(
    game.players.X
  )}  🆚  ${SYMBOL_EMOJI.O} ${mention(game.players.O)}`;
}

function turnLine(game) {
  const player = game.players[game.turn];
  return `👉 Vez de ${mention(player)} (${SYMBOL_EMOJI[game.turn]})\n_Mande só o número da casa (1-9). ⏱️ ${
    TURN_TIMEOUT_MS / 1000
  }s_`;
}

function clearTimer(game) {
  if (game?.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

function setTimer(groupId, game, ms, callback) {
  clearTimer(game);
  game.timer = setTimeout(() => {
    if (games.get(groupId) === game) {
      callback().catch(() => {});
    }
  }, ms);
}

/** Troca o marcador {prefix} pelo prefixo real do grupo. */
export const withPrefix = (text, prefix) => text.replaceAll("{prefix}", prefix);

export function getGame(groupId) {
  return games.get(groupId) || null;
}

export function isInGame(game, player) {
  return game.players.X === player || game.players.O === player;
}

/**
 * Cria um convite. Retorna o texto e menções a enviar.
 */
export function createInvite({ groupId, challenger, challenged, send, difficulty }) {
  const vsBot = challenged === BOT_PLAYER;

  const game = {
    status: vsBot ? "playing" : "pending",
    players: { X: challenger, O: challenged },
    board: Array(9).fill(null),
    turn: "X",
    round: 1,
    series: { draws: 0 },
    vsBot,
    difficulty: difficulty || "normal",
    send,
    timer: null,
    moves: 0,
  };

  games.set(groupId, game);

  if (vsBot) {
    startTurnTimer(groupId, game);
    return {
      text: `${header(game)}\n🧠 Dificuldade: *${game.difficulty}*\n\n${renderBoard(
        game.board
      )}\n\n${turnLine(game)}`,
      mentions: mentionsOf(challenger),
    };
  }

  setTimer(groupId, game, INVITE_TIMEOUT_MS, async () => {
    games.delete(groupId);
    await send(
      `⌛ ${mention(challenged)} amarelou! O desafio de ${mention(
        challenger
      )} expirou. 🐔`,
      mentionsOf(challenger, challenged)
    );
  });

  return {
    text: `⚔️ *DESAFIO LANÇADO!* ⚔️\n\n${mention(
      challenger
    )} desafiou ${mention(
      challenged
    )} para um *JOGO DA VELHA*!\n\n${SYMBOL_EMOJI.X} ${mention(
      challenger
    )} joga de *X* (começa)\n${SYMBOL_EMOJI.O} ${mention(
      challenged
    )} joga de *O*\n\n✅ Para aceitar: *{prefix}velha aceitar*\n❌ Para fugir: *{prefix}velha recusar*\n\n_O convite expira em ${
      INVITE_TIMEOUT_MS / 1000
    }s._`,
    mentions: mentionsOf(challenger, challenged),
  };
}

export function acceptInvite(groupId) {
  const game = games.get(groupId);
  game.status = "playing";
  startTurnTimer(groupId, game);

  return {
    text: `🔥 *DESAFIO ACEITO!* Que vença o melhor!\n\n${header(game)}\n\n${renderBoard(
      game.board
    )}\n\n${turnLine(game)}`,
    mentions: mentionsOf(game.players.X, game.players.O),
  };
}

export function cancelGame(groupId) {
  const game = games.get(groupId);
  clearTimer(game);
  games.delete(groupId);
  return game;
}

function startTurnTimer(groupId, game) {
  setTimer(groupId, game, TURN_TIMEOUT_MS, async () => {
    const loser = game.players[game.turn];
    const winner = game.players[other(game.turn)];
    const result = finishGame(groupId, game, winner, loser);
    await game.send(
      `⏰ *TEMPO ESGOTADO!*\n\n${mention(loser)} dormiu no ponto e perdeu por W.O.! 😴\n🏆 Vitória de ${mention(
        winner
      )}!\n\n${result}`,
      mentionsOf(winner, loser)
    );
  });
}

/**
 * Encerra a partida, atualiza placar/ranking e abre janela de revanche.
 */
function finishGame(groupId, game, winner, loser) {
  clearTimer(game);
  game.status = "finished";

  if (winner) {
    game.series[winner] = (game.series[winner] || 0) + 1;
  } else {
    game.series.draws += 1;
  }

  if (!game.vsBot) {
    addTicTacToeResult(groupId, { winner, loser, players: [game.players.X, game.players.O] });
  }

  setTimer(groupId, game, REMATCH_WINDOW_MS, async () => {
    games.delete(groupId);
  });

  return `${scoreLine(game)}\n\n🔁 Revanche? *{prefix}velha revanche*\n_(os símbolos se invertem: quem era ⭕ vira ❌ e começa!)_`;
}

export function surrender(groupId, player) {
  const game = games.get(groupId);
  const loserSymbol = game.players.X === player ? "X" : "O";
  const winner = game.players[other(loserSymbol)];
  const result = finishGame(groupId, game, winner, player);

  return {
    text: `🏳️ ${mention(player)} *jogou a toalha!*\n🏆 Vitória de ${mention(
      winner
    )}!\n\n${renderBoard(game.board)}\n\n${result}`,
    mentions: mentionsOf(player, winner),
  };
}

export function rematch(groupId) {
  const game = games.get(groupId);
  clearTimer(game);

  game.players = { X: game.players.O, O: game.players.X };
  game.board = Array(9).fill(null);
  game.turn = "X";
  game.round += 1;
  game.status = "playing";
  game.moves = 0;

  const intro = `🔁 *REVANCHE!* Os lados se inverteram!\n\n${header(game)}\n${scoreLine(game)}`;

  if (game.vsBot && game.players.X === BOT_PLAYER) {
    const botMove = chooseBotMove(game);
    applyMove(game, botMove);
    startTurnTimer(groupId, game);
    return {
      text: `${intro}\n\n🤖 Bot abriu na casa *${botMove + 1}*.\n\n${renderBoard(
        game.board
      )}\n\n${turnLine(game)}`,
      mentions: mentionsOf(game.players.X, game.players.O),
    };
  }

  startTurnTimer(groupId, game);

  return {
    text: `${intro}\n\n${renderBoard(game.board)}\n\n${turnLine(game)}`,
    mentions: mentionsOf(game.players.X, game.players.O),
  };
}

function applyMove(game, index) {
  game.board[index] = game.turn;
  game.moves += 1;
  game.turn = other(game.turn);
}

function minimax(board, turn, me, depth) {
  const win = getWinner(board);
  if (win) return win.symbol === me ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;

  const scores = freeCells(board).map((i) => {
    board[i] = turn;
    const score = minimax(board, other(turn), me, depth + 1);
    board[i] = null;
    return score;
  });

  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

function chooseBotMove(game) {
  const free = freeCells(game.board);
  const me = game.turn;

  const mistakeChance = { facil: 0.6, normal: 0.25, impossivel: 0 }[
    game.difficulty
  ] ?? 0.25;

  if (Math.random() < mistakeChance) return pick(free);

  let best = -Infinity;
  let bestMoves = [];

  for (const i of free) {
    game.board[i] = me;
    const score = minimax(game.board, other(me), me, 0);
    game.board[i] = null;

    if (score > best) {
      best = score;
      bestMoves = [i];
    } else if (score === best) {
      bestMoves.push(i);
    }
  }

  return pick(bestMoves);
}

/**
 * Descreve a jogada com um comentário "narrador".
 */
function commentary(boardBefore, index, symbol) {
  const enemy = other(symbol);
  const enemyThreatsBefore = countThreats(boardBefore, enemy);

  const after = [...boardBefore];
  after[index] = symbol;

  if (countThreats(after, enemy) < enemyThreatsBefore) {
    return "🛡️ *DEFESAÇA!* Bloqueou na hora certa!";
  }

  const myThreats = countThreats(after, symbol);
  if (myThreats >= 2) return "💣 *ARMADILHA DUPLA!* Duas ameaças de uma vez!";
  if (myThreats === 1) return "⚠️ *Ameaça no tabuleiro!* Cuidado...";
  if (index === 4 && boardBefore.every((cell) => !cell)) {
    return "🎯 Começou pelo centro. Clássico de quem sabe jogar.";
  }

  return pick(TAUNTS);
}

/**
 * Processa a jogada de um jogador. Retorna null se a mensagem
 * não for uma jogada válida para esse grupo/jogador.
 *
 * @returns {{ text: string, mentions: string[] } | { error: string } | null}
 */
export function playMove(groupId, player, cellNumber) {
  const game = games.get(groupId);

  if (!game || game.status !== "playing") return null;
  if (!isInGame(game, player)) return null;

  if (game.players[game.turn] !== player) {
    return { error: `⏳ Calma! Agora é a vez de ${mention(game.players[game.turn])}.`, mentions: mentionsOf(game.players[game.turn]) };
  }

  const index = cellNumber - 1;

  if (game.board[index]) {
    return { error: `🚫 A casa *${cellNumber}* já está ocupada! Escolha outra.`, mentions: [] };
  }

  const symbol = game.turn;
  const before = [...game.board];
  applyMove(game, index);

  const ending = checkEnd(groupId, game);
  if (ending) return ending;

  let text = `${SYMBOL_EMOJI[symbol]} ${mention(player)} jogou na casa *${cellNumber}*\n${commentary(
    before,
    index,
    symbol
  )}`;

  if (game.vsBot) {
    const botBefore = [...game.board];
    const botSymbol = game.turn;
    const botMove = chooseBotMove(game);
    applyMove(game, botMove);

    text += `\n\n🤖 Bot jogou na casa *${botMove + 1}*\n${
      Math.random() < 0.5 ? pick(BOT_TAUNTS) : commentary(botBefore, botMove, botSymbol)
    }`;

    const botEnding = checkEnd(groupId, game, text);
    if (botEnding) return botEnding;
  }

  startTurnTimer(groupId, game);

  return {
    text: `${header(game)}\n\n${text}\n\n${renderBoard(game.board)}\n\n${turnLine(game)}`,
    mentions: mentionsOf(game.players.X, game.players.O),
  };
}

function checkEnd(groupId, game, prefixText = "") {
  const win = getWinner(game.board);
  const pre = prefixText ? `${prefixText}\n\n` : "";

  if (win) {
    const winner = game.players[win.symbol];
    const loser = game.players[other(win.symbol)];
    const result = finishGame(groupId, game, winner, loser);
    const flawless = game.moves <= 5 ? "\n⚡ *VITÓRIA RELÂMPAGO!* Em só " + game.moves + " jogadas!" : "";

    const title =
      winner === BOT_PLAYER
        ? "🤖 *O BOT VENCEU!* As máquinas dominarão o mundo. 🌍"
        : `🏆 *${mention(winner)} VENCEU!* 🎉🎉🎉`;

    return {
      text: `${pre}${renderBoard(game.board, win.line)}\n\n${title}${flawless}\n${
        loser === BOT_PLAYER ? "🤖 Erro 404: vitória não encontrada... 💀" : `${mention(loser)} foi de base. 🪦`
      }\n\n${result}`,
      mentions: mentionsOf(winner, loser),
    };
  }

  if (isFull(game.board)) {
    const result = finishGame(groupId, game, null, null);
    return {
      text: `${pre}${renderBoard(game.board)}\n\n👵 *DEU VELHA!* Empate técnico, ninguém leva.\n\n${result}`,
      mentions: mentionsOf(game.players.X, game.players.O),
    };
  }

  return null;
}

export function describeGame(groupId) {
  const game = games.get(groupId);
  if (!game) return null;

  if (game.status === "pending") {
    return {
      text: `⏳ Há um desafio pendente: ${mention(game.players.X)} 🆚 ${mention(
        game.players.O
      )}`,
      mentions: mentionsOf(game.players.X, game.players.O),
    };
  }

  return {
    text: `${header(game)}\n\n${renderBoard(game.board)}\n\n${
      game.status === "playing" ? turnLine(game) : scoreLine(game)
    }`,
    mentions: mentionsOf(game.players.X, game.players.O),
  };
}
