import path from "node:path";
import { FUNNY_DIR, createMeterCommand } from "../../../utils/funnyMeter.js";

const GIFS_DIR = path.resolve(FUNNY_DIR, "bolsonarista");

export default createMeterCommand({
  name: "bolsonarista",
  commands: ["bolsonarista", "bolsonarometro", "gado"],
  description: "Mede, de brincadeira, o quanto alguém é bolsonarista (0 a 100%).",
  title: "🇧🇷 *BOLSONARÔMETRO* 🇧🇷",
  label: "bolsonarista",
  gifsDir: GIFS_DIR,
  vip: {
    percentage: 100,
    gif: path.resolve(GIFS_DIR, "91-100.mp4"),
    phrase:
      "🐂 *GADO DE ELITE CONFIRMADO* 🐂\n\nBolsonarista desde o berço! 🍼🇧🇷 " +
      "Já botou o celular na cabeça pra chamar ET, cantou o hino pro pneu e ficou " +
      "pendurado no caminhão na chuva. 🛸🚚 MITO! MITO! MITO! 📯",
  },
  levels: [
    {
      max: 10,
      gif: "00-10.mp4",
      phrase: "disfarça... mas a camisa da seleção tá por baixo da blusa 🇧🇷👀",
    },
    {
      max: 30,
      gif: "11-30.mp4",
      phrase: "fechado com o capitão 🫡 posta \"Deus, Pátria e Família\" no status todo domingo",
    },
    {
      max: 50,
      gif: "31-50.mp4",
      phrase: "EU VI NO ZAP 📱 se a tia mandou no grupo da família, então é verdade",
    },
    {
      max: 70,
      gif: "51-70.mp4",
      phrase: "ouviu o berrante e veio correndo 📯🐂 nem perguntou pra onde",
    },
    {
      max: 90,
      gif: "71-90.mp4",
      phrase: "EU SOU GADO 🐄 muuu com orgulho, pasto verde e amarelo",
    },
    {
      max: 100,
      gif: "91-100.mp4",
      phrase:
        "BOLSONARISTA NÍVEL MÁXIMO 🇧🇷🛸 já botou o celular na cabeça pra pedir ajuda " +
        "pros ETs e bateu continência pro pneu 🫡🛞",
    },
  ],
});
