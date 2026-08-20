# 🤖 bot_marc



Bot de WhatsApp multifunções em Node.js, construído sobre a biblioteca
[Baileys](https://github.com/WhiskeySockets/Baileys).

## Requisitos

- Node.js 22.8 ou superior
- FFmpeg (para stickers, áudio e vídeo)
- Git

## Instalação

```sh
git clone https://github.com/tassiocarvalho/bot_marc.git
cd bot_marc
npm install
```

O `npm install` aplica automaticamente um patch no Baileys (botões e listas)
através do script `scripts/patch-baileys.mjs`.

**Dependências de sistema:**

| Sistema | Comando |
|---------|---------|
| Termux | `pkg install git nodejs-lts ffmpeg -y` |
| Windows | `winget install Git.Git OpenJS.NodeJS Gyan.FFmpeg` |
| Debian/Ubuntu | `sudo apt install git ffmpeg` |

## Configuração

Edite [`src/config.js`](./src/config.js):

| Campo | Descrição |
|-------|-----------|
| `PREFIX` | Prefixo dos comandos (padrão: `/`) |
| `BOT_NAME` | Nome exibido pelo bot |
| `BOT_EMOJI` | Emoji usado nas respostas |
| `BOT_LID` | LID do número que roda o bot — obtenha com `/lid` |
| `OWNER_LID` | Seu LID de dono — obtenha com `/meu-lid` |
| `SPIDER_API_TOKEN` | Token da [Spider X API](https://api.spiderx.com.br), usado por vários comandos |
| `OPENAI_API_KEY` | Chave da OpenAI, usada pelo comando de suporte |

## Executando

```sh
npm start
```

Um QR Code aparece no terminal. Leia com o WhatsApp em
**Aparelhos conectados → Conectar um aparelho**.

A sessão fica salva em `assets/auth/`. Para desconectar e gerar um novo QR:

```sh
./reset-qr-auth.sh
```

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm start` | Inicia o bot |
| `npm run test:all` | Roda a suíte de testes |
| `npm test` | Roda os testes customizados |
| `npm run patch:baileys` | Reaplica o patch do Baileys |

## Estrutura

```
src/
├── commands/       comandos do bot
│   ├── admin/      comandos de administrador de grupo
│   ├── member/     comandos abertos a todos
│   └── owner/      comandos do dono do bot
├── middlewares/    interceptadores de mensagens e eventos
├── services/       integrações externas (Baileys, FFmpeg, APIs)
├── utils/          utilitários
├── config.js       configurações
├── connection.js   conexão com o WhatsApp
└── index.js        ponto de entrada
```

Para criar um comando novo, use [`src/commands/🤖-como-criar-comandos.js`](./src/commands/) como modelo.

## Licença

[GPL-3.0](./LICENSE)

Trabalho derivado do [takeshi-bot](https://github.com/guiireal/takeshi-bot),
criado por Guilherme França (Dev Gui). As modificações seguem a mesma licença.
