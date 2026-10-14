import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sesión del panel: un solo usuario (vos). Cookie firmada con HMAC que vence a los 30 días.
 * Sin dependencias para que funcione igual en el proxy y en las Server Actions.
 */
export const COOKIE_SESION = "prospector_sesion";
const DURACION_MS = 30 * 86_400_000;

function firmar(dato: string, secreto: string) {
  return createHmac("sha256", secreto).update(dato).digest("base64url");
}

export function crearSesion(secreto: string, ahora = Date.now()): string {
  const vence = String(ahora + DURACION_MS);
  return `${vence}.${firmar(vence, secreto)}`;
}

export function sesionValida(valor: string | undefined, secreto: string | undefined, ahora = Date.now()): boolean {
  if (!valor || !secreto) return false;
  const [vence, firma] = valor.split(".");
  if (!vence || !firma || Number(vence) < ahora) return false;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(vence, secreto));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function claveCorrecta(ingresada: string, real: string): boolean {
  const a = createHmac("sha256", "comparar").update(ingresada).digest();
  const b = createHmac("sha256", "comparar").update(real).digest();
  return timingSafeEqual(a, b);
}
