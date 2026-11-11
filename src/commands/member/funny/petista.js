import path from "node:path";
import {
  FUNNY_DIR,
  SIGMA_GIF,
  createMeterCommand,
} from "../../../utils/funnyMeter.js";

export default createMeterCommand({
  name: "petista",
  commands: ["petista", "petometro", "fazol"],
  description: "Mede, de brincadeira, o quanto alguém é petista (0 a 100%).",
  title: "🚩 *PETÔMETRO* 🚩",
  label: "petista",
  gifsDir: path.resolve(FUNNY_DIR, "petista"),
  vip: {
    percentage: 0,
    gif: SIGMA_GIF,
    phrase:
      "🗿 *IMUNE* 🗿\n\nEsse aí não faz o L nem em prova de caligrafia. ✍️🚫\n" +
      "Picanha ele compra com o próprio dinheiro. 🥩💪",
  },
  levels: [
    {
      max: 10,
      gif: "00-10.mp4",
      phrase: "só toma um cafezinho com o Lula de vez em quando ☕ nada demais... por enquanto",
    },
    {
      max: 30,
      gif: "11-30.mp4",
      phrase: "tá escondido, mas a orelha ficou de fora: SAI DAÍ PETISTA, EU JÁ TE VI 👂",
    },
    {
      max: 50,
      gif: "31-50.mp4",
      phrase: "SELO FAZUÉLI DE QUALIDADE ✅ defendeu a picanha com cervejinha no churrasco da família 🥩🍺",
    },
    {
      max: 70,
      gif: "51-70.mp4",
      phrase: "VAI DAR PT 🕺 o L já sai sozinho em toda foto",
    },
    {
      max: 90,
      gif: "71-90.mp4",
      phrase: "petista maromba 💪🚩 treina ouvindo jingle de campanha e chama todo mundo de companheiro",
    },
    {
      max: 100,
      gif: "91-100.mp4",
      phrase:
        "PETISTA RAIZ 🚩⭐ faz o L até pra pedir pão na padaria, tem estrelinha tatuada " +
        "e chora no \"Lula lá\" 😭 L L L L L",
    },
  ],
});
