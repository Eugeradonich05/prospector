/** Resultado estándar de una Server Action que se muestra en un formulario. */
export interface EstadoAccion {
  ok?: string;
  error?: string;
  /** Cambia en cada respuesta para que el formulario pueda reaccionar (limpiar, cerrar). */
  marca?: number;
}

export const ESTADO_INICIAL: EstadoAccion = {};

export function exito(mensaje: string): EstadoAccion {
  return { ok: mensaje, marca: Date.now() };
}

export function fallo(mensaje: string): EstadoAccion {
  return { error: mensaje, marca: Date.now() };
}

/** Traduce errores de Postgres/Supabase a mensajes para el usuario. */
export function mensajeDeError(e: { message?: string; code?: string; hint?: string } | null | undefined, porDefecto = "No se pudo guardar. Probá de nuevo."): string {
  if (!e) return porDefecto;
  // Errores propios lanzados desde funciones SQL (raise exception) ya vienen en castellano.
  if (e.code === "P0001" || e.code === "42501" || e.code === "23505") {
    if (e.message?.includes("duplicate key") && e.message.includes("socio_id_periodo")) return "Ese socio ya tiene la cuota de ese mes.";
    return e.message ?? porDefecto;
  }
  if (e.code === "23503") return "Hay datos relacionados que impiden esta operación.";
  if (e.code === "23514") return "Algún dato no cumple las reglas (revisá montos y fechas).";
  return porDefecto;
}
