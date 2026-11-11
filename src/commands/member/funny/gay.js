import path from "node:path";
import {
  FUNNY_DIR,
  SIGMA_GIF,
  createMeterCommand,
} from "../../../utils/funnyMeter.js";

/**
 * Cada faixa tem o seu GIF e a sua frase. Quanto maior a
 * porcentagem, mais intenso o GIF e mais exagerada a frase.
 */
export default createMeterCommand({
  name: "gay",
  commands: ["gay", "gaymetro"],
  description: "Mede, de brincadeira, o quanto alguém é gay (0 a 100%).",
  title: "🏳️‍🌈 *GAYMETRO* 🏳️‍🌈",
  label: "gay",
  gifsDir: path.resolve(FUNNY_DIR, "gay"),
  vip: {
    percentage: 0,
    gif: SIGMA_GIF,
    phrase:
      "🗿 *SIGMA DETECTADO* 🗿\n\n100% HÉTERO E MACHÃO! 💪🔥\nCome bife no café da manhã, " +
      "acorda às 4h, não chora nem cortando cebola e o gaymetro quebrou de medo de medir esse homem. 🐺",
  },
  levels: [
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
  ],
});
