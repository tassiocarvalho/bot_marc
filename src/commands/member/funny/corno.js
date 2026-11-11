import path from "node:path";
import {
  FUNNY_DIR,
  SIGMA_GIF,
  createMeterCommand,
} from "../../../utils/funnyMeter.js";

export default createMeterCommand({
  name: "corno",
  commands: ["corno", "cornometro", "chifre"],
  description: "Mede, de brincadeira, o quanto alguém é corno (0 a 100%).",
  title: "🐂 *CORNÔMETRO* 🐂",
  label: "corno",
  gifsDir: path.resolve(FUNNY_DIR, "corno"),
  vip: {
    percentage: 0,
    gif: SIGMA_GIF,
    phrase:
      "🗿 *IMUNE* 🗿\n\nCorno? Ele? O Ricardão atravessa a rua quando vê esse homem. 🚶‍♂️💨\n" +
      "Nasceu sem espaço na testa pra chifre. Sigma não divide nem o carregador. 🐺",
  },
  levels: [
    {
      max: 10,
      gif: "00-10.mp4",
      phrase: "por enquanto tá limpo... mas tem um corno entre nós e o Ricardão já pediu a senha do seu Wi-Fi 📶",
    },
    {
      max: 30,
      gif: "11-30.mp4",
      phrase: "os chifrinhos tão nascendo 🦌 coça a testa aí pra disfarçar",
    },
    {
      max: 50,
      gif: "31-50.mp4",
      phrase: "MUUUU 🐮 ela vai \"na casa da amiga\" toda sexta e você ainda leva ela de carro",
    },
    {
      max: 70,
      gif: "51-70.mp4",
      phrase: "CO-CO-CORNO 💀🎶 até o esqueleto tá dançando em cima do seu chifre",
    },
    {
      max: 90,
      gif: "71-90.mp4",
      phrase: "o Ricardão já tem cópia da chave, senha da Netflix e escova de dente no seu banheiro 🪥🔑",
    },
    {
      max: 100,
      gif: "91-100.mp4",
      phrase:
        "CORNO SUPREMO 🐂👑 o chifre já aparece no Google Maps e precisa abaixar a cabeça " +
        "pra passar na porta. Quando chove, o chifre funciona de para-raio ⚡",
    },
  ],
});
