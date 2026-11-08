import { normalizarTexto, type SistemaActual } from "./complejos";
import type { EstadoProspecto, Prospecto } from "./tipos";

/** Filtros, orden y paginación de la pantalla Complejos. Se hace en memoria: la base es de unos pocos miles. */
export type FilaComplejo = Pick<
  Prospecto,
  "id" | "nombre" | "rubro" | "ciudad" | "provincia" | "prioridad" | "estado" | "resenas" | "deportes" | "sistema_actual" | "telefono_wa" | "ultimo_entrante_el" | "contactado_el"
>;

export type FiltrosComplejos = {
  provincia: string | null;
  ciudad: string | null;
  deporte: string | null;
  sistema: SistemaActual | "desconocido" | null;
  q: string;
};

/** Filtra sin mirar el estado: el estado va en pestañas, que muestran cuántos hay en cada uno. */
export function filtrarComplejos(filas: FilaComplejo[], f: FiltrosComplejos): FilaComplejo[] {
  const buscado = normalizarTexto(f.q);
  return filas.filter(
    (p) =>
      (!f.provincia || p.provincia === f.provincia) &&
      (!f.ciudad || p.ciudad === f.ciudad) &&
      (!f.deporte || p.deportes?.includes(f.deporte)) &&
      (!f.sistema || (f.sistema === "desconocido" ? p.sistema_actual === null : p.sistema_actual === f.sistema)) &&
      // Sin tildes ni mayúsculas: «padel» encuentra «Pádel».
      (!buscado || normalizarTexto(p.nombre).includes(buscado)),
  );
}

export function contarPorEstado(filas: Pick<FilaComplejo, "estado">[]): Partial<Record<EstadoProspecto, number>> {
  const conteo: Partial<Record<EstadoProspecto, number>> = {};
  for (const p of filas) conteo[p.estado] = (conteo[p.estado] ?? 0) + 1;
  return conteo;
}

export const ORDENES = { prioridad: "Prioridad", resenas: "Más reseñas", nombre: "Nombre", ciudad: "Ciudad", reciente: "Respuesta más reciente" } as const;
export type Orden = keyof typeof ORDENES;

const compararTexto = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "", "es");

export function ordenarComplejos(filas: FilaComplejo[], orden: Orden): FilaComplejo[] {
  const comparar: Record<Orden, (a: FilaComplejo, b: FilaComplejo) => number> = {
    prioridad: (a, b) => a.prioridad.localeCompare(b.prioridad) || (b.resenas ?? 0) - (a.resenas ?? 0),
    resenas: (a, b) => (b.resenas ?? 0) - (a.resenas ?? 0),
    nombre: (a, b) => compararTexto(a.nombre, b.nombre),
    ciudad: (a, b) => compararTexto(a.ciudad, b.ciudad) || compararTexto(a.nombre, b.nombre),
    reciente: (a, b) => (b.ultimo_entrante_el ?? "").localeCompare(a.ultimo_entrante_el ?? ""),
  };
  return [...filas].sort(comparar[orden]);
}

export type Pagina<T> = { items: T[]; pagina: number; paginas: number; total: number };

export function paginar<T>(lista: T[], pagina: number, porPagina: number): Pagina<T> {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const actual = Math.min(Math.max(1, Number.isInteger(pagina) ? pagina : 1), paginas);
  return { items: lista.slice((actual - 1) * porPagina, actual * porPagina), pagina: actual, paginas, total: lista.length };
}
