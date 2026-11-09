/**
 * /pet — adote um gato ou cachorro no grupo, cuide dele e ganhe pontos.
 * Os dados ficam em database/pets/<grupo>/<dono>.json (persistente).
 *
 * @author bot_marc
 */
import fs from "node:fs";
import { BOT_EMOJI, PREFIX } from "../../../config.js";
import { WarningError } from "../../../errors/index.js";
import { renderPetSticker } from "../../../services/pet-art.js";
import {
  SPECIES,
  abandonPet,
  adoptPet,
  claimDaily,
  colorsOf,
  describePet,
  doAction,
  ensureGroupFolder,
  findColor,
  findSpecies,
  getRanking,
  loadPet,
  moodOf,
  recolorPet,
  renamePet,
  titleFor,
  wakeUp,
} from "../../../services/pet.js";
import { addStickerMetadata } from "../../../services/sticker.js";
import { onlyNumbers } from "../../../utils/index.js";
import { getSenderPlayerId, resolvePlayerId, splitWords } from "../../../utils/playerId.js";

const MEDALS = ["🥇", "🥈", "🥉"];

const ACTION_ALIASES = {
  comer: "comer", alimentar: "comer", comida: "comer", racao: "comer", ração: "comer",
  brincar: "brincar", jogar: "brincar",
  carinho: "carinho", cafune: "carinho", cafuné: "carinho", abracar: "carinho", abraçar: "carinho",
  banho: "banho", lavar: "banho",
  passear: "passear", passeio: "passear",
  dormir: "dormir", nanar: "dormir",
};

function helpText(prefix) {
  return `🐾 *PET DO GRUPO* 🐾
Adote um gatinho ou cachorrinho, cuide dele e suba no ranking!

🏠 *${prefix}pet adotar gato Mingau*
🏠 *${prefix}pet adotar cachorro Rex*
👀 *${prefix}pet* — ver seu pet

🍗 *${prefix}pet comer* · 🧶 *${prefix}pet brincar*
💕 *${prefix}pet carinho* · 🛁 *${prefix}pet banho*
🌳 *${prefix}pet passear* · 😴 *${prefix}pet dormir* / *acordar*
🎁 *${prefix}pet diario* — presente do dia (sequência 🔥)

📝 *${prefix}pet nome NovoNome* · 🎨 *${prefix}pet cor preto*
🔎 *${prefix}pet @fulano* — espiar o pet de alguém
🏆 *${prefix}pet rank*
💔 *${prefix}pet abandonar confirmar*

📜 *Como o pet funciona:*
• Precisou, ele aceita: com fome come, com sono dorme, sujo toma banho
• Satisfeito, ele recusa: barriga cheia não come, descansado não dorme
• 😴 Dorme até encher a energia e, dormindo, gasta bem menos
• Sem energia ou com muita fome, não brinca nem passeia
• O pet sente fome, sono e sujeira com o tempo, até offline!

⭐ *Como ganhar pontos:*
• Cada cuidado dá pontos e XP e volta a render depois de:
   🍗 4h · 🧶 3h · 💕 1h · 🛁 12h · 🌳 6h · 😴 8h
• Antes disso o cuidado funciona, só não dá pontos
• Pet com tudo acima de 70% rende *x2* pontos
• Pet largado (algo em 10% ou menos) rende só metade
• Subir de nível dá bônus · Nv.5 ganha laço/bandana, Nv.10 coroa 👑

🐱 Cores de gato: ${colorsOf("gato").join(", ")}
🐶 Cores de cachorro: ${colorsOf("cachorro").join(", ")}`;
}

export default {
  name: "pet",
  description: "Adote um gato ou cachorro, cuide dele e ganhe pontos!",
  commands: ["pet", "bichinho", "pets"],
  usage: `${PREFIX}pet adotar gato Mingau`,
  /**
   * @param {CommandHandleProps} props
   */
  handle: async ({
    fullArgs,
    isGroup,
    prefix,
    remoteJid,
    sendReply,
    sendStickerFromFile,
    socket,
    webMessage,
  }) => {
    if (!isGroup) {
      throw new WarningError("O pet só funciona em grupos!");
    }

    const owner = await getSenderPlayerId(socket, webMessage);
    if (!owner) return;

    ensureGroupFolder(remoteJid);

    const args = splitWords(fullArgs);
    const action = (args[0] || "").toLowerCase();
    const fix = (text) => text.replaceAll("{prefix}", prefix);
    const noPet = () =>
      new WarningError(
        `Você ainda não tem um pet neste grupo! 🐾\nAdote com *${prefix}pet adotar gato* ou *${prefix}pet adotar cachorro*`
      );

    const sendPetSticker = async (pet, mood) => {
      let file = null;
      try {
        const buffer = await renderPetSticker({
          species: pet.especie,
          color: pet.cor,
          mood,
          level: pet.nivel,
          name: pet.nome,
        });
        file = await addStickerMetadata(buffer, {
          username: `${SPECIES[pet.especie].emoji} ${pet.nome}`,
          botName: `${BOT_EMOJI} pet do grupo`,
        });
        await sendStickerFromFile(file);
      } finally {
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
      }
    };

    /** Envia figurinha + texto de um resultado do serviço. */
    const show = async (result) => {
      if (result.error === "NO_PET") throw noPet();
      if (result.error) {
        if (result.pet && result.mood) await sendPetSticker(result.pet, result.mood);
        throw new WarningError(fix(result.error));
      }
      await sendPetSticker(result.pet, result.mood);
      return sendReply(fix(result.text));
    };

    if (ACTION_ALIASES[action]) {
      return show(doAction(remoteJid, owner, ACTION_ALIASES[action]));
    }

    switch (action) {
      case "ajuda":
      case "help":
      case "comandos":
        return sendReply(helpText(prefix));

      case "adotar":
      case "adota":
      case "gato":
      case "cachorro": {
        const rest = action.startsWith("adot") ? args.slice(1) : args;
        const species = findSpecies(rest[0]);
        if (!species) {
          throw new WarningError(
            `Escolha gato ou cachorro! Ex.: *${prefix}pet adotar gato Mingau* 🐱🐶`
          );
        }

        let nameParts = rest.slice(1);
        let color = null;
        const lastWord = nameParts[nameParts.length - 1];
        if (nameParts.length > 1 && findColor(species, lastWord)) {
          color = findColor(species, lastWord);
          nameParts = nameParts.slice(0, -1);
        }

        const result = adoptPet({
          groupId: remoteJid,
          ownerId: owner,
          species,
          name: nameParts.join(" "),
          color,
        });
        if (result.error) throw new WarningError(result.error);

        const { pet } = result;
        await sendPetSticker(pet, "amor");
        return sendReply(
          `🎉 @${onlyNumbers(owner)} adotou ${SPECIES[species].emoji} *${pet.nome}* (${SPECIES[species].label.toLowerCase()} ${pet.cor})!
${SPECIES[species].sound}! 💕 Você ganhou *10 pts* de boas-vindas.

Cuide bem: *${prefix}pet comer*, *${prefix}pet brincar*, *${prefix}pet carinho*...
Veja tudo em *${prefix}pet ajuda*`,
          [owner]
        );
      }

      case "acordar":
        return show(wakeUp(remoteJid, owner));

      case "diario":
      case "diário":
      case "daily":
      case "presente":
        return show(claimDaily(remoteJid, owner));

      case "nome":
      case "renomear":
        if (args.length < 2) throw new WarningError(`Ex.: *${prefix}pet nome Bolinha*`);
        return show(renamePet(remoteJid, owner, args.slice(1).join(" ")));

      case "cor":
      case "pintar":
        if (args.length < 2) {
          const pet = loadPet(remoteJid, owner);
          if (!pet) throw noPet();
          throw new WarningError(`Cores disponíveis: ${colorsOf(pet.especie).join(", ")}`);
        }
        return show(recolorPet(remoteJid, owner, args[1]));

      case "rank":
      case "ranking":
      case "top": {
        const ranking = getRanking(remoteJid).slice(0, 10);
        if (!ranking.length) {
          return sendReply(`🏆 Ninguém tem pet ainda! Seja o primeiro: *${prefix}pet adotar gato*`);
        }
        const lines = ranking.map(
          (pet, index) =>
            `${MEDALS[index] || `*${index + 1}.*`} ${SPECIES[pet.especie].emoji} *${pet.nome}* de @${onlyNumbers(pet.dono)}\n      ⭐ *${pet.pontos} pts* · Nv.${pet.nivel} ${titleFor(pet.nivel)}`
        );
        return sendReply(
          `🏆 *RANKING DOS PETS* 🏆\n\n${lines.join("\n\n")}`,
          ranking.map((pet) => pet.dono)
        );
      }

      case "abandonar":
      case "doar": {
        if ((args[1] || "").toLowerCase() !== "confirmar") {
          throw new WarningError(
            `Tem certeza? 😿 Isso tira o pet de você e zera seus pontos.\nPara confirmar: *${prefix}pet abandonar confirmar*`
          );
        }
        const result = abandonPet(remoteJid, owner);
        if (result.error) throw noPet();
        return sendReply(result.text);
      }

      default:
        break;
    }

    // "/pet @fulano" ou "/pet" respondendo alguém: espia o pet da pessoa.
    const contextInfo = Object.values(webMessage?.message || {}).find(
      (content) => content && typeof content === "object" && content.contextInfo
    )?.contextInfo;
    const targetJid = contextInfo?.mentionedJid?.[0];

    let targetId = owner;
    if (targetJid) {
      targetId = await resolvePlayerId(socket, targetJid);
    } else if (action) {
      return sendReply(helpText(prefix));
    }

    const pet = loadPet(remoteJid, targetId);
    if (!pet) {
      if (targetId !== owner) {
        throw new WarningError(`@${onlyNumbers(targetId)} ainda não tem pet. 🐾`);
      }
      return sendReply(helpText(prefix));
    }

    await sendPetSticker(pet, moodOf(pet));
    const header = targetId === owner ? "" : `🔎 Pet de @${onlyNumbers(targetId)}\n\n`;
    return sendReply(header + describePet(pet), [targetId]);
  },
};
