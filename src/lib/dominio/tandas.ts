import { LINEAS, LINK_MODO_CANCHA, esRubroDeCanchas } from "./lineas";
import { chanceWhatsApp } from "./telefono";
import type { Prospecto } from "./tipos";

/** Zona de la tanda: toda la base, una provincia o una ciudad (de una provincia). */
export type Zona = { tipo: "todo" } | { tipo: "provincia"; provincia: string } | { tipo: "ciudad"; provincia: string | null; ciudad: string };

export const TODA_LA_BASE: Zona = { tipo: "todo" };

export type CandidatoTanda = Pick<Prospecto, "id" | "estado" | "prioridad" | "telefono_wa" | "ciudad" | "resenas"> & {
  rubro?: string | null;
  telefono?: string | null;
  provincia?: string | null;
};

export type OpcionesTanda = {
  limite: number;
  maxPorCiudad: number;
  zona?: Zona;
  /** También elige números que parecen fijos (en ciudades medianas los celulares también empiezan con 4). */
  incluirFijos?: boolean;
};

/** Zona → valor del selector: "todo", "p:Santa Fe" o "c:Buenos Aires|San Nicolás de los Arroyos". */
export function zonaATexto(zona: Zona): string {
  if (zona.tipo === "todo") return "todo";
  if (zona.tipo === "provincia") return `p:${zona.provincia}`;
  return `c:${zona.provincia ?? ""}|${zona.ciudad}`;
}

/** Lee el valor del selector de zona. Cualquier cosa rara vale como «Toda la base». */
export function zonaDesdeTexto(texto: unknown): Zona {
  if (typeof texto !== "string" || texto.length > 200) return TODA_LA_BASE;
  if (texto.startsWith("p:") && texto.length > 2) return { tipo: "provincia", provincia: texto.slice(2) };
  if (texto.startsWith("c:")) {
    const [provincia, ciudad] = texto.slice(2).split("|");
    if (ciudad) return { tipo: "ciudad", provincia: provincia || null, ciudad };
  }
  return TODA_LA_BASE;
}

export type OpcionesZona = {
  provincias: { provincia: string; cantidad: number }[];
  ciudades: { provincia: string | null; ciudad: string; cantidad: number }[];
};

/** Opciones del selector de zona, con cuántos complejos quedan por contactar en cada una (más primero). */
export function opcionesDeZona(filas: { provincia: string | null; ciudad: string | null }[]): OpcionesZona {
  const provincias = new Map<string, number>();
  const ciudades = new Map<string, { provincia: string | null; ciudad: string; cantidad: number }>();
  for (const f of filas) {
    if (f.provincia) provincias.set(f.provincia, (provincias.get(f.provincia) ?? 0) + 1);
    if (f.ciudad) {
      const clave = `${f.provincia ?? ""}|${f.ciudad}`;
      const previa = ciudades.get(clave);
      ciudades.set(clave, { provincia: f.provincia, ciudad: f.ciudad, cantidad: (previa?.cantidad ?? 0) + 1 });
    }
  }
  const porCantidad = <T extends { cantidad: number }>(a: T, b: T) => b.cantidad - a.cantidad;
  return {
    provincias: [...provincias].map(([provincia, cantidad]) => ({ provincia, cantidad })).sort((a, b) => porCantidad(a, b) || a.provincia.localeCompare(b.provincia, "es")),
    ciudades: [...ciudades.values()].sort((a, b) => porCantidad(a, b) || a.ciudad.localeCompare(b.ciudad, "es")),
  };
}

/** Texto para «Copiar lista»: nombre, teléfono y mensaje de cada uno, para mandarlos desde otro celular. */
export function textoListaTanda(lista: { nombre: string; telefono: string | null; telefono_wa: string | null; mensaje_inicial: string | null }[]): string {
  return lista
    .map((p) => [p.nombre, p.telefono_wa ? `+${p.telefono_wa}` : (p.telefono ?? "sin teléfono"), p.mensaje_inicial ?? ""].join("\n"))
    .join("\n\n---\n\n");
}

export function enZona(p: { provincia?: string | null; ciudad?: string | null }, zona: Zona = TODA_LA_BASE): boolean {
  if (zona.tipo === "todo") return true;
  if (zona.tipo === "provincia") return (p.provincia ?? null) === zona.provincia;
  return (p.ciudad ?? null) === zona.ciudad && (zona.provincia === null || (p.provincia ?? null) === zona.provincia);
}

/**
 * Arma la tanda del día: los mejores complejos sin contactar de la zona elegida, repartidos entre ciudades
 * (para no escribirle a 15 complejos del mismo barrio el mismo día).
 * Orden: primero los que figuran como celular, después prioridad (A, B, C) y después más reseñas.
 */
export function elegirTanda(candidatos: CandidatoTanda[], opciones: OpcionesTanda): string[] {
  const orden = { A: 0, B: 1, C: 2 } as const;
  const chance = { alta: 0, media: 1, baja: 2 } as const;
  const disponibles = candidatos
    .map((p) => ({ p, wa: p.telefono === undefined ? ("media" as const) : chanceWhatsApp(p.telefono, p.telefono_wa) }))
    .filter(
      ({ p, wa }) =>
        p.estado === "sin_contactar" &&
        p.telefono_wa &&
        (opciones.incluirFijos || wa !== "baja") &&
        (p.rubro === undefined || esRubroDeCanchas(p.rubro)) &&
        enZona(p, opciones.zona),
    )
    .sort((a, b) => chance[a.wa] - chance[b.wa] || orden[a.p.prioridad] - orden[b.p.prioridad] || (b.p.resenas ?? 0) - (a.p.resenas ?? 0));

  const porCiudad = new Map<string, number>();
  const elegidos: string[] = [];
  for (const { p } of disponibles) {
    if (elegidos.length >= opciones.limite) break;
    const c = p.ciudad ?? "?";
    if ((porCiudad.get(c) ?? 0) >= opciones.maxPorCiudad) continue;
    porCiudad.set(c, (porCiudad.get(c) ?? 0) + 1);
    elegidos.push(p.id);
  }
  return elegidos;
}

/**
 * Quiénes necesitan un único recordatorio: contactados hace `dias` o más, que nunca contestaron
 * y a los que todavía no se les mandó seguimiento.
 */
export function seguimientosPendientes(
  prospectos: Pick<Prospecto, "id" | "estado" | "contactado_el" | "seguimiento_el" | "ultimo_entrante_el">[],
  ahora: Date,
  dias = 3,
): string[] {
  const limite = ahora.getTime() - dias * 86_400_000;
  return prospectos
    .filter(
      (p) =>
        p.estado === "contactado" &&
        !p.seguimiento_el &&
        !p.ultimo_entrante_el &&
        p.contactado_el !== null &&
        new Date(p.contactado_el).getTime() <= limite,
    )
    .map((p) => p.id);
}

/** Mensaje de seguimiento: corto, una sola vez y con salida fácil. */
export function mensajeSeguimiento(nombre: string, linkPrueba: string = LINK_MODO_CANCHA): string {
  return LINEAS.canchas.seguimiento(nombre, linkPrueba);
}
