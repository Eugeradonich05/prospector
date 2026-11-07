/** WhatsApp solo deja responder por la API dentro de las 24 h desde el último mensaje del complejo. */
export const VENTANA_HORAS = 24;

export function ventanaAbierta(ultimoEntrante: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!ultimoEntrante) return false;
  const desde = new Date(ultimoEntrante).getTime();
  if (Number.isNaN(desde)) return false;
  return ahora.getTime() - desde < VENTANA_HORAS * 3_600_000;
}
