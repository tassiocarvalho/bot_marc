import path from "node:path";
import {
  FUNNY_DIR,
  SIGMA_GIF,
  createMeterCommand,
} from "../../../utils/funnyMeter.js";

export default createMeterCommand({
  name: "lesbica",
  commands: ["lesbica", "lesbicometro", "sapatao"],
  description: "Mede, de brincadeira, o quanto alguém é lésbica (0 a 100%).",
  title: "👭 *LESBICÔMETRO* 👭",
  label: "lésbica",
  gifsDir: path.resolve(FUNNY_DIR, "lesbica"),
  vip: {
    percentage: 0,
    gif: SIGMA_GIF,
    phrase:
      "🗿 *IMUNE* 🗿\n\nO lesbicômetro tentou medir e deu tela azul. 💻💥\n" +
      "Esse aí é sigma demais pra entrar em qualquer estatística. 🐺",
  },
  levels: [
    {
      max: 10,
      gif: "00-10.mp4",
      phrase: "jura que é hétero... mas ficou vermelha vendo o clipe da Anitta 👀",
    },
    {
      max: 30,
      gif: "11-30.mp4",
      phrase: "\"amiga\" que abraça por trás e não solta mais 🫂 sei...",
    },
    {
      max: 50,
      gif: "31-50.mp4",
      phrase: "já tem camisa xadrez de flanela, um gato e uma ex que virou melhor amiga 🐈👕",
    },
    {
      max: 70,
      gif: "51-70.mp4",
      phrase: "beijinho na bochecha da \"amiga\" de 5 em 5 minutos 😘 cabelo curtinho já tá agendado ✂️",
    },
    {
      max: 90,
      gif: "71-90.mp4",
      phrase: "no segundo encontro já levou a escova de dente, no terceiro alugou o caminhão de mudança 🚚",
    },
    {
      max: 100,
      gif: "91-100.mp4",
      phrase:
        "SAPATÃO RAIZ CERTIFICADA 👑🏳️‍🌈 mosquetão no cinto, chave de fenda no bolso, " +
        "playlist da Marina Sena no repeat e uma ex de cada signo 🔧🎧",
    },
  ],
});
