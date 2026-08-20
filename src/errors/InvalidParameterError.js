/**
 * Classe de erro customizada para
 * parâmetros inválidos.
 *
 * @author bot_marc
 */
export default class InvalidParameterError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidParameterError";
  }
}
