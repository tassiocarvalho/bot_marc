import path from "node:path";
import { PREFIX } from "../../../config.js";
import { FUNNY_DIR } from "../../../utils/funnyMeter.js";
import { onlyNumbers } from "../../../utils/index.js";

const GIFS_DIR = path.resolve(FUNNY_DIR, "peixe");

/**
 * Tudo que pode sair do rio. `chance` é o peso do sorteio (somam 100).
 * Resultados com `items` sorteiam um item e um peso entre `kg[0]` e
 * `kg[1]`; os sem `items` são os fracassos.
 */
const CATCHES = [
  {
    chance: 28,
    gif: "lixo.mp4",
    title: "🗑️ *LIXO* 🗑️",
    items: [
      { name: "uma bota velha", kg: [0.8, 2] },
      { name: "um pneu de bicicleta", kg: [1, 3] },
      { name: "um boleto vencido no seu nome", kg: [0.01, 0.05] },
      { name: "o carregador que sumiu lá de casa", kg: [0.05, 0.1] },
      { name: "uma sacola do Assaí", kg: [0.02, 0.1] },
      { name: "o chinelo da sua mãe (corre que ela tá vindo)", kg: [0.3, 0.6] },
    ],
    phrases: [
      "Parabéns, você limpou o rio. O meio ambiente agradece 🌎♻️",
      "Nem o peixe quis papo com você 😔",
      "Pescador de lixo profissional. Pede emprego na prefeitura 🧹",
    ],
  },
  {
    chance: 27,
    gif: "comum.mp4",
    title: "🐟 *COMUM* 🐟",
    items: [
      { name: "um lambari", kg: [0.05, 0.3] },
      { name: "uma tilápia", kg: [0.5, 2] },
      { name: "uma sardinha", kg: [0.05, 0.2] },
      { name: "um bagrinho", kg: [0.2, 1] },
      { name: "um peixe-palhaço que jura que não é o Nemo", kg: [0.1, 0.3] },
    ],
    phrases: [
      "Dá pra um petisco. Pra janta não dá não 🍤",
      "Tira a foto de longe e com o braço esticado que parece maior 📸",
      "Humilde, mas é honesto. Vai pra panela 🍳",
    ],
  },
  {
    chance: 17,
    gif: "raro.mp4",
    title: "🐠 *RARO* 🐠",
    items: [
      { name: "um tucunaré", kg: [3, 9] },
      { name: "um dourado", kg: [5, 20] },
      { name: "um tambaqui", kg: [8, 25] },
      { name: "um peixe-boi (não é peixe, mas ok)", kg: [200, 500] },
    ],
    phrases: [
      "CATCHIN DA BIG ONE 🎉 já pode postar no status",
      "Agora vai contar essa história em todo churrasco pelos próximos 10 anos 🍖",
      "Pescador de respeito. O rio te teme 😤",
    ],
  },
  {
    chance: 10,
    gif: "tapa.mp4",
    title: "👋 *FRACASSO* 👋",
    phrases: [
      "O peixe pulou da água e te deu um *TAPA NA CARA* 🐟👋 Saiu humilhado e sem janta.",
      "Você puxou a linha e o peixe te deu uma *PEIXADA* na fuça 🐟💥 Respeita o rio.",
    ],
  },
  {
    chance: 7,
    gif: "caiu.mp4",
    title: "💦 *FRACASSO* 💦",
    phrases: [
      "A vara puxou *VOCÊ* pra dentro do rio 💦 Agora é o peixe que tá pescando você.",
      "Escorregou e caiu na água 🌊 Os peixes tão rindo até agora.",
    ],
  },
  {
    chance: 7,
    gif: "epico.mp4",
    title: "🦈 *ÉPICO* 🦈",
    items: [
      { name: "um tubarão-branco", kg: [600, 1500] },
      { name: "um tubarão-martelo", kg: [200, 450] },
      { name: "o tubarão do Instagram que vende curso de pescaria", kg: [80, 120] },
    ],
    phrases: [
      "Vamos precisar de um barco maior 🚤",
      "Ele te olhou nos olhos e pediu pra ser solto. Você recusou. Sigma 🗿",
    ],
  },
  {
    chance: 3,
    gif: "lendario.mp4",
    title: "🐉 *LENDÁRIO* 🐉",
    items: [
      { name: "o pirarucu ancestral do Rio Amazonas", kg: [1000, 3000] },
      { name: "a baleia que engoliu o Pinóquio", kg: [5000, 9000] },
      { name: "o peixe gigante que sua tia jura que viu na lagoa", kg: [2000, 6000] },
    ],
    phrases: [
      "Os pescadores mais velhos falavam dele em sussurros. Era real 😱",
      "O Ibama já tá a caminho 🚓 corre!",
    ],
  },
  {
    chance: 1,
    gif: "mitico.mp4",
    title: "✨ *MÍTICO* ✨",
    items: [
      { name: "um cardume contratado pra te encarar 👀", kg: null },
      { name: "o peixe que te deve 50 reais 💸", kg: null },
      { name: "o rei dos mares, que te pediu desculpa por tudo", kg: null },
    ],
    phrases: [
      "Chance de 1%. Você é a pessoa mais sortuda (ou mais azarada) do grupo 🍀",
      "Ninguém vai acreditar. Nem você 🤯",
    ],
  },
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function drawCatch() {
  let roll = Math.random() * 100;

  for (const option of CATCHES) {
    roll -= option.chance;

    if (roll < 0) {
      return option;
    }
  }

  return CATCHES[0];
}

function formatWeight([min, max]) {
  const kg = min + Math.random() * (max - min);

  if (kg < 1) {
    return `${Math.round(kg * 1000)} g`;
  }

  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

export default {
  name: "peixe",
  description: "Joga a vara no rio e vê o que vem: de bota velha a peixe mítico.",
  commands: ["peixe", "pescar", "pesca"],
  usage: `${PREFIX}peixe`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ sendGifFromFile, userLid }) => {
    const result = drawCatch();
    const mention = `@${onlyNumbers(userLid)}`;

    let body;

    if (result.items) {
      const item = pick(result.items);
      const weight = item.kg ? formatWeight(item.kg) : "peso incalculável";

      body = `${mention} jogou a vara e fisgou *${item.name}*!\n⚖️ ${weight}\n\n${pick(result.phrases)}`;
    } else {
      body = `${mention} jogou a vara e...\n\n${pick(result.phrases)}`;
    }

    await sendGifFromFile(
      path.resolve(GIFS_DIR, result.gif),
      `🎣 *PESCARIA* 🎣\n${result.title}\n\n${body}`,
      [userLid],
    );
  },
};
