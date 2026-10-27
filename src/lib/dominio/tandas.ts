import { LINEAS, LINEAS_CAUCE, lineaDeRubro, type Linea } from "./lineas";
import { chanceWhatsApp } from "./telefono";
import type { Prospecto } from "./tipos";

/**
 * Arma la tanda del día: los mejores prospectos sin contactar, repartidos entre ciudades
 * (para no escribirle a 15 negocios del mismo barrio el mismo día) y entre líneas de servicio
 * (para que cada día salgan mensajes de varios rubros y se vea qué funciona mejor).
 * Por defecto solo entran las líneas de Cauce; Modo Cancha se arma aparte con `lineas: ["canchas"]`.
 * `incluirFijos`: también elige números que parecen fijos (en ciudades medianas los celulares
 * también empiezan con 4, así que para canchas conviene probarlos y usar «No tiene WhatsApp»).
 */
export function elegirTanda(
  candidatos: (Pick<Prospecto, "id" | "estado" | "prioridad" | "telefono_wa" | "ciudad" | "resenas"> & { rubro?: string | null; telefono?: string | null })[],
  opciones: { limite: number; maxPorCiudad: number; maxPorLinea?: number; lineas?: Linea[]; incluirFijos?: boolean },
): string[] {
  const orden = { A: 0, B: 1, C: 2 } as const;
  const chance = { alta: 0, media: 1, baja: 2 } as const;
  const permitidas = new Set(opciones.lineas?.length ? opciones.lineas : LINEAS_CAUCE);
  const disponibles = candidatos
    .map((p) => ({ p, linea: lineaDeRubro(p.rubro), wa: p.telefono === undefined ? "media" : chanceWhatsApp(p.telefono, p.telefono_wa) }))
    // Los que casi seguro son fijos (sin WhatsApp) no entran salvo que se pida; primero van los que figuran como celular.
    .filter(({ p, linea, wa }) => p.estado === "sin_contactar" && p.telefono_wa && (opciones.incluirFijos || wa !== "baja") && permitidas.has(linea))
    .sort((a, b) => chance[a.wa] - chance[b.wa] || orden[a.p.prioridad] - orden[b.p.prioridad] || (b.p.resenas ?? 0) - (a.p.resenas ?? 0));

  const maxPorLinea = opciones.maxPorLinea ?? opciones.limite;
  const porCiudad = new Map<string, number>();
  const porLinea = new Map<Linea, number>();
  const elegidos: string[] = [];
  for (const { p, linea } of disponibles) {
    if (elegidos.length >= opciones.limite) break;
    const c = p.ciudad ?? "?";
    if ((porCiudad.get(c) ?? 0) >= opciones.maxPorCiudad) continue;
    if ((porLinea.get(linea) ?? 0) >= maxPorLinea) continue;
    porCiudad.set(c, (porCiudad.get(c) ?? 0) + 1);
    porLinea.set(linea!, (porLinea.get(linea) ?? 0) + 1);
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

/** Mensaje de seguimiento: corto, una sola vez y con salida fácil. Habla de lo que se le ofreció a ese rubro. */
export function mensajeSeguimiento(nombre: string, rubro: string | null = null): string {
  return LINEAS[lineaDeRubro(rubro)].seguimiento(nombre);
}
