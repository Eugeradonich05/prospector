/**
 * Detecta pedidos de no recibir más mensajes. Es una red de seguridad que no depende del modelo:
 * si coincide, se marca "no contactar" y se responde una sola vez con un cierre amable.
 * Los patrones se aplican sobre el texto en minúsculas y sin tildes.
 */
const PATRONES = [
  /\bno (me |nos )?(interesa|interesan)\b/,
  /\bno (estoy|estamos) interesad[oa]s?\b/,
  /\bno (me |nos )?(escrib|mand|molest|jod)/,
  /\bdeja de (escribir|mandar)/,
  /\b(baja|unsubscribe|stop|basta)\b/,
  /\bsaca(me|nos) de/,
  /^no,? gracias\b/,
  /\bspam\b/,
];

export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function esPedidoDeBaja(texto: string): boolean {
  const t = sinTildes(texto.toLowerCase()).replace(/\s+/g, " ").trim();
  return PATRONES.some((p) => p.test(t));
}

export const MENSAJE_BAJA = "Entendido, perdón por la molestia. No te vuelvo a escribir. ¡Éxitos!";
