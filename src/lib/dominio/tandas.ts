import { LINEAS, lineaDeRubro, type Linea } from "./lineas";
import type { Prospecto } from "./tipos";

/**
 * Arma la tanda del día: los mejores prospectos sin contactar, repartidos entre ciudades
 * (para no escribirle a 15 negocios del mismo barrio el mismo día) y entre líneas de servicio
 * (para que cada día salgan mensajes de varios rubros y se vea qué funciona mejor).
 * Los complejos de canchas no entran nunca: van por Modo Cancha.
 */
export function elegirTanda(
  candidatos: (Pick<Prospecto, "id" | "estado" | "prioridad" | "telefono_wa" | "ciudad" | "resenas"> & { rubro?: string | null })[],
  opciones: { limite: number; maxPorCiudad: number; maxPorLinea?: number; lineas?: Linea[] },
): string[] {
  const orden = { A: 0, B: 1, C: 2 } as const;
  const permitidas = opciones.lineas?.length ? new Set(opciones.lineas) : null;
  const disponibles = candidatos
    .map((p) => ({ p, linea: lineaDeRubro(p.rubro) }))
    .filter(({ p, linea }) => p.estado === "sin_contactar" && p.telefono_wa && linea !== null && (!permitidas || permitidas.has(linea)))
    .sort((a, b) => orden[a.p.prioridad] - orden[b.p.prioridad] || (b.p.resenas ?? 0) - (a.p.resenas ?? 0));

  const maxPorLinea = opciones.maxPorLinea ?? opciones.limite;
  const porCiudad = new Map<string, number>();
  const porLinea = new Map<Linea, number>();
  const elegidos: string[] = [];
  for (const { p, linea } of disponibles) {
    if (elegidos.length >= opciones.limite) break;
    const c = p.ciudad ?? "?";
    if ((porCiudad.get(c) ?? 0) >= opciones.maxPorCiudad) continue;
    if ((porLinea.get(linea!) ?? 0) >= maxPorLinea) continue;
    porCiudad.set(c, (porCiudad.get(c) ?? 0) + 1);
    porLinea.set(linea!, (porLinea.get(linea!) ?? 0) + 1);
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
  return LINEAS[lineaDeRubro(rubro) ?? "a_medida"].seguimiento(nombre);
}
