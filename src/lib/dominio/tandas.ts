import type { Prospecto } from "./tipos";

/**
 * Arma la tanda del día: los mejores prospectos sin contactar, repartidos entre ciudades
 * para no escribirle a 15 estudios del mismo barrio el mismo día.
 */
export function elegirTanda(
  candidatos: Pick<Prospecto, "id" | "estado" | "prioridad" | "telefono_wa" | "ciudad" | "resenas">[],
  opciones: { limite: number; maxPorCiudad: number },
): string[] {
  const orden = { A: 0, B: 1, C: 2 } as const;
  const disponibles = candidatos
    .filter((p) => p.estado === "sin_contactar" && p.telefono_wa)
    .sort((a, b) => orden[a.prioridad] - orden[b.prioridad] || (b.resenas ?? 0) - (a.resenas ?? 0));

  const porCiudad = new Map<string, number>();
  const elegidos: string[] = [];
  for (const p of disponibles) {
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
export function mensajeSeguimiento(nombre: string): string {
  return `Hola de nuevo! Te escribo una sola vez más por lo de las cuotas de ${nombre}. Si no es buen momento, ningún problema y no te molesto más. ¡Éxitos!`;
}
