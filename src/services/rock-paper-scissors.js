/**
 * Motor do Pedra, Papel e Tesoura (Jokenpô) para grupos.
 *
 * - Partida em série (melhor de 3 por padrão, até melhor de 7).
 * - A escolha é SECRETA: o bot chama cada jogador no privado e
 *   a resposta chega por handleRpsPrivateMessage(), antes do
 *   bloqueio de conversas privadas.
 * - Contra o bot, o jogador escolhe direto no grupo (o bot lacra
 *   a escolha dele antes).
 *
 * @author bot_marc
 */
import { delay } from "baileys";
import { addRpsResult } from "../utils/database.js";
import { onlyNumbers } from "../utils/index.js";

export const BOT_PLAYER = "bot";

const INVITE_TIMEOUT_MS = 60 * 1000;
const ROUND_TIMEOUT_MS = 60 * 1000;
const REMATCH_WINDOW_MS = 3 * 60 * 1000;

const CHOICES = {
  pedra: { emoji: "🪨", name: "Pedra", beats: "tesoura" },
  papel: { emoji: "📄", name: "Papel", beats: "pedra" },
  tesoura: { emoji: "✂️", name: "Tesoura", beats: "papel" },
};

const WIN_PHRASES = {
  pedra: ["🪨 A pedra *esmagou* a tesoura!", "🪨 Tesoura entortada. Pedra não perdoa."],
  papel: ["📄 O papel *embrulhou* a pedra!", "📄 Pedra embrulhada pra presente. 🎁"],
  tesoura: ["✂️ A tesoura *picotou* o papel!", "✂️ Papel virou confete! 🎊"],
};

const TIE_PHRASES = [
  "🤝 *EMPATE!* Mentes brilhantes pensam igual...",
  "🪞 *EMPATE!* Estão lendo a mente um do outro?",
  "😶 *EMPATE!* Ninguém pontua. Tensão aumentando...",
];

const BOT_TAUNTS = [
  "🤖 Eu analisei seus padrões. Você é previsível.",
  "🤖 Bip bop. Calculado.",
  "🤖 Sorte de principiante... ou não.",
  "🤖 Minha rede neural tá rindo agora.",
];

/** @type {Map<string, any>} grupo -> partida */
const games = new Map();
/** @type {Map<string, string>} número do jogador -> grupo */
const playerIndex = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const mention = (player) =>
  player === BOT_PLAYER ? "🤖 *Bot*" : `@${onlyNumbers(player)}`;

const humans = (game) => game.players.filter((player) => player !== BOT_PLAYER);

const show = (choice) => `${CHOICES[choice].emoji} *${CHOICES[choice].name}*`;

/** Troca o marcador {prefix} pelo prefixo real do grupo. */
export const withPrefix = (text, prefix) => text.replaceAll("{prefix}", prefix);

export function parseChoice(text) {
  const value = (text || "").trim().toLowerCase();

  if (["1", "pedra", "🪨", "✊", "👊", "rock"].includes(value)) return "pedra";
  if (["2", "papel", "📄", "✋", "🖐️", "paper"].includes(value)) return "papel";
  if (["3", "tesoura", "✂️", "✌️", "scissors"].includes(value)) return "tesoura";

  return null;
}

function clearTimer(game) {
  if (game?.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

function setTimer(game, ms, callback) {
  clearTimer(game);
  game.timer = setTimeout(() => {
    if (games.get(game.groupId) === game) {
      callback().catch(() => {});
    }
  }, ms);
}

function removeGame(game) {
  clearTimer(game);
  games.delete(game.groupId);

  for (const player of humans(game)) {
    if (playerIndex.get(onlyNumbers(player)) === game.groupId) {
      playerIndex.delete(onlyNumbers(player));
    }
  }
}

export function getGame(groupId) {
  return games.get(groupId) || null;
}

export function isInGame(game, player) {
  return game.players.includes(player);
}

/** Diz se o jogador já está numa partida (em qualquer grupo). */
export function isBusy(player) {
  const groupId = playerIndex.get(onlyNumbers(player));
  const game = groupId && games.get(groupId);
  return !!game && game.status !== "finished";
}

const scoreLine = (game) => {
  const [a, b] = game.players;
  return `📊 ${mention(a)} *${game.score[a]}* x *${game.score[b]}* ${mention(b)}  _(melhor de ${
    game.target * 2 - 1
  })_`;
};

const choiceMenu = `1️⃣ 🪨 *Pedra*\n2️⃣ 📄 *Papel*\n3️⃣ ✂️ *Tesoura*`;

export function createInvite({ groupId, challenger, challenged, bestOf, send, socket }) {
  const vsBot = challenged === BOT_PLAYER;

  const game = {
    groupId,
    status: "pending",
    players: [challenger, challenged],
    target: Math.ceil(bestOf / 2),
    score: { [challenger]: 0, [challenged]: 0 },
    series: { [challenger]: 0, [challenged]: 0 },
    round: 0,
    match: 1,
    choices: {},
    history: { [challenger]: [], [challenged]: [] },
    vsBot,
    send,
    socket,
    timer: null,
  };

  games.set(groupId, game);

  for (const player of humans(game)) {
    playerIndex.set(onlyNumbers(player), groupId);
  }

  if (vsBot) {
    return startMatch(game, `🤖 *DESAFIO ACEITO, HUMANO.*\n\n${mention(challenger)} 🆚 🤖 *Bot*`);
  }

  setTimer(game, INVITE_TIMEOUT_MS, async () => {
    removeGame(game);
    await send(
      `⌛ ${mention(challenged)} fugiu do Jokenpô! Desafio de ${mention(challenger)} expirou. 🐔`,
      humans(game)
    );
  });

  return Promise.resolve({
    text: `✊✋✌️ *DESAFIO DE JOKENPÔ!* ✊✋✌️\n\n${mention(challenger)} desafiou ${mention(
      challenged
    )} para uma *melhor de ${bestOf}*!\n\n🔒 As escolhas são *secretas*: eu chamo cada um no privado.\n\n✅ Aceitar: *{prefix}ppt aceitar*\n❌ Fugir: *{prefix}ppt recusar*\n\n_Expira em ${
      INVITE_TIMEOUT_MS / 1000
    }s._`,
    mentions: humans(game),
  });
}

export function acceptInvite(groupId) {
  const game = games.get(groupId);
  const [a, b] = game.players;
  return startMatch(game, `🔥 *DESAFIO ACEITO!*\n\n${mention(a)} 🆚 ${mention(b)}`);
}

export function cancelGame(groupId) {
  const game = games.get(groupId);
  if (game) removeGame(game);
  return game;
}

async function startMatch(game, intro) {
  game.status = "playing";
  game.round = 0;
  game.score = { [game.players[0]]: 0, [game.players[1]]: 0 };

  const dmError = await startRound(game, false);

  if (dmError) {
    removeGame(game);
    return {
      text: `😕 Não consegui chamar ${mention(dmError)} no privado, então a partida foi cancelada.\n_Dica: mande um "oi" pro bot no privado e tente de novo._`,
      mentions: humans(game),
    };
  }

  return {
    text: `${intro}\n${scoreLine(game)}\n\n${roundCall(game)}`,
    mentions: humans(game),
  };
}

function roundCall(game) {
  if (game.vsBot) {
    return `🎬 *RODADA ${game.round}*\n🤖 Já escolhi e lacrei 🔒\n\nSua vez, ${mention(
      game.players[0]
    )}! Mande aqui no grupo:\n${choiceMenu}\n\n_⏱️ ${ROUND_TIMEOUT_MS / 1000}s_`;
  }

  return `🎬 *RODADA ${game.round}*\n📩 Chamei vocês no privado — escolham lá em segredo! 🤫\n\n⏳ Aguardando: ${humans(
    game
  )
    .map(mention)
    .join(" e ")}\n_⏱️ ${ROUND_TIMEOUT_MS / 1000}s_`;
}

/** Bot "lê" o histórico: tende a contra-atacar o lance favorito do humano. */
function botChoice(game) {
  const history = game.history[game.players[0]];

  if (history.length >= 2 && Math.random() < 0.35) {
    const counts = {};
    for (const choice of history) counts[choice] = (counts[choice] || 0) + 1;
    const favorite = Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
    return Object.keys(CHOICES).find((key) => CHOICES[key].beats === favorite);
  }

  return pick(Object.keys(CHOICES));
}

/**
 * Inicia a rodada. Retorna o jogador que não pôde ser chamado
 * no privado (ou null se deu tudo certo).
 */
async function startRound(game, announce = true) {
  game.round += 1;
  game.choices = {};

  if (game.vsBot) {
    game.choices[BOT_PLAYER] = botChoice(game);
  } else {
    for (const player of humans(game)) {
      try {
        await game.socket.sendMessage(player, {
          text: `✊✋✌️ *JOKENPÔ — RODADA ${game.round}*\n${scoreLine(game)}\n\nResponda aqui com o número:\n${choiceMenu}\n\n🤫 Ninguém no grupo vai ver sua escolha.`,
        });
      } catch {
        return player;
      }
    }
  }

  setTimer(game, ROUND_TIMEOUT_MS, () => roundTimeout(game));

  if (announce) {
    await game.send(roundCall(game), humans(game));
  }

  return null;
}

async function roundTimeout(game) {
  const missing = game.players.filter((player) => !game.choices[player]);

  if (missing.length === 2) {
    removeGame(game);
    await game.send(
      `💤 Ninguém escolheu na rodada ${game.round}. Partida cancelada por abandono!`,
      humans(game)
    );
    return;
  }

  const slow = missing[0];
  const winner = game.players.find((player) => player !== slow);
  game.score[winner] += 1;

  await game.send(
    `🐢 ${mention(slow)} demorou demais! Ponto para ${mention(winner)}.\n${scoreLine(game)}`,
    humans(game)
  );

  await afterRound(game, winner);
}

/**
 * Registra a escolha de um jogador. Retorna texto de resposta
 * para quem escolheu (ou null se não estiver numa rodada).
 */
export async function choose(groupId, player, choice) {
  const game = games.get(groupId);

  if (!game || game.status !== "playing" || !isInGame(game, player)) return null;

  if (game.choices[player]) {
    return `🔒 Você já escolheu ${show(game.choices[player])} nesta rodada. Sem arrependimentos!`;
  }

  game.choices[player] = choice;

  const waiting = game.players.filter((p) => !game.choices[p]);

  if (waiting.length) {
    await game.send(
      `🔒 ${mention(player)} já escolheu! Falta ${waiting.map(mention).join(", ")}... 👀`,
      humans(game)
    );
    return `✅ Escolha registrada: ${show(choice)}\nAguarde a revelação no grupo! 🍿`;
  }

  clearTimer(game);
  setTimeout(() => reveal(game).catch(() => {}), 400);

  return game.vsBot ? null : `✅ Escolha registrada: ${show(choice)}\nCorre pro grupo, vai revelar! 🍿`;
}

async function reveal(game) {
  const { socket, groupId } = game;
  const [a, b] = game.players;
  const ca = game.choices[a];
  const cb = game.choices[b];

  game.history[a].push(ca);
  game.history[b].push(cb);

  // Animação JO... KEN... PÔ!
  try {
    const message = await socket.sendMessage(groupId, { text: "✊ *JO...*" });
    await delay(900);
    await socket.sendMessage(groupId, { text: "✊✊ *JO... KEN...*", edit: message.key });
    await delay(900);
    await socket.sendMessage(groupId, { text: "✊✊✊ *JO... KEN... PÔ!!!* 💥", edit: message.key });
    await delay(600);
  } catch {
    // animação é só enfeite
  }

  let winner = null;
  let result;

  if (ca === cb) {
    result = pick(TIE_PHRASES);
  } else {
    winner = CHOICES[ca].beats === cb ? a : b;
    result = `${pick(WIN_PHRASES[game.choices[winner]])}\n🏅 Ponto para ${mention(winner)}!`;
    game.score[winner] += 1;
  }

  const extras = [];
  for (const player of game.players) {
    const last = game.history[player].slice(-3);
    if (last.length === 3 && last.every((c) => c === last[0])) {
      extras.push(`🎯 ${mention(player)} jogou ${show(last[0])} 3 vezes seguidas. Previsível? 😏`);
    }
  }

  if (game.vsBot && winner === BOT_PLAYER) extras.push(pick(BOT_TAUNTS));

  await game.send(
    `${mention(a)}  ${show(ca)}\n        ⚔️\n${mention(b)}  ${show(cb)}\n\n${result}${
      extras.length ? `\n${extras.join("\n")}` : ""
    }\n\n${scoreLine(game)}`,
    humans(game)
  );

  await afterRound(game, winner);
}

async function afterRound(game, roundWinner) {
  const champion = game.players.find((player) => game.score[player] >= game.target);

  if (!champion) {
    await delay(1500);
    if (games.get(game.groupId) === game) await startRound(game);
    return;
  }

  const loser = game.players.find((player) => player !== champion);
  game.status = "finished";
  game.series[champion] += 1;
  clearTimer(game);

  if (!game.vsBot) {
    addRpsResult(game.groupId, { winner: champion, loser });
  }

  const [a, b] = game.players;
  const comeback =
    roundWinner === champion && game.score[loser] === game.target - 1 && game.target > 1
      ? "\n😱 *DECIDIDO NA ÚLTIMA RODADA!*"
      : game.score[loser] === 0 && game.target > 1
      ? "\n🧹 *VARRIDA!* Não deu nem chance!"
      : "";

  await game.send(
    `🏆🏆🏆 *${champion === BOT_PLAYER ? "O BOT" : mention(champion)} VENCEU A PARTIDA!* 🏆🏆🏆${comeback}\n${
      loser === BOT_PLAYER ? "🤖 Recalibrando circuitos... 💀" : `${mention(loser)} vai pro banco. 🪑`
    }\n\n${scoreLine(game)}\n📈 *Série:* ${mention(a)} ${game.series[a]} x ${game.series[b]} ${mention(
      b
    )}\n\n🔁 Revanche? *{prefix}ppt revanche*`,
    humans(game)
  );

  setTimer(game, REMATCH_WINDOW_MS, async () => removeGame(game));
}

export function rematch(groupId) {
  const game = games.get(groupId);
  game.match += 1;
  const [a, b] = game.players;
  return startMatch(
    game,
    `🔁 *REVANCHE #${game.match - 1}!*\n📈 Série: ${mention(a)} ${game.series[a]} x ${game.series[b]} ${mention(b)}`
  );
}

export async function surrender(groupId, player) {
  const game = games.get(groupId);
  const winner = game.players.find((p) => p !== player);
  game.score[winner] = game.target;
  clearTimer(game);
  await game.send(`🏳️ ${mention(player)} *jogou a toalha!*`, humans(game));
  await afterRound(game, winner);
}

/**
 * Jogada contra o bot, feita direto no grupo.
 */
export function playVsBotInGroup(groupId, player, text) {
  const game = games.get(groupId);
  if (!game?.vsBot || game.status !== "playing" || game.players[0] !== player) return null;

  const choice = parseChoice(text);
  if (!choice) return null;

  return choose(groupId, player, choice);
}

/**
 * Trata mensagens privadas de quem está numa partida.
 * Retorna true se a mensagem foi consumida pelo jogo.
 */
export async function handleRpsPrivateMessage(socket, webMessage) {
  const key = webMessage?.key;
  if (!key || key.fromMe || !playerIndex.size) return false;

  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderLid]
    .filter(Boolean)
    .map((jid) => onlyNumbers(String(jid).split("@")[0].split(":")[0]));

  const number = candidates.find((n) => playerIndex.has(n));
  if (!number) return false;

  const groupId = playerIndex.get(number);
  const game = games.get(groupId);
  if (!game || game.status !== "playing" || game.vsBot) return false;

  const player = humans(game).find((p) => onlyNumbers(p) === number);

  const text =
    webMessage.message?.conversation || webMessage.message?.extendedTextMessage?.text || "";
  const choice = parseChoice(text);

  const answer = choice
    ? await choose(groupId, player, choice)
    : `❓ Não entendi. Responda só com o número:\n${choiceMenu}`;

  if (answer) {
    await socket.sendMessage(key.remoteJid, { text: answer });
  }

  return true;
}
