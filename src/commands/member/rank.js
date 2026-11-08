import { PREFIX } from "../../config.js";
import { WarningError } from "../../errors/index.js";
import {
  getMessageRanking,
  MESSAGE_CATEGORIES,
} from "../../services/message-ranking.js";
import { onlyNumbers } from "../../utils/index.js";

const TOP_SIZE = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

const formatNumber = (value) => value.toLocaleString("pt-BR");

function formatEntry({ userId, counts, total }, index) {
  const position = MEDALS[index] || `*${index + 1}.*`;
  const breakdown = MESSAGE_CATEGORIES.filter(({ key }) => counts[key])
    .map(({ key, emoji }) => `${emoji} ${formatNumber(counts[key])}`)
    .join(" · ");

  return `${position} @${onlyNumbers(userId)}
      💬 *${formatNumber(total)} ${total === 1 ? "mensagem" : "mensagens"}*
      ${breakdown}`;
}

export default {
  name: "rank",
  description: "Mostra o top 10 de quem mais manda mensagens no grupo",
  commands: ["rank", "ranking"],
  usage: `${PREFIX}rank`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({ isGroup, remoteJid, sendReply, socket }) => {
    if (!isGroup) {
      throw new WarningError("O rank só funciona em grupos!");
    }

    const { since, ranking } = getMessageRanking(socket, remoteJid);

    if (!ranking.length) {
      await sendReply("📊 Ainda não contei nenhuma mensagem neste grupo!");
      return;
    }

    const top = ranking.slice(0, TOP_SIZE);
    const legend = MESSAGE_CATEGORIES.map(
      ({ emoji, label }) => `${emoji} ${label}`,
    ).join(" · ");
    const sinceDate = new Date(since).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    await sendReply(
      `🏆 *TOP ${TOP_SIZE} — MENSAGENS* 🏆

${top.map(formatEntry).join("\n\n")}

_${legend}_
_Contando desde ${sinceDate}_`,
      top.map(({ userId }) => userId),
    );
  },
};
