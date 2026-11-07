/**
 * Importar planilla (.csv o .xlsx) de complejos. Puro: el navegador lee el archivo y el servidor
 * vuelve a validar y clasificar cada fila con estas mismas funciones antes de guardar.
 */
import { buscarDuplicados, deportesDesdeTexto, normalizarTexto, rubroDesdeDeportes, sistemaDesdeTexto, type Existente, type SistemaActual } from "./complejos";
import { normalizarInstagram, normalizarWeb } from "./datos-complejo";
import { esRubroDeCanchas } from "./lineas";
import { normalizarTelefonoAR } from "./telefono";

export const MAX_FILAS_IMPORTAR = 3000;

export type Campo = "nombre" | "ciudad" | "provincia" | "direccion" | "telefono" | "instagram" | "sistema_actual" | "notas" | "rubro" | "web" | "canchas" | "deportes";

/** Encabezados aceptados para cada campo (sin tildes ni mayúsculas). */
const SINONIMOS: Record<Campo, string[]> = {
  nombre: ["nombre", "complejo", "nombre del complejo", "club", "lugar"],
  ciudad: ["ciudad", "localidad", "partido"],
  provincia: ["provincia", "prov"],
  direccion: ["direccion", "domicilio", "calle"],
  telefono: ["telefono", "tel", "celular", "cel", "whatsapp", "wsp", "numero", "contacto"],
  instagram: ["instagram", "ig", "insta"],
  sistema_actual: ["sistema actual", "sistema", "como reservan", "reservas", "app"],
  notas: ["notas", "nota", "observaciones", "comentarios"],
  rubro: ["rubro", "tipo"],
  web: ["web", "sitio", "pagina", "sitio web"],
  canchas: ["canchas", "cantidad de canchas", "cant canchas"],
  deportes: ["deportes", "deporte"],
};

/** Qué columna de la planilla corresponde a cada campo. Las que no se reconocen se ignoran. */
export function reconocerColumnas(encabezados: unknown[]): { indices: Partial<Record<Campo, number>>; ignoradas: string[] } {
  const indices: Partial<Record<Campo, number>> = {};
  const ignoradas: string[] = [];
  encabezados.forEach((e, i) => {
    const t = normalizarTexto(String(e ?? ""));
    const campo = (Object.keys(SINONIMOS) as Campo[]).find((c) => SINONIMOS[c].includes(t));
    if (campo && indices[campo] === undefined) indices[campo] = i;
    else if (t) ignoradas.push(String(e));
  });
  return { indices, ignoradas };
}

export type FilaImportada = {
  nombre: string;
  ciudad: string | null;
  provincia: string | null;
  direccion: string | null;
  telefono: string | null;
  telefono_wa: string | null;
  instagram: string | null;
  web: string | null;
  sistema_actual: SistemaActual | null;
  notas: string | null;
  rubro: string;
  deportes: string[];
  canchas_cantidad: number | null;
};

const celda = (fila: unknown[], i: number | undefined, max = 300): string | null => {
  if (i === undefined) return null;
  const v = fila[i];
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
};

/** Convierte una fila de la planilla. Devuelve null si no tiene nombre. */
export function convertirFila(fila: unknown[], indices: Partial<Record<Campo, number>>): FilaImportada | { rechazo: string; nombre: string } | null {
  const nombre = celda(fila, indices.nombre, 200);
  if (!nombre) return null;
  const rubroPlanilla = celda(fila, indices.rubro, 80);
  if (rubroPlanilla && !esRubroDeCanchas(rubroPlanilla)) return { rechazo: `rubro «${rubroPlanilla}» no es de canchas`, nombre };
  const deportes = deportesDesdeTexto(nombre, rubroPlanilla, celda(fila, indices.deportes));
  const telefono = celda(fila, indices.telefono, 40);
  const canchas = Number.parseInt(celda(fila, indices.canchas, 10) ?? "", 10);
  return {
    nombre,
    ciudad: celda(fila, indices.ciudad, 120),
    provincia: celda(fila, indices.provincia, 120),
    direccion: celda(fila, indices.direccion),
    telefono,
    telefono_wa: normalizarTelefonoAR(telefono),
    instagram: normalizarInstagram(celda(fila, indices.instagram, 200)),
    web: normalizarWeb(celda(fila, indices.web)),
    sistema_actual: sistemaDesdeTexto(celda(fila, indices.sistema_actual, 100)),
    notas: celda(fila, indices.notas, 2000),
    rubro: rubroPlanilla ?? rubroDesdeDeportes(deportes),
    deportes,
    canchas_cantidad: Number.isInteger(canchas) && canchas >= 1 && canchas <= 200 ? canchas : null,
  };
}

export type ResultadoFila =
  | { tipo: "nuevo"; fila: FilaImportada }
  | { tipo: "sin_telefono"; fila: FilaImportada }
  | { tipo: "ya_estaba"; fila: FilaImportada; con: string; estado: string | null }
  | { tipo: "rechazado"; nombre: string; motivo: string };

export type Clasificacion = { resultados: ResultadoFila[]; ignoradas: string[]; faltaNombre: boolean };

/**
 * Clasifica toda la planilla contra la base: deduplica por place_id, por WhatsApp o por nombre + ciudad
 * (también dentro de la misma planilla). Los sin teléfono válido se cargan igual (para Instagram o llamada).
 */
export function clasificarPlanilla(tabla: unknown[][], existentes: Existente[]): Clasificacion {
  const [encabezados = [], ...filas] = tabla;
  const { indices, ignoradas } = reconocerColumnas(encabezados);
  if (indices.nombre === undefined) return { resultados: [], ignoradas, faltaNombre: true };

  const convertidas = filas.slice(0, MAX_FILAS_IMPORTAR).map((f) => convertirFila(Array.isArray(f) ? f : [], indices)).filter((f) => f !== null);
  const validas = convertidas.filter((f): f is FilaImportada => !("rechazo" in f));
  const duplicados = buscarDuplicados(validas, existentes);

  const resultados: ResultadoFila[] = convertidas.map((f) => {
    if ("rechazo" in f) return { tipo: "rechazado", nombre: f.nombre, motivo: f.rechazo };
    const d = duplicados[validas.indexOf(f)];
    if (d) {
      const con = d.existente ? d.existente.nombre : `${validas[d.enLista!]!.nombre} (repetido en la planilla)`;
      return { tipo: "ya_estaba", fila: f, con, estado: d.existente?.estado ?? null };
    }
    return f.telefono_wa ? { tipo: "nuevo", fila: f } : { tipo: "sin_telefono", fila: f };
  });
  return { resultados, ignoradas, faltaNombre: false };
}

/** «38 nuevos, 12 ya estaban, 3 sin teléfono». */
export function resumenImportacion(resultados: ResultadoFila[]): string {
  const n = (t: ResultadoFila["tipo"]) => resultados.filter((r) => r.tipo === t).length;
  const partes = [`${n("nuevo")} nuevos`, `${n("ya_estaba")} ya estaban`, `${n("sin_telefono")} sin teléfono`];
  if (n("rechazado")) partes.push(`${n("rechazado")} rechazados (no son de canchas)`);
  return partes.join(", ");
}
