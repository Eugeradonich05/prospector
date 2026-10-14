/**
 * Fechas en la zona horaria de Argentina.
 * Las fechas de negocio (vencimientos, períodos) se manejan como texto "AAAA-MM-DD"
 * para no arrastrar horas ni husos horarios.
 */

export const ZONA_AR = "America/Argentina/Buenos_Aires";

export type FechaISO = string; // "2026-10-13"

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Fecha de hoy en Argentina, como "AAAA-MM-DD". */
export function hoyAR(ahora: Date = new Date()): FechaISO {
  // en-CA formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function partes(fecha: FechaISO): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function aUTC(fecha: FechaISO): number {
  const [a, m, d] = partes(fecha);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms: number): FechaISO {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Primer día del mes de la fecha. */
export function inicioDeMes(fecha: FechaISO): FechaISO {
  const [a, m] = partes(fecha);
  return `${a}-${String(m).padStart(2, "0")}-01`;
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  return deUTC(aUTC(fecha) + dias * 86_400_000);
}

export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const [a, m, d] = partes(fecha);
  const base = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return deUTC(base.getTime());
}

/** Días de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000);
}

/** "2026-10-01" → "Octubre 2026" */
export function nombrePeriodo(periodo: FechaISO): string {
  const [a, m] = partes(periodo);
  const mes = MESES[m - 1]!;
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a}`;
}

/** "2026-10-13" → "13/10" (o "13/10/2026" con año) */
export function fechaCorta(fecha: FechaISO, conAnio = false): string {
  const [a, m, d] = partes(fecha);
  const base = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return conAnio ? `${base}/${a}` : base;
}

/** "2026-10-13" → "13 de octubre" */
export function fechaLarga(fecha: FechaISO): string {
  const [, m, d] = partes(fecha);
  return `${d} de ${MESES[m - 1]}`;
}

/** Valida un período "AAAA-MM" o "AAAA-MM-01" y lo devuelve como "AAAA-MM-01". */
export function parsearPeriodo(valor: string | null | undefined): FechaISO | null {
  if (!valor) return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/.exec(valor.trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}
