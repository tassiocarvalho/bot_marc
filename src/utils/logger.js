/**
 * Logs
 *
 * @author bot_marc
 */
import pkg from "../../package.json" with { type: "json" };

let consoleNoiseFilterInstalled = false;

export function installConsoleNoiseFilter() {
  if (consoleNoiseFilterInstalled) {
    return;
  }

  const originalConsoleInfo = console.info.bind(console);

  console.info = (...args) => {
    if (args[0] === "Closing session:") {
      warningLog(
        "O WhatsApp fechou uma sessão criptografada antiga para renovar as chaves. Isso é um aviso normal da conexão e não indica erro no bot.",
      );
      return;
    }

    if (args[0] === "Removing old closed session:") {
      warningLog(
        "O WhatsApp removeu uma sessão criptografada antiga já fechada. Isso é limpeza normal do histórico de chaves e não indica erro no bot.",
      );
      return;
    }

    originalConsoleInfo(...args);
  };

  consoleNoiseFilterInstalled = true;
}

export function sayLog(message) {
  console.log("\x1b[36m[BOT_MARC | TALK]\x1b[0m", message);
}

export function inputLog(message) {
  console.log("\x1b[30m[BOT_MARC | INPUT]\x1b[0m", message);
}

export function infoLog(message) {
  console.log("\x1b[34m[BOT_MARC | INFO]\x1b[0m", message);
}

export function successLog(message) {
  console.log("\x1b[32m[BOT_MARC | SUCCESS]\x1b[0m", message);
}

export function errorLog(message) {
  console.log("\x1b[31m[BOT_MARC | ERROR]\x1b[0m", message);
}

export function warningLog(message) {
  console.log("\x1b[33m[BOT_MARC | WARNING]\x1b[0m", message);
}

const BANNER = [
  '    ____  ____  ______   __  ___               ',
  '   / __ )/ __ \\/_  __/  /  |/  /___ ___________',
  '  / __  / / / / / /    / /|_/ / __ `/ ___/ ___/',
  ' / /_/ / /_/ / / /    / /  / / /_/ / /  / /__  ',
  '/_____/\\____/ /_/____/_/  /_/\\__,_/_/   \\___/  ',
  '               /_____/',
];

export function bannerLog() {
  for (const line of BANNER) {
    console.log(`\x1b[36m${line}\x1b[0m`);
  }

  console.log(`\x1b[36m🤖 Versão: \x1b[0m${pkg.version}\n`);
}
