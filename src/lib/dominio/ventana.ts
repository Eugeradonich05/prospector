/** WhatsApp solo deja responder por la API dentro de las 24 h desde el último mensaje del complejo. */
export const VENTANA_HORAS = 24;

export function ventanaAbierta(ultimoEntrante: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!ultimoEntrante) return false;
  const desde = new Date(ultimoEntrante).getTime();
  if (Number.isNaN(desde)) return false;
  return ahora.getTime() - desde < VENTANA_HORAS * 3_600_000;
}

/** Horas enteras que quedan para responder por la API (redondeando para arriba), o null si la ventana está cerrada. */
export function horasRestantesVentana(ultimoEntrante: string | null | undefined, ahora: Date = new Date()): number | null {
  if (!ventanaAbierta(ultimoEntrante, ahora)) return null;
  const transcurrido = ahora.getTime() - new Date(ultimoEntrante!).getTime();
  return Math.ceil((VENTANA_HORAS * 3_600_000 - transcurrido) / 3_600_000);
}
