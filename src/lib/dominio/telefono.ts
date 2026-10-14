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

export function linkWhatsApp(telefonoWa: string, mensaje: string): string {
  return `https://wa.me/${telefonoWa}?text=${encodeURIComponent(mensaje)}`;
}
