import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefixo padrão dos comandos.
export const PREFIX = "/";

// Emoji do bot (mude se preferir).
export const BOT_EMOJI = "🤖";

// Nome do bot (mude se preferir).
export const BOT_NAME = "bot_marc";

// Nome usado como autor/publisher das figurinhas.
export const STICKER_AUTHOR = "bot_marc_tassio";

// LID do bot (no caso, o que você rodará o bot).
// Para obter o LID do bot, use o comando <prefixo>lid respondendo em cima de uma mensagem do número do bot
// Troque o <prefixo> pelo prefixo do bot (ex: /lid).
export const BOT_LID = "12345678901234567890@lid";

// LID do dono do bot (no caso, o seu!).
// Para obter o LID do dono do bot, use o comando <prefixo>meu-lid
// Troque o <prefixo> pelo prefixo do bot (ex: /meu-lid).
export const OWNER_LID = "12345678901234567890@lid";

// Diretório dos comandos
export const COMMANDS_DIR = path.join(__dirname, "commands");

// Diretório de arquivos de mídia.
export const DATABASE_DIR = path.resolve(__dirname, "..", "database");

// Diretório de arquivos de mídia.
export const ASSETS_DIR = path.resolve(__dirname, "..", "assets");

// Diretório de arquivos temporários.
export const TEMP_DIR = path.resolve(__dirname, "..", "assets", "temp");

// Timeout em milissegundos por evento (evita banimento).
export const TIMEOUT_IN_MILLISECONDS_BY_EVENT = 500;

// Duracao maxima (em minutos) aceita nos comandos de download.
export const MAX_DOWNLOAD_DURATION_IN_MINUTES = 12;

// Caminho de um arquivo cookies.txt para o yt-dlp.
// Necessario quando o bot roda em VPS/nuvem (AWS, GCP, Azure), porque o
// YouTube bloqueia IPs de datacenter com "Sign in to confirm you are not a bot".
// Deixe vazio para nao usar cookies.
// Em VPS, prefira a variavel de ambiente YTDLP_COOKIES_FILE: assim o
// git pull nao conflita com este arquivo.
export const YTDLP_COOKIES_FILE = process.env.YTDLP_COOKIES_FILE || "";

// Proxy opcional para o yt-dlp (ex: "http://usuario:senha@host:porta").
// Deixe vazio para nao usar proxy. Aceita a variavel de ambiente YTDLP_PROXY.
export const YTDLP_PROXY = process.env.YTDLP_PROXY || "";

// Plataforma de API's
export const SPIDER_API_BASE_URL = "https://api.spiderx.com.br/api";

// Obtenha seu token, criando uma conta em: https://api.spiderx.com.br.
export const SPIDER_API_TOKEN = "seu_token_aqui";

// Plataforma recomendada para o comando gerar-link.
// Com chave propria do Linker, os links seguem a duracao do plano Linker.
// Com token da Spider X API, os links duram 1 dia.
export const LINKER_BASE_URL = "https://linker.devgui.dev/api";

// Obtenha sua chave em: https://linker.devgui.dev.
// Se não configurar esta chave, o bot usa automaticamente o token da Spider X API.
export const LINKER_API_KEY = "seu_token_aqui";

// Caso queira responder apenas um grupo específico,
// coloque o ID dele na configuração abaixo.
// Para saber o ID do grupo, use o comando <prefixo>get-group-id
// Troque o <prefixo> pelo prefixo do bot (ex: /get-group-id).
export const ONLY_GROUP_ID = "";

// Numeros que podem usar o bot no privado (PV). Vazio = so grupo.
// Use o numero completo com DDI e DDD, so digitos: "5511999999999".
// Aceita a variavel de ambiente ALLOWED_PRIVATE_NUMBERS (separada por virgula).
export const ALLOWED_PRIVATE_NUMBERS = (
  process.env.ALLOWED_PRIVATE_NUMBERS || "5575991718010,5575983258635"
)
  .split(",")
  .map((numero) => numero.replace(/[^0-9]/g, ""))
  .filter(Boolean);

// Configuração para modo de desenvolvimento
// mude o valor para ( true ) sem os parênteses
// caso queira ver os logs de mensagens recebidas
export const DEVELOPER_MODE = false;

// Chave da OpenAI para o comando de suporte
export const OPENAI_API_KEY = "";
