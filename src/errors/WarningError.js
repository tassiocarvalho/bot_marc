/**
 * Classe de erro customizada para
 * avisos.
 *
 * @author bot_marc
 */
export default class WarningError extends Error {
  constructor(message) {
    super(message);
    this.name = "WarningError";
  }
}
