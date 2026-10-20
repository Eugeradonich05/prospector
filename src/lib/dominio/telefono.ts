/**
 * Teléfonos argentinos → formato de WhatsApp (549 + 10 dígitos).
 * Ojo: el webhook de WhatsApp suele traer los celulares argentinos como "549XXXXXXXXXX",
 * pero algunas cuentas llegan como "54XXXXXXXXXX" (sin el 9). Ambos se normalizan igual.
 */
export function normalizarTelefonoAR(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  let d = entrada.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12) {
    for (const largo of [2, 3, 4]) {
      if (d.slice(largo, largo + 2) === "15") {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }
  return d.length === 10 ? `549${d}` : null;
}

export type ChanceWhatsApp = "alta" | "media" | "baja";

/**
 * Qué tan probable es que el número tenga WhatsApp, mirando cómo figura en Google Maps.
 * No hay forma pública de consultarlo, así que es una estimación:
 * - "alta": figura como celular ("+54 9 …" o con 15).
 * - "baja": figura sin el 9 y el número local empieza con 4, que en Argentina casi siempre es un fijo.
 * - "media": el resto (celulares cargados sin el 9 y algunos fijos nuevos).
 */
export function chanceWhatsApp(telefono: string | null | undefined, telefonoWa?: string | null): ChanceWhatsApp {
  if (!telefono) return telefonoWa ? "media" : "baja";
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("549")) return "alta";
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // Con el 15 de celular: característica (2 a 4 dígitos) + 15 + número, 12 dígitos en total.
  if (d.length === 12 && [2, 3, 4].some((n) => d.slice(n, n + 2) === "15")) return "alta";
  // Sin el 9: el primer dígito del número local está después del espacio que separa la característica.
  const local = telefono.match(/^\s*(?:\+?54\s+|0)?\(?\d{2,4}\)?[\s-]+(\d)/);
  if (local?.[1] === "4") return "baja";
  return "media";
}

export function linkWhatsApp(telefonoWa: string, mensaje: string): string {
  return `https://wa.me/${telefonoWa}?text=${encodeURIComponent(mensaje)}`;
}
