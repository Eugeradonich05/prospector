/**
 * Reglas puras sobre complejos: deportes, rubro, prioridad, sistema actual y deduplicado.
 * Las usan el seed, «Buscar complejos» (Google Maps), «Importar planilla» y «Agregar a mano».
 */
import { sinTildes } from "./lineas";

export const DEPORTES = ["fútbol 5", "fútbol 7", "fútbol 11", "fútbol", "pádel", "tenis", "básquet", "vóley", "hockey", "squash"] as const;
export type Deporte = (typeof DEPORTES)[number];

export const SISTEMAS = ["ninguno", "whatsapp_manual", "atc", "clubo", "otro"] as const;
export type SistemaActual = (typeof SISTEMAS)[number];

export const ETIQUETA_SISTEMA: Record<SistemaActual, string> = {
  ninguno: "Ninguno",
  whatsapp_manual: "WhatsApp / a mano",
  atc: "ATC",
  clubo: "Clubo",
  otro: "Otro sistema",
};

export const ORIGENES = ["seed", "google", "importado", "manual"] as const;
export type Origen = (typeof ORIGENES)[number];

const REGLAS_DEPORTE: [RegExp, Deporte][] = [
  [/futbol\s*(5|cinco)\b|\bf5\b|futbol5|football\s*5/, "fútbol 5"],
  [/futbol\s*(7|siete)\b|\bf7\b|futbol7/, "fútbol 7"],
  [/futbol\s*(11|once)\b/, "fútbol 11"],
  [/padel|paddle/, "pádel"],
  [/tenis|tennis/, "tenis"],
  [/basquet|basket/, "básquet"],
  [/voley|volley/, "vóley"],
  [/hockey/, "hockey"],
  [/squash/, "squash"],
];

/** Deportes que se leen en el nombre o el rubro, sin inventar: "Pádel y Fútbol 5 X" → ["fútbol 5", "pádel"]. */
export function deportesDesdeTexto(...textos: (string | null | undefined)[]): Deporte[] {
  const t = sinTildes(textos.filter(Boolean).join(" "));
  const encontrados = new Set<Deporte>();
  for (const [patron, deporte] of REGLAS_DEPORTE) if (patron.test(t)) encontrados.add(deporte);
  const conNumero = encontrados.has("fútbol 5") || encontrados.has("fútbol 7") || encontrados.has("fútbol 11");
  if (!conNumero && /futbol|futsal|soccer|football/.test(t)) encontrados.add("fútbol");
  return DEPORTES.filter((d) => encontrados.has(d));
}

/** Rubro para el panel y los mensajes: siempre uno de canchas. */
export function rubroDesdeDeportes(deportes: readonly string[]): string {
  const futbol = deportes.some((d) => d.startsWith("fútbol"));
  const otros = deportes.filter((d) => !d.startsWith("fútbol"));
  if (futbol && !otros.length) return "Complejo de fútbol";
  if (!futbol && otros.length === 1 && otros[0] === "pádel") return "Pádel";
  if (!futbol && otros.length === 1 && otros[0] === "tenis") return "Tenis";
  return "Complejo deportivo";
}

/** Misma regla que el seed: A con 50 reseñas o más, B con 15 o más, C el resto. */
export function prioridadPorResenas(resenas: number | null | undefined): "A" | "B" | "C" {
  const n = resenas ?? 0;
  if (n >= 50) return "A";
  if (n >= 15) return "B";
  return "C";
}

/** Lo que alguien escribió en la planilla → sistema actual. Vacío: no se sabe (null). */
export function sistemaDesdeTexto(texto: string | null | undefined): SistemaActual | null {
  const t = sinTildes((texto ?? "").trim());
  if (!t || t === "-" || /^(no se|nose|\?|s\/d|sin dato)/.test(t)) return null;
  if ((SISTEMAS as readonly string[]).includes(t)) return t as SistemaActual;
  if (/\batc\b|alquila ?tu ?cancha/.test(t)) return "atc";
  if (/clubo/.test(t)) return "clubo";
  if (/whats|wsp|wpp|a mano|manual|cuaderno|planilla|telefono|llamad/.test(t)) return "whatsapp_manual";
  if (/^(ninguno|nada|no tiene|no usa|no)$/.test(t)) return "ninguno";
  return "otro";
}

/** query_place_id del link de Google Maps del seed. */
export function placeIdDeMapsUrl(url: string | null | undefined): string | null {
  const m = /[?&]query_place_id=([^&]+)/.exec(url ?? "");
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Nombre o ciudad para comparar: sin tildes, sin signos y con espacios simples. */
export function normalizarTexto(s: string | null | undefined): string {
  return sinTildes(s ?? "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function claveNombreCiudad(nombre: string, ciudad: string | null | undefined): string {
  return `${normalizarTexto(nombre)}|${normalizarTexto(ciudad)}`;
}

// ── Deduplicado ──────────────────────────────────────────

export type Existente = {
  id: string;
  nombre: string;
  ciudad: string | null;
  place_id: string | null;
  telefono_wa: string | null;
  estado: string;
  direccion?: string | null;
};
export type Identificable = { nombre: string; ciudad: string | null; place_id?: string | null; telefono_wa: string | null; direccion?: string | null };

export type Coincidencia = { por: "place_id" | "telefono" | "nombre"; existente: Existente | null; enLista: number | null };

/**
 * Mismo nombre y ciudad no alcanza si se sabe que son lugares distintos: dos place_id diferentes
 * (sucursales de una cadena, o el mismo nombre en dos barrios de CABA) o dos direcciones diferentes.
 */
function mismoLugarPorNombre(a: Identificable, b: Identificable): boolean {
  if (a.place_id && b.place_id && a.place_id !== b.place_id) return false;
  if (a.direccion && b.direccion && normalizarTexto(a.direccion) !== normalizarTexto(b.direccion)) return false;
  return true;
}

function agregar<T>(mapa: Map<string, T[]>, clave: string, valor: T) {
  mapa.set(clave, [...(mapa.get(clave) ?? []), valor]);
}

/**
 * Para cada candidato dice si ya está en la base (o repetido más arriba en la misma lista):
 * mismo place_id, mismo WhatsApp, o mismo nombre y ciudad normalizados. null = es nuevo.
 */
export function buscarDuplicados<T extends Identificable>(candidatos: T[], existentes: Existente[]): (Coincidencia | null)[] {
  const porPlace = new Map<string, Existente>();
  const porTel = new Map<string, Existente>();
  const porNombre = new Map<string, Existente[]>();
  for (const e of existentes) {
    if (e.place_id) porPlace.set(e.place_id, e);
    if (e.telefono_wa) porTel.set(e.telefono_wa, e);
    agregar(porNombre, claveNombreCiudad(e.nombre, e.ciudad), e);
  }
  const vistosPlace = new Map<string, number>();
  const vistosTel = new Map<string, number>();
  const vistosNombre = new Map<string, number[]>();

  return candidatos.map((c, i) => {
    const clave = claveNombreCiudad(c.nombre, c.ciudad);
    const porNombreEnBase = porNombre.get(clave)?.find((e) => mismoLugarPorNombre(c, e));
    const enBase: Coincidencia | null =
      (c.place_id && porPlace.has(c.place_id) && { por: "place_id", existente: porPlace.get(c.place_id)!, enLista: null }) ||
      (c.telefono_wa && porTel.has(c.telefono_wa) && { por: "telefono", existente: porTel.get(c.telefono_wa)!, enLista: null }) ||
      (porNombreEnBase && { por: "nombre", existente: porNombreEnBase, enLista: null }) ||
      null;
    if (enBase) return enBase;
    const porNombreEnLista = vistosNombre.get(clave)?.find((j) => mismoLugarPorNombre(c, candidatos[j]!));
    const repetido: Coincidencia | null =
      (c.place_id && vistosPlace.has(c.place_id) && { por: "place_id", existente: null, enLista: vistosPlace.get(c.place_id)! }) ||
      (c.telefono_wa && vistosTel.has(c.telefono_wa) && { por: "telefono", existente: null, enLista: vistosTel.get(c.telefono_wa)! }) ||
      (porNombreEnLista !== undefined && { por: "nombre", existente: null, enLista: porNombreEnLista }) ||
      null;
    if (repetido) return repetido;
    if (c.place_id) vistosPlace.set(c.place_id, i);
    if (c.telefono_wa) vistosTel.set(c.telefono_wa, i);
    agregar(vistosNombre, clave, i);
    return null;
  });
}
