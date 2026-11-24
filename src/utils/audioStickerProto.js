/**
 * Suporte a figurinha com som no proto da Baileys.
 *
 * O WhatsApp manda a figurinha com som como
 * `Message.audioStickerMessage` (campo 134, um FutureProofMessage) com uma
 * `stickerMessage` dentro, e o som vai em `StickerMessage.audioMessage`
 * (campo 26). A Baileys 7.0.0-rc14 não conhece nenhum dos dois campos: na
 * leitura eles são descartados e no envio não são gravados.
 *
 * Em vez de editar o WAProto gerado (4 MB), este módulo embrulha encode,
 * decode, fromObject e toObject das duas mensagens para tratar só esses
 * campos a mais. Basta importar o módulo uma vez; importar de novo não faz
 * nada.
 *
 * @author bot_marc
 */
import { proto } from "baileys";

const AUDIO_STICKER_FIELD = 134;
const STICKER_AUDIO_FIELD = 26;
const LENGTH_DELIMITED = 2;
const PATCHED = Symbol.for("bot_marc.audioStickerProto");

/**
 * Lê um varint a partir de `pos`. Devolve [valor, próxima posição] ou null
 * se o buffer acabar no meio.
 */
function readVarint(buf, pos, end) {
  let value = 0;
  let multiplier = 1;

  while (pos < end) {
    const byte = buf[pos++];
    value += (byte & 0x7f) * multiplier;

    if (byte < 0x80) {
      return [value, pos];
    }

    multiplier *= 128;
  }

  return null;
}

/**
 * Percorre só o primeiro nível de uma mensagem protobuf e devolve o
 * conteúdo dos campos `fieldNumber` do tipo bytes/mensagem.
 */
function findLengthDelimitedFields(buf, start, end, fieldNumber) {
  const found = [];
  let pos = start;

  while (pos < end) {
    const key = readVarint(buf, pos, end);
    if (!key) break;

    const [tag, afterKey] = key;
    const field = Math.floor(tag / 8);
    const wireType = tag % 8;
    pos = afterKey;

    if (wireType === 0) {
      const value = readVarint(buf, pos, end);
      if (!value) break;
      pos = value[1];
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else if (wireType === LENGTH_DELIMITED) {
      const length = readVarint(buf, pos, end);
      if (!length) break;

      const [size, dataStart] = length;
      const dataEnd = dataStart + size;
      if (dataEnd > end) break;

      if (field === fieldNumber) {
        found.push(buf.subarray(dataStart, dataEnd));
      }

      pos = dataEnd;
    } else {
      // Grupos (3/4) não aparecem no proto do WhatsApp; para por segurança.
      break;
    }
  }

  return found;
}

/**
 * Acrescenta um campo de submensagem a um tipo gerado pelo protobufjs.
 */
function addMessageField(Type, { key, fieldNumber, SubType }) {
  const tag = fieldNumber * 8 + LENGTH_DELIMITED;

  const originalEncode = Type.encode;
  Type.encode = function encode(message, writer) {
    const output = originalEncode.call(this, message, writer);

    if (message?.[key] != null) {
      SubType.encode(message[key], output.uint32(tag).fork()).ldelim();
    }

    return output;
  };

  const originalDecode = Type.decode;
  Type.decode = function decode(reader, length, ...rest) {
    const isReader = reader && typeof reader.uint32 === "function";
    const buf = isReader ? reader.buf : reader;
    const start = isReader ? reader.pos : 0;
    const end =
      length === undefined ? (isReader ? reader.len : buf.length) : start + length;

    const message = originalDecode.call(this, reader, length, ...rest);

    if (buf && end > start) {
      const [data] = findLengthDelimitedFields(buf, start, end, fieldNumber);

      if (data) {
        message[key] = SubType.decode(data);
      }
    }

    return message;
  };

  const originalFromObject = Type.fromObject;
  Type.fromObject = function fromObject(object) {
    const message = originalFromObject.call(this, object);

    if (object?.[key] != null && !(object instanceof Type)) {
      message[key] =
        object[key] instanceof SubType
          ? object[key]
          : SubType.fromObject(object[key]);
    }

    return message;
  };

  const originalToObject = Type.toObject;
  Type.toObject = function toObject(message, options) {
    const object = originalToObject.call(this, message, options);

    if (message?.[key] != null) {
      object[key] = SubType.toObject(message[key], options);
    }

    return object;
  };
}

export function installAudioStickerProto() {
  if (proto.Message[PATCHED]) {
    return;
  }

  addMessageField(proto.Message.StickerMessage, {
    key: "audioMessage",
    fieldNumber: STICKER_AUDIO_FIELD,
    SubType: proto.Message.AudioMessage,
  });

  addMessageField(proto.Message, {
    key: "audioStickerMessage",
    fieldNumber: AUDIO_STICKER_FIELD,
    SubType: proto.Message.FutureProofMessage,
  });

  proto.Message[PATCHED] = true;
}

installAudioStickerProto();
