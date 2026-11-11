import path from "node:path";
import { ASSETS_DIR, PREFIX } from "../../../config.js";
import {
  getRandomNumber,
  numberVariants,
  onlyNumbers,
} from "../../../utils/index.js";

const GIFS_DIR = path.resolve(ASSETS_DIR, "images", "funny", "gay");

/**
 * Números que sempre dão 0%: 100% hétero e machão, com GIF de sigma.
 * Pode escrever em qualquer formato: com ou sem +55, com ou sem o nono
 * dígito, com espaço, traço ou parênteses.
 */
const SIGMA_NUMBERS = [
  "+55 75 98325-8635",
  "5575983258635",
  "557583258635",
  "(75) 98325-8635",
  "75983258635",
  "7583258635",
];

const SIGMA_GIF = "sigma.mp4";

const SIGMA_PHRASE =
  "🗿 *SIGMA DETECTADO* 🗿\n\n100% HÉTERO E MACHÃO! 💪🔥\nCome bife no café da manhã, " +
  "acorda às 4h, não chora nem cortando cebola e o gaymetro quebrou de medo de medir esse homem. 🐺";

const LID_LOOKUP_TIMEOUT_MS = 3000;

/** Todas as formas aceitas (com e sem 55, com e sem o nono dígito). */
function sigmaVariants() {
  return new Set(
    SIGMA_NUMBERS.flatMap((number) => {
      const digits = onlyNumbers(number);
      const withCountry =
        digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

      return numberVariants(withCountry);
    }),
  );
}

/** "5575...:12@s.whatsapp.net" -> "5575..." */
function jidUser(jid) {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0];
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), LID_LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([
    Promise.resolve(promise).catch(() => null),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

/**
 * Diz se o alvo é um dos números sigma. O WhatsApp pode identificar a
 * pessoa pelo número ou pelo LID, então checa as duas coisas: compara os
 * números direto e, para LIDs, usa o mapeamento LID <-> número do Baileys.
 */
async function isSigma(socket, jids) {
  const sigma = sigmaVariants();
  const candidates = [...new Set(jids.filter(Boolean).map(String))];

  const matchesNumber = (value) => {
    const digits = onlyNumbers(jidUser(value));
    const withCountry =
      digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

    return numberVariants(withCountry).some((n) => sigma.has(n));
  };

  if (candidates.some(matchesNumber)) {
    return true;
  }

  const lidMapping = socket?.signalRepository?.lidMapping;

  if (!lidMapping) {
    return false;
  }

  const lids = candidates
    .filter((jid) => jid.endsWith("@lid"))
    .map((jid) => `${jidUser(jid)}@lid`);

  if (!lids.length) {
    return false;
  }

  for (const lid of lids) {
    const pn = await withTimeout(lidMapping.getPNForLID?.(lid));

    if (pn && matchesNumber(pn)) {
      return true;
    }
  }

  const lidUsers = new Set(lids.map(jidUser));

  for (const number of sigma) {
    const lid = await withTimeout(
      lidMapping.getLIDForPN?.(`${number}@s.whatsapp.net`),
    );

    if (lid && lidUsers.has(jidUser(lid))) {
      return true;
    }
  }

  return false;
}

function contextInfoOf(webMessage) {
  const message = webMessage?.message || {};

  for (const content of Object.values(message)) {
    if (content && typeof content === "object" && content.contextInfo) {
      return content.contextInfo;
    }
  }

  return null;
}

/**
 * Cada faixa tem o seu GIF e a sua frase. Quanto maior a
 * porcentagem, mais intenso o GIF e mais exagerada a frase.
 */
const LEVELS = [
  {
    max: 5,
    gif: "00-05.mp4",
    phrase: "hétero nível pedreiro raiz 🧱 mas ficou vermelhinho quando leu isso... suspeito 👀",
  },
  {
    max: 10,
    gif: "06-10.mp4",
    phrase: "diz que é hétero, mas escondeu o rosto rapidinho 🙈",
  },
  {
    max: 20,
    gif: "11-20.mp4",
    phrase: "já sabe a letra inteira de Lady Gaga e finge que não 🎤",
  },
  {
    max: 30,
    gif: "21-30.mp4",
    phrase: "o radar apitou! 📡 tá começando a sair do armário pela frestinha",
  },
  {
    max: 40,
    gif: "31-40.mp4",
    phrase: "abraça os amigos com um pouquinho de carinho demais 🫂",
  },
  {
    max: 50,
    gif: "41-50.mp4",
    phrase: "meio a meio, tipo pizza 🍕 metade calabresa, metade arco-íris 🌈",
  },
  {
    max: 60,
    gif: "51-60.mp4",
    phrase: "já pulou no colo do parça e disse que era brincadeira 😳",
  },
  {
    max: 70,
    gif: "61-70.mp4",
    phrase: "dorme de conchinha com o melhor amigo \"só porque tava frio\" 🛏️",
  },
  {
    max: 80,
    gif: "71-80.mp4",
    phrase: "quase beijou o amigo na resenha e culpou a cerveja 🍺💋",
  },
  {
    max: 90,
    gif: "81-90.mp4",
    phrase: "o armário já virou closet 👗 e tem glitter em todo canto ✨",
  },
  {
    max: 99,
    gif: "91-99.mp4",
    phrase: "presidente do fã-clube da Parada LGBT 🏳️‍🌈 vai de trio elétrico todo ano",
  },
  {
    max: 100,
    gif: "100.mp4",
    phrase: "GAY SUPREMO 👑🏳️‍🌈 nível máximo desbloqueado! O próprio arco-íris pede autógrafo 🌈✨",
  },
];

function getLevel(percentage) {
  return LEVELS.find((level) => percentage <= level.max);
}

export default {
  name: "gay",
  description: "Mede, de brincadeira, o quanto alguém é gay (0 a 100%).",
  commands: ["gay", "gaymetro"],
  usage: `${PREFIX}gay @usuario`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    sendGifFromFile,
    userLid,
    replyLid,
    args,
    isReply,
    socket,
    webMessage,
  }) => {
    const targetLid = isReply
      ? replyLid
      : args[0]
        ? `${onlyNumbers(args[0])}@lid`
        : userLid;

    const contextInfo = contextInfoOf(webMessage);
    const key = webMessage?.key || {};

    // Todas as formas em que o alvo pode ter chegado (LID ou número).
    const targetJids = isReply
      ? [replyLid, contextInfo?.participant]
      : args[0]
        ? [targetLid, args[0], ...(contextInfo?.mentionedJid || [])]
        : [
            userLid,
            key.participant,
            key.participantAlt,
            key.remoteJid,
            key.remoteJidAlt,
          ].filter((jid) => !String(jid || "").endsWith("@g.us"));

    if (await isSigma(socket, targetJids)) {
      await sendGifFromFile(
        path.resolve(GIFS_DIR, SIGMA_GIF),
        `🏳️‍🌈 *GAYMETRO* 🏳️‍🌈\n\n@${onlyNumbers(targetLid)} é *0%* gay!\n\n${SIGMA_PHRASE}`,
        [targetLid],
      );

      return;
    }

    const percentage = getRandomNumber(0, 100);
    const level = getLevel(percentage);
    const targetNumber = onlyNumbers(targetLid);

    await sendGifFromFile(
      path.resolve(GIFS_DIR, level.gif),
      `🏳️‍🌈 *GAYMETRO* 🏳️‍🌈\n\n@${targetNumber} é *${percentage}%* gay!\n\n${level.phrase}`,
      [targetLid],
    );
  },
};
