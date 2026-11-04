/**
 * Motor do Jogo de Damas (regras brasileiras) para grupos.
 *
 * Regras:
 * - Tabuleiro 8x8, 12 peças cada, brancas (⚪) começam.
 * - Peça anda 1 casa na diagonal pra frente, mas CAPTURA pra frente e pra trás.
 * - Dama (🤍/🖤) anda e captura à distância ("dama voadora").
 * - Captura é obrigatória e vale a LEI DA MAIORIA (tem que capturar o máximo).
 * - Peça só vira dama se TERMINAR a jogada na última fileira.
 * - 20 lances seguidos só de damas, sem captura = empate.
 *
 * Jeito WhatsApp: o bot lista as jogadas válidas numeradas e o
 * jogador manda só o número. Saltos múltiplos são uma opção só.
 *
 * @author bot_marc
 */
import { addCheckersResult } from "../utils/database.js";
import { onlyNumbers } from "../utils/index.js";

export const BOT_PLAYER = "bot";

const INVITE_TIMEOUT_MS = 60 * 1000;
const TURN_TIMEOUT_MS = 3 * 60 * 1000;
const REMATCH_WINDOW_MS = 3 * 60 * 1000;
const DRAW_KING_MOVES = 20;

const DIRECTIONS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const PIECE_EMOJI = { w: "⚪", W: "🤍", b: "⚫", B: "🖤" };
const DARK = "🟫";
const LIGHT = "⬜";
const BOOM = "💥";
const FROM_MARK = "🟨";
const ROW_LABELS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
// Letras regionais separadas por espaço invisível (sem isso viram bandeiras).
const COL_HEADER = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭"].join("​");
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const COLOR_NAME = { w: "⚪ Brancas", b: "⚫ Pretas" };

/** @type {Map<string, any>} */
const games = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const mention = (player) =>
  player === BOT_PLAYER ? "🤖 *Bot*" : `@${onlyNumbers(player)}`;
const mentionsOf = (...players) => players.filter((p) => p && p !== BOT_PLAYER);
const enemyOf = (color) => (color === "w" ? "b" : "w");

/** Troca o marcador {prefix} pelo prefixo real do grupo. */
export const withPrefix = (text, prefix) => text.replaceAll("{prefix}", prefix);

// ---------- Tabuleiro ----------

const idx = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const colorOf = (piece) => piece && piece.toLowerCase();
const isKing = (piece) => piece === "W" || piece === "B";
const squareName = (i) => `${"abcdefgh"[i % 8]}${Math.floor(i / 8) + 1}`;

export function parseSquare(text) {
  const match = /^([a-h])([1-8])$/i.exec(text.trim());
  if (!match) return null;
  return idx(Number(match[2]) - 1, "abcdefgh".indexOf(match[1].toLowerCase()));
}

function initialBoard() {
  const board = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 0) continue; // só casas escuras (a1 é escura)
      if (r <= 2) board[idx(r, c)] = "w";
      if (r >= 5) board[idx(r, c)] = "b";
    }
  }
  return board;
}

export function renderBoard(board, highlight = {}) {
  const lines = [`🔲${COL_HEADER}`];

  for (let r = 7; r >= 0; r--) {
    let line = ROW_LABELS[r];
    for (let c = 0; c < 8; c++) {
      const i = idx(r, c);
      if (highlight.captured?.includes(i)) line += BOOM;
      else if (board[i]) line += PIECE_EMOJI[board[i]];
      else if (highlight.from === i) line += FROM_MARK;
      else line += (r + c) % 2 === 0 ? DARK : LIGHT;
    }
    lines.push(line);
  }

  return lines.join("\n");
}

// ---------- Geração de jogadas ----------

function captureSequences(board, from) {
  const piece = board[from];
  const color = colorOf(piece);
  const king = isKing(piece);
  const results = [];

  const work = [...board];
  work[from] = null; // a peça "sai" da origem durante o salto

  function dfs(pos, path, captured) {
    const r = Math.floor(pos / 8);
    const c = pos % 8;
    let extended = false;

    for (const [dr, dc] of DIRECTIONS) {
      let rr = r + dr;
      let cc = c + dc;

      if (king) {
        while (inside(rr, cc) && !work[idx(rr, cc)]) {
          rr += dr;
          cc += dc;
        }
      }

      if (!inside(rr, cc)) continue;
      const mid = idx(rr, cc);
      const target = work[mid];
      if (!target || colorOf(target) === color || captured.includes(mid)) continue;

      let lr = rr + dr;
      let lc = cc + dc;

      while (inside(lr, lc) && !work[idx(lr, lc)]) {
        const land = idx(lr, lc);
        extended = true;
        dfs(land, [...path, land], [...captured, mid]);
        if (!king) break;
        lr += dr;
        lc += dc;
      }
    }

    if (!extended && captured.length) {
      results.push({ from, path, captured });
    }
  }

  dfs(from, [], []);
  return results;
}

function simpleMoves(board, from) {
  const piece = board[from];
  const color = colorOf(piece);
  const king = isKing(piece);
  const forward = color === "w" ? 1 : -1;
  const r = Math.floor(from / 8);
  const c = from % 8;
  const moves = [];

  for (const [dr, dc] of DIRECTIONS) {
    if (!king && dr !== forward) continue;

    let rr = r + dr;
    let cc = c + dc;

    while (inside(rr, cc) && !board[idx(rr, cc)]) {
      moves.push({ from, path: [idx(rr, cc)], captured: [] });
      if (!king) break;
      rr += dr;
      cc += dc;
    }
  }

  return moves;
}

export function legalMoves(board, color) {
  let captures = [];
  let maxCaptured = 0;

  for (let i = 0; i < 64; i++) {
    if (colorOf(board[i]) !== color) continue;
    for (const seq of captureSequences(board, i)) {
      if (seq.captured.length > maxCaptured) {
        maxCaptured = seq.captured.length;
        captures = [seq];
      } else if (seq.captured.length === maxCaptured) {
        captures.push(seq);
      }
    }
  }

  if (captures.length) {
    // remove duplicatas (mesma origem, destino e peças capturadas)
    const seen = new Set();
    return captures.filter((m) => {
      const key = `${m.from}-${m.path.at(-1)}-${[...m.captured].sort().join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const moves = [];
  for (let i = 0; i < 64; i++) {
    if (colorOf(board[i]) === color) moves.push(...simpleMoves(board, i));
  }
  return moves;
}

/** Aplica a jogada e diz se virou dama. */
function applyMove(board, move) {
  const piece = board[move.from];
  const to = move.path.at(-1);
  board[move.from] = null;
  for (const i of move.captured) board[i] = null;

  const lastRow = colorOf(piece) === "w" ? 7 : 0;
  const promoted = !isKing(piece) && Math.floor(to / 8) === lastRow;
  board[to] = promoted ? piece.toUpperCase() : piece;

  return { promoted, wasKing: isKing(piece) };
}

export function moveLabel(move) {
  const sep = move.captured.length ? " ✖ " : " ➜ ";
  const squares = [move.from, ...move.path].map(squareName).join(sep);
  return move.captured.length
    ? `${squares}  _(${BOOM}${move.captured.length})_`
    : squares;
}

// ---------- IA ----------

function evaluate(board, color) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece) continue;
    const row = Math.floor(i / 8);
    const col = i % 8;
    const advance = colorOf(piece) === "w" ? row : 7 - row;
    let value = isKing(piece) ? 330 : 100 + advance * 4;
    if (col === 0 || col === 7) value += 3; // laterais são seguras
    if (!isKing(piece) && advance === 0) value += 6; // guarda a última fileira
    score += colorOf(piece) === color ? value : -value;
  }
  return score;
}

function search(board, color, me, depth, alpha, beta) {
  const moves = legalMoves(board, color);
  if (!moves.length) return color === me ? -100000 - depth : 100000 + depth;
  if (depth === 0) return evaluate(board, me);

  const maximizing = color === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const next = [...board];
    applyMove(next, move);
    const score = search(next, enemyOf(color), me, depth - 1, alpha, beta);

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }

  return best;
}

function chooseBotMove(game) {
  const moves = legalMoves(game.board, game.turn);
  const config = { facil: [1, 0.35], normal: [3, 0.1], dificil: [5, 0] }[game.difficulty] || [3, 0.1];
  const [depth, mistake] = config;

  if (moves.length === 1) return moves[0];
  if (Math.random() < mistake) return pick(moves);

  let best = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    const next = [...game.board];
    applyMove(next, move);
    const score = search(next, enemyOf(game.turn), game.turn, depth, -Infinity, Infinity);
    if (score > best) {
      best = score;
      bestMoves = [move];
    } else if (score === best) {
      bestMoves.push(move);
    }
  }

  return pick(bestMoves);
}

// ---------- Partida ----------

function countPieces(board, color) {
  return board.filter((p) => colorOf(p) === color).length;
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
    if (games.get(groupId) === game) callback().catch(() => {});
  }, ms);
}

export function getGame(groupId) {
  return games.get(groupId) || null;
}

export function isInGame(game, player) {
  return game.players.w === player || game.players.b === player;
}

function header(game) {
  return `♟️ *DAMAS* — Partida ${game.round}\n${COLOR_NAME.w}: ${mention(game.players.w)}  (${countPieces(
    game.board,
    "w"
  )})\n${COLOR_NAME.b}: ${mention(game.players.b)}  (${countPieces(game.board, "b")})`;
}

function movesList(game) {
  const player = game.players[game.turn];
  const forced = game.moves[0]?.captured.length;
  const list = game.moves
    .map((move, i) => `${KEYCAPS[i] || `*${i + 1}.*`} ${moveLabel(move)}`)
    .join("\n");

  return `👉 Vez de ${mention(player)} (${COLOR_NAME[game.turn]})${
    forced ? `\n⚠️ *Captura obrigatória!*` : ""
  }\n\n${list}\n\n_Mande só o número da jogada. ⏱️ ${TURN_TIMEOUT_MS / 60000} min_`;
}

function legend() {
  return `_⚪⚫ peça · 🤍🖤 dama · 🟨 saiu · ${BOOM} capturada_`;
}

function boardMessage(game, narration = "", highlight = {}) {
  return `${header(game)}\n\n${renderBoard(game.board, highlight)}\n${legend()}\n${
    narration ? `\n${narration}\n` : ""
  }\n${movesList(game)}`;
}

export function createInvite({ groupId, challenger, challenged, send, difficulty }) {
  const vsBot = challenged === BOT_PLAYER;

  const game = {
    status: vsBot ? "playing" : "pending",
    players: { w: challenger, b: challenged },
    board: initialBoard(),
    turn: "w",
    moves: [],
    round: 1,
    series: { draws: 0 },
    kingMoves: 0,
    drawOffer: null,
    vsBot,
    difficulty: difficulty || "normal",
    send,
    timer: null,
  };
  game.moves = legalMoves(game.board, "w");
  games.set(groupId, game);

  if (vsBot) {
    startTurnTimer(groupId, game);
    return {
      text: `🤖 *Bot topou o desafio!* Dificuldade: *${game.difficulty}*\n\n${boardMessage(game)}`,
      mentions: mentionsOf(challenger),
    };
  }

  setTimer(groupId, game, INVITE_TIMEOUT_MS, async () => {
    games.delete(groupId);
    await send(
      `⌛ ${mention(challenged)} não apareceu pro tabuleiro. Desafio de ${mention(challenger)} expirou! 🐔`,
      mentionsOf(challenger, challenged)
    );
  });

  return {
    text: `♟️ *DESAFIO DE DAMAS!* ♟️\n\n${mention(challenger)} desafiou ${mention(
      challenged
    )}!\n\n${COLOR_NAME.w}: ${mention(challenger)} (começa)\n${COLOR_NAME.b}: ${mention(
      challenged
    )}\n\n✅ Aceitar: *{prefix}dama aceitar*\n❌ Fugir: *{prefix}dama recusar*\n\n_Expira em ${
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
    text: `🔥 *DESAFIO ACEITO!* Que comece a batalha!\n\n${boardMessage(game)}`,
    mentions: mentionsOf(game.players.w, game.players.b),
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
    const winner = game.players[enemyOf(game.turn)];
    const result = finishGame(groupId, game, winner, loser);
    await game.send(
      `⏰ *TEMPO ESGOTADO!* ${mention(loser)} abandonou o tabuleiro.\n🏆 Vitória de ${mention(
        winner
      )} por W.O.!\n\n${result}`,
      mentionsOf(winner, loser)
    );
  });
}

function finishGame(groupId, game, winner, loser) {
  clearTimer(game);
  game.status = "finished";

  if (winner) game.series[winner] = (game.series[winner] || 0) + 1;
  else game.series.draws += 1;

  if (!game.vsBot) {
    addCheckersResult(groupId, { winner, loser, players: [game.players.w, game.players.b] });
  }

  setTimer(groupId, game, REMATCH_WINDOW_MS, async () => games.delete(groupId));

  const w = game.players.w;
  const b = game.players.b;
  return `📊 *Série:* ${mention(w)} ${game.series[w] || 0} x ${game.series[b] || 0} ${mention(b)}${
    game.series.draws ? ` (🤝 ${game.series.draws})` : ""
  }\n\n🔁 Revanche? *{prefix}dama revanche* _(as cores se invertem)_`;
}

/**
 * Executa a jogada da vez e devolve a narração (ou o fim de jogo).
 */
function executeMove(groupId, game, move) {
  const player = game.players[game.turn];
  const color = game.turn;
  const { promoted, wasKing } = applyMove(game.board, move);

  game.kingMoves = wasKing && !move.captured.length ? game.kingMoves + 1 : 0;
  game.drawOffer = null;

  const count = move.captured.length;
  const lines = [`${PIECE_EMOJI[wasKing ? color.toUpperCase() : color]} ${mention(player)}: *${moveLabel(move)}*`];

  if (count >= 4) lines.push(`🌪️ *ARRASTÃO!* ${count} peças de uma vez!`);
  else if (count === 3) lines.push("🔥 *CAPTURA TRIPLA!*");
  else if (count === 2) lines.push("💥 *CAPTURA DUPLA!*");
  else if (count === 1) lines.push("😋 Comeu uma peça!");
  if (promoted) lines.push("👑 *VIROU DAMA!*");

  game.turn = enemyOf(color);
  game.moves = legalMoves(game.board, game.turn);

  const highlight = { from: move.from, captured: move.captured };

  if (!game.moves.length) {
    const loser = game.players[game.turn];
    const noPieces = countPieces(game.board, game.turn) === 0;
    const result = finishGame(groupId, game, player, loser);

    return {
      done: true,
      narration: lines.join("\n"),
      highlight,
      ending: `${noPieces ? "☠️ Não sobrou nenhuma peça!" : "🔒 Sem jogadas possíveis — trancado!"}\n${
        player === BOT_PLAYER ? "🤖 *O BOT VENCEU!* Xeque-mate... digo, xeque-dama." : `🏆 *${mention(player)} VENCEU!* 🎉🎉🎉`
      }\n\n${result}`,
    };
  }

  if (game.kingMoves >= DRAW_KING_MOVES) {
    const result = finishGame(groupId, game, null, null);
    return {
      done: true,
      narration: lines.join("\n"),
      highlight,
      ending: `🤝 *EMPATE!* ${DRAW_KING_MOVES} lances de dama sem captura.\n\n${result}`,
    };
  }

  return { done: false, narration: lines.join("\n"), highlight };
}

function resolveInput(game, text) {
  const value = text.trim().toLowerCase();

  if (/^\d{1,2}$/.test(value)) {
    return game.moves[Number(value) - 1] || null;
  }

  const squares = value.split(/[\s\-x>➜✖]+/).filter(Boolean).map(parseSquare);
  if (squares.length < 2 || squares.includes(null)) return null;

  const [from, ...rest] = squares;
  return (
    game.moves.find(
      (m) => m.from === from && rest.every((sq, i) => sq === m.path[i] || (i === rest.length - 1 && sq === m.path.at(-1)))
    ) || null
  );
}

/** Diz se o texto parece uma jogada de damas. */
export function looksLikeMove(text) {
  const value = (text || "").trim().toLowerCase();
  return /^\d{1,2}$/.test(value) || /^[a-h][1-8]([\s\-x>➜✖]+[a-h][1-8])+$/.test(value);
}

/**
 * @returns {{ text: string, mentions: string[] } | { error: string, mentions: string[] } | null}
 */
export function playMove(groupId, player, text) {
  const game = games.get(groupId);
  if (!game || game.status !== "playing" || !isInGame(game, player)) return null;

  if (game.players[game.turn] !== player) {
    return {
      error: `⏳ Calma! É a vez de ${mention(game.players[game.turn])}.`,
      mentions: mentionsOf(game.players[game.turn]),
    };
  }

  const move = resolveInput(game, text);

  if (!move) {
    return {
      error: `🚫 Jogada inválida! Escolha um número de 1 a ${game.moves.length}${
        game.moves[0]?.captured.length ? " (lembre: *captura é obrigatória*)" : ""
      }.`,
      mentions: [],
    };
  }

  let result = executeMove(groupId, game, move);
  let narration = result.narration;

  if (!result.done && game.vsBot) {
    const botMove = chooseBotMove(game);
    result = executeMove(groupId, game, botMove);
    narration += `\n\n${result.narration}`;
  }

  const all = mentionsOf(game.players.w, game.players.b);

  if (result.done) {
    return {
      text: `${header(game)}\n\n${renderBoard(game.board, result.highlight)}\n\n${narration}\n\n${result.ending}`,
      mentions: all,
    };
  }

  startTurnTimer(groupId, game);
  return { text: boardMessage(game, narration, result.highlight), mentions: all };
}

export function surrender(groupId, player) {
  const game = games.get(groupId);
  const color = game.players.w === player ? "w" : "b";
  const winner = game.players[enemyOf(color)];
  const result = finishGame(groupId, game, winner, player);
  return {
    text: `🏳️ ${mention(player)} *derrubou o rei... digo, a dama!* Desistiu.\n🏆 Vitória de ${mention(
      winner
    )}!\n\n${result}`,
    mentions: mentionsOf(player, winner),
  };
}

/** Proposta de empate: o outro jogador aceita mandando o mesmo comando. */
export function offerDraw(groupId, player) {
  const game = games.get(groupId);

  if (game.vsBot) {
    return { text: "🤖 Empate? Eu não negocio com humanos. Joga aí! 😤", mentions: [] };
  }

  if (game.drawOffer && game.drawOffer !== player) {
    const result = finishGame(groupId, game, null, null);
    return {
      text: `🤝 *EMPATE ACORDADO!* Paz no tabuleiro.\n\n${result}`,
      mentions: mentionsOf(game.players.w, game.players.b),
    };
  }

  game.drawOffer = player;
  const other = game.players.w === player ? game.players.b : game.players.w;
  return {
    text: `🤝 ${mention(player)} propôs *empate*!\n${mention(other)}, aceita? Mande *{prefix}dama empate*.\n_(Qualquer jogada cancela a proposta.)_`,
    mentions: mentionsOf(player, other),
  };
}

export function rematch(groupId) {
  const game = games.get(groupId);
  clearTimer(game);

  game.players = { w: game.players.b, b: game.players.w };
  game.board = initialBoard();
  game.turn = "w";
  game.round += 1;
  game.kingMoves = 0;
  game.drawOffer = null;
  game.status = "playing";
  game.moves = legalMoves(game.board, "w");

  let narration = "🔁 *REVANCHE!* As cores se inverteram!";

  if (game.vsBot && game.players.w === BOT_PLAYER) {
    const botMove = chooseBotMove(game);
    const result = executeMove(groupId, game, botMove);
    narration += `\n\n${result.narration}`;
  }

  startTurnTimer(groupId, game);
  return {
    text: boardMessage(game, narration),
    mentions: mentionsOf(game.players.w, game.players.b),
  };
}

export function describeGame(groupId) {
  const game = games.get(groupId);
  if (!game) return null;

  if (game.status === "pending") {
    return {
      text: `⏳ Desafio pendente: ${mention(game.players.w)} 🆚 ${mention(game.players.b)}`,
      mentions: mentionsOf(game.players.w, game.players.b),
    };
  }

  return {
    text:
      game.status === "playing"
        ? boardMessage(game)
        : `${header(game)}\n\n${renderBoard(game.board)}\n\n_Partida encerrada._`,
    mentions: mentionsOf(game.players.w, game.players.b),
  };
}
