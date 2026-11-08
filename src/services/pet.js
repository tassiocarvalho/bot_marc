/**
 * Motor do /pet: cada membro adota um gato ou cachorro por grupo.
 *
 * Persistência (sobrevive a reinícios):
 *   database/pets/<id-do-grupo>/_grupo.json      → id e nome do grupo
 *   database/pets/<id-do-grupo>/<id-do-dono>.json → pet, status, pontos
 *
 * O dono é sempre o ID canônico (LID) vindo de utils/playerId.js.
 * Os status caem com o tempo (calculado na hora, sem timers) e cada
 * ação tem um tempo de espera, para não virar spam no grupo.
 *
 * @author bot_marc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PET_COLORS } from "./pet-art.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let petsDir =
  process.env.PET_DB_DIR || path.resolve(__dirname, "..", "..", "database", "pets");

/** Usado nos testes para apontar para uma pasta temporária. */
export function setPetsDir(dir) {
  petsDir = dir;
}

export const getPetsDir = () => petsDir;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const STAT_KEYS = ["fome", "felicidade", "energia", "limpeza"];

/** Quanto cada status cai por hora (fome = barriga cheia, cai com o tempo). */
const DECAY_PER_HOUR = { fome: 4, felicidade: 2.5, energia: 2, limpeza: 2 };
const SLEEP_RECOVERY_PER_HOUR = 30;
const SLEEP_DURATION = 3 * HOUR;

export const SPECIES = {
  gato: { emoji: "🐱", label: "Gato", sound: "Miau", names: ["Mingau", "Frajola", "Pipoca", "Nina", "Tom", "Luna", "Bolinha", "Paçoca"] },
  cachorro: { emoji: "🐶", label: "Cachorro", sound: "Au au", names: ["Rex", "Thor", "Bob", "Mel", "Pandora", "Pingo", "Caramelo", "Bidu"] },
};

const ACTIONS = {
  comer: { cooldown: 4 * HOUR, points: 8, xp: 20, mood: "comendo" },
  brincar: { cooldown: 3 * HOUR, points: 10, xp: 25, mood: "brincando" },
  carinho: { cooldown: 1 * HOUR, points: 3, xp: 8, mood: "amor" },
  banho: { cooldown: 12 * HOUR, points: 8, xp: 20, mood: "banho" },
  passear: { cooldown: 6 * HOUR, points: 15, xp: 35, mood: "passeio" },
  dormir: { cooldown: 8 * HOUR, points: 5, xp: 10, mood: "sono" },
};

const TITLES = [
  [20, "Lendário 👑✨"],
  [10, "Adulto 👑"],
  [5, "Jovem 🎀"],
  [1, "Filhote 🍼"],
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const safeName = (id) => String(id).replace(/[^\w@.-]/g, "_");

export const groupDir = (groupId) => path.join(petsDir, safeName(groupId));
const petFile = (groupId, ownerId) => path.join(groupDir(groupId), `${safeName(ownerId)}.json`);

function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Cria (ou atualiza) a pasta do grupo com o _grupo.json. */
export function ensureGroupFolder(groupId, groupName) {
  const dir = groupDir(groupId);
  fs.mkdirSync(dir, { recursive: true });

  const infoFile = path.join(dir, "_grupo.json");
  const existing = readJsonSafe(infoFile);
  const info = existing || { id: groupId, nome: null, criadoEm: new Date().toISOString() };

  if (!existing || (groupName && info.nome !== groupName)) {
    if (groupName) info.nome = groupName;
    info.atualizadoEm = new Date().toISOString();
    writeJsonAtomic(infoFile, info);
  }

  return dir;
}

/** Cria a pasta de todos os grupos em que o bot está. */
export async function ensureAllGroupFolders(socket) {
  const groups = await socket.groupFetchAllParticipating();
  for (const group of Object.values(groups || {})) {
    ensureGroupFolder(group.id, group.subject || null);
  }
  return Object.keys(groups || {}).length;
}

export function levelFromXp(xp) {
  let level = 1;
  let needed = 50;
  let rest = xp;
  while (rest >= needed) {
    rest -= needed;
    level += 1;
    needed = 50 * level;
  }
  return { level, current: rest, needed };
}

export const titleFor = (level) => TITLES.find(([min]) => level >= min)[1];

/** Aplica a passagem do tempo nos status. */
export function applyTime(pet, now = Date.now()) {
  const hours = Math.max(0, (now - (pet.ultimoTick || now)) / HOUR);

  if (hours > 0) {
    const sleepingUntil = pet.dormindoAte || 0;
    const sleptHours = sleepingUntil > pet.ultimoTick
      ? Math.max(0, (Math.min(now, sleepingUntil) - pet.ultimoTick) / HOUR)
      : 0;
    const awakeHours = hours - sleptHours;

    pet.status.fome = clamp(pet.status.fome - DECAY_PER_HOUR.fome * hours);
    pet.status.felicidade = clamp(pet.status.felicidade - DECAY_PER_HOUR.felicidade * hours);
    pet.status.limpeza = clamp(pet.status.limpeza - DECAY_PER_HOUR.limpeza * hours);
    pet.status.energia = clamp(
      pet.status.energia + SLEEP_RECOVERY_PER_HOUR * sleptHours - DECAY_PER_HOUR.energia * awakeHours
    );
  }

  if (pet.dormindoAte && now >= pet.dormindoAte) pet.dormindoAte = null;
  pet.ultimoTick = now;
  return pet;
}

export function isSleeping(pet, now = Date.now()) {
  return !!pet.dormindoAte && now < pet.dormindoAte;
}

/** Humor que define a figurinha de status. */
export function moodOf(pet, now = Date.now()) {
  if (isSleeping(pet, now)) return "sono";
  const s = pet.status;
  if (s.fome < 30) return "fome";
  if (s.energia < 20) return "sono";
  if (s.limpeza < 30) return "sujo";
  if (s.felicidade < 35) return "triste";
  if (STAT_KEYS.every((key) => s[key] >= 80)) return "amor";
  return "feliz";
}

/** Multiplicador de pontos: pet bem cuidado rende o dobro, largado rende metade. */
function careMultiplier(pet) {
  const values = STAT_KEYS.map((key) => pet.status[key]);
  if (values.every((value) => value >= 70)) return 2;
  if (values.some((value) => value <= 10)) return 0.5;
  return 1;
}

export function loadPet(groupId, ownerId, now = Date.now()) {
  const pet = readJsonSafe(petFile(groupId, ownerId));
  if (!pet) return null;
  return applyTime(pet, now);
}

export function savePet(pet) {
  ensureGroupFolder(pet.grupo);
  pet.atualizadoEm = new Date().toISOString();
  writeJsonAtomic(petFile(pet.grupo, pet.dono), pet);
  return pet;
}

export function listPets(groupId) {
  const dir = groupDir(groupId);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .map((file) => readJsonSafe(path.join(dir, file)))
    .filter(Boolean);
}

export function getRanking(groupId) {
  return listPets(groupId).sort(
    (a, b) => b.pontos - a.pontos || b.xp - a.xp
  );
}

export function findSpecies(text) {
  const value = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (["gato", "gata", "gatinho", "gatinha", "cat", "felino"].includes(value)) return "gato";
  if (["cachorro", "cachorra", "cao", "dog", "cachorrinho", "doguinho", "catioro"].includes(value)) return "cachorro";
  return null;
}

export function findColor(species, text) {
  const value = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return Object.keys(PET_COLORS[species]).find((color) => color === value) || null;
}

export const colorsOf = (species) => Object.keys(PET_COLORS[species]);

export function cleanPetName(text) {
  return (text || "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[<>&"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

export function adoptPet({ groupId, ownerId, species, name, color, now = Date.now() }) {
  if (loadPet(groupId, ownerId, now)) {
    return { error: "Você já tem um pet neste grupo! Cuide bem dele. 🐾" };
  }

  const pet = {
    versao: 1,
    grupo: groupId,
    dono: ownerId,
    especie: species,
    cor: color || pick(colorsOf(species)),
    nome: cleanPetName(name) || pick(SPECIES[species].names),
    adotadoEm: new Date(now).toISOString(),
    ultimoTick: now,
    dormindoAte: null,
    status: { fome: 80, felicidade: 90, energia: 90, limpeza: 90 },
    xp: 0,
    nivel: 1,
    pontos: 10,
    esperas: {},
    diario: { ultimo: null, sequencia: 0 },
    contagem: {},
  };

  savePet(pet);
  return { pet, mood: "amor" };
}

function formatWait(ms) {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function addXp(pet, amount) {
  const before = pet.nivel;
  pet.xp += amount;
  pet.nivel = levelFromXp(pet.xp).level;

  if (pet.nivel > before) {
    const bonus = 10 * pet.nivel;
    pet.pontos += bonus;
    return `\n\n🎉 *SUBIU DE NÍVEL!* ${pet.nome} agora é nível *${pet.nivel}* (${titleFor(pet.nivel)}) · +${bonus} pts`;
  }
  return "";
}

/** Executa uma ação de cuidado. Retorna { pet, mood, text } ou { error }. */
export function doAction(groupId, ownerId, action, now = Date.now()) {
  const config = ACTIONS[action];
  const pet = loadPet(groupId, ownerId, now);
  if (!pet) return { error: "NO_PET" };

  const s = pet.status;
  const name = pet.nome;
  const isCat = pet.especie === "gato";

  if (action !== "dormir" && isSleeping(pet, now)) {
    savePet(pet);
    return {
      error: `😴 ${name} está dormindo! Acorda em ${formatWait(pet.dormindoAte - now)}. Use *{prefix}pet acordar* se for urgente.`,
      pet,
      mood: "sono",
    };
  }

  const last = pet.esperas[action] || 0;
  if (now - last < config.cooldown) {
    savePet(pet);
    return {
      error: `⏳ Calma! ${name} ainda não quer *${action}* de novo. Tente em ${formatWait(config.cooldown - (now - last))}.`,
    };
  }

  let text = "";
  let points = config.points;

  switch (action) {
    case "comer":
      if (s.fome >= 95) {
        savePet(pet);
        return { error: `🤰 ${name} está de barriga cheia! Volte mais tarde.` };
      }
      s.fome = clamp(s.fome + 40);
      s.felicidade = clamp(s.felicidade + 5);
      text = isCat
        ? `🐟 ${name} devorou um peixinho! *Nham nham* 😋`
        : `🦴 ${name} roeu um ossinho e balançou o rabo! 😋`;
      break;

    case "brincar":
      if (s.energia < 15) {
        savePet(pet);
        return { error: `🥱 ${name} está cansado demais pra brincar. Que tal *{prefix}pet dormir*?`, pet, mood: "sono" };
      }
      s.felicidade = clamp(s.felicidade + 25);
      s.energia = clamp(s.energia - 15);
      s.fome = clamp(s.fome - 5);
      s.limpeza = clamp(s.limpeza - 8);
      text = isCat
        ? `🧶 ${name} caçou o novelo pela casa toda!`
        : `🎾 ${name} buscou a bolinha 10 vezes seguidas!`;
      if (Math.random() < 0.2) {
        const bonus = 5 + Math.floor(Math.random() * 11);
        points += bonus;
        text += `\n✨ Achou um brinquedo perdido! +${bonus} pts extras`;
      }
      break;

    case "carinho":
      s.felicidade = clamp(s.felicidade + 12);
      text = isCat ? `💕 ${name} ronronou: *purrrr* 😻` : `💕 ${name} deitou de barriga pra cima pedindo mais! 🥰`;
      break;

    case "banho":
      s.limpeza = 100;
      if (isCat) {
        s.felicidade = clamp(s.felicidade - 8);
        text = `🛁 ${name} ficou cheiroso... mas tá bravo com você 😾💦`;
      } else {
        s.felicidade = clamp(s.felicidade + 6);
        text = `🛁 ${name} amou o banho e se sacudiu em todo mundo! 💦🐶`;
      }
      break;

    case "passear": {
      if (s.energia < 25) {
        savePet(pet);
        return { error: `🥱 ${name} não aguenta passear agora. Deixa ele *{prefix}pet dormir* um pouco.`, pet, mood: "sono" };
      }
      s.felicidade = clamp(s.felicidade + (isCat ? 15 : 25));
      s.energia = clamp(s.energia - 20);
      s.fome = clamp(s.fome - 10);
      s.limpeza = clamp(s.limpeza - 15);
      const found = Math.floor(Math.random() * 16);
      points += found;
      text = isCat
        ? `🌳 ${name} passeou de coleira (contrariado) e espiou uns passarinhos!`
        : `🌳 ${name} cheirou todos os postes da rua e fez 3 amigos!`;
      if (found) text += `\n🪙 Achou ${found} pts no caminho!`;
      break;
    }

    case "dormir":
      if (s.energia >= 90) {
        savePet(pet);
        return { error: `⚡ ${name} está cheio de energia, não quer dormir agora!` };
      }
      pet.dormindoAte = now + SLEEP_DURATION;
      text = `😴 ${name} deitou na caminha... Zzz\nAcorda sozinho em 3h com a energia recarregada.`;
      break;

    default:
      return { error: "Ação desconhecida." };
  }

  const multiplier = careMultiplier(pet);
  const earned = Math.max(1, Math.round(points * multiplier));
  pet.pontos += earned;
  pet.esperas[action] = now;
  pet.contagem[action] = (pet.contagem[action] || 0) + 1;

  const bonusNote =
    multiplier > 1 ? " _(x2 pet bem cuidado!)_" : multiplier < 1 ? " _(metade: pet largado 😿)_" : "";
  text += `\n\n⭐ +${earned} pts${bonusNote}`;
  text += addXp(pet, config.xp);

  savePet(pet);
  return { pet, mood: config.mood, text };
}

export function wakeUp(groupId, ownerId, now = Date.now()) {
  const pet = loadPet(groupId, ownerId, now);
  if (!pet) return { error: "NO_PET" };
  if (!isSleeping(pet, now)) return { error: `👀 ${pet.nome} já está acordado!` };

  pet.dormindoAte = null;
  savePet(pet);
  return { pet, mood: moodOf(pet, now), text: `⏰ ${pet.nome} acordou meio sonolento... 🥱` };
}

const dayKey = (now) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(now));

export function claimDaily(groupId, ownerId, now = Date.now()) {
  const pet = loadPet(groupId, ownerId, now);
  if (!pet) return { error: "NO_PET" };

  const today = dayKey(now);
  if (pet.diario.ultimo === today) {
    savePet(pet);
    return { error: `📅 Você já pegou o presente de hoje! Volte amanhã. (sequência: ${pet.diario.sequencia} 🔥)` };
  }

  const yesterday = dayKey(now - 24 * HOUR);
  pet.diario.sequencia = pet.diario.ultimo === yesterday ? pet.diario.sequencia + 1 : 1;
  pet.diario.ultimo = today;

  const earned = Math.min(50, 15 + pet.diario.sequencia * 5);
  pet.pontos += earned;
  pet.status.felicidade = clamp(pet.status.felicidade + 10);
  const levelUp = addXp(pet, 20);

  savePet(pet);
  return {
    pet,
    mood: "amor",
    text: `🎁 *Presente diário!* ${pet.nome} te deu *+${earned} pts*\n🔥 Sequência: ${pet.diario.sequencia} dia(s) — volte amanhã pra ganhar mais!${levelUp}`,
  };
}

export function renamePet(groupId, ownerId, newName, now = Date.now()) {
  const pet = loadPet(groupId, ownerId, now);
  if (!pet) return { error: "NO_PET" };

  const name = cleanPetName(newName);
  if (name.length < 2) return { error: "O nome precisa ter pelo menos 2 letras." };

  const old = pet.nome;
  pet.nome = name;
  savePet(pet);
  return { pet, mood: "feliz", text: `📝 ${old} agora se chama *${name}*!` };
}

export function recolorPet(groupId, ownerId, colorText, now = Date.now()) {
  const pet = loadPet(groupId, ownerId, now);
  if (!pet) return { error: "NO_PET" };

  const color = findColor(pet.especie, colorText);
  if (!color) {
    return { error: `Cores disponíveis: ${colorsOf(pet.especie).join(", ")}` };
  }

  pet.cor = color;
  savePet(pet);
  return { pet, mood: "feliz", text: `🎨 ${pet.nome} agora é ${color}!` };
}

/** Abandonar não apaga: arquiva o arquivo para não perder o histórico. */
export function abandonPet(groupId, ownerId, now = Date.now()) {
  const file = petFile(groupId, ownerId);
  if (!fs.existsSync(file)) return { error: "NO_PET" };

  const pet = readJsonSafe(file);
  const archiveDir = path.join(groupDir(groupId), "_abandonados");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(file, path.join(archiveDir, `${safeName(ownerId)}-${now}.json`));

  return { pet, text: `💔 ${pet.nome} foi para um abrigo... Ele vai sentir saudade. 😿` };
}

const bar = (value) => {
  const filled = Math.round(value / 10);
  return `${"▰".repeat(filled)}${"▱".repeat(10 - filled)} ${value}%`;
};

export function describePet(pet, now = Date.now()) {
  const info = SPECIES[pet.especie];
  const { level, current, needed } = levelFromXp(pet.xp);
  const sleeping = isSleeping(pet, now)
    ? `\n😴 *Dormindo* — acorda em ${formatWait(pet.dormindoAte - now)}`
    : "";
  const s = pet.status;

  const hints = [];
  if (s.fome < 40) hints.push("🍗 está com fome");
  if (s.energia < 30) hints.push("🥱 está com sono");
  if (s.limpeza < 40) hints.push("🛁 precisa de banho");
  if (s.felicidade < 40) hints.push("🧶 quer brincar");

  return `${info.emoji} *${pet.nome}* — ${info.label} ${pet.cor}
🏷️ ${titleFor(level)} · Nível *${level}* (${current}/${needed} XP)
⭐ *${pet.pontos} pts*${sleeping}

🍗 Fome      ${bar(s.fome)}
💖 Alegria   ${bar(s.felicidade)}
⚡ Energia   ${bar(s.energia)}
🫧 Limpeza  ${bar(s.limpeza)}
${hints.length ? `\n⚠️ ${pet.nome} ${hints.join(", ")}!` : `\n✨ ${pet.nome} está ótimo! ${info.sound}! 💕`}`;
}
