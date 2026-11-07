import "server-only";
import { db } from "@/lib/datos/supabase";

/**
 * Revisa que la base esté lista antes de mostrar el panel: clave correcta y las dos migraciones aplicadas.
 * Devuelve qué falta, en castellano, o null si está todo bien.
 */
export async function problemaDeBase(): Promise<string | null> {
  try {
    const { error } = await db().from("prospectos").select("id, place_id, deportes", { head: true, count: "exact" });
    if (error) return explicar(error.message, "20261014000001_prospector.sql y 20261107000001_modo_cancha.sql");
    const { error: e2 } = await db().from("busquedas").select("id", { head: true, count: "exact" });
    if (e2) return explicar(e2.message, "20261107000001_modo_cancha.sql");
    return null;
  } catch (e) {
    return `No pude conectarme a Supabase: ${e instanceof Error ? e.message : "error desconocido"}. Revisá SUPABASE_URL en Vercel.`;
  }
}

function explicar(mensaje: string, migraciones: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("api key") || m.includes("jwt") || m.includes("unauthorized") || m.includes("invalid")) {
    return `Supabase rechazó la clave (${mensaje}). Revisá que SUPABASE_SECRET_KEY sea la secret key (sb_secret_…) del mismo proyecto que SUPABASE_URL, y hacé Redeploy.`;
  }
  if (m.includes("permission denied")) {
    return `La clave secreta no tiene permiso sobre las tablas (${mensaje}). Corré supabase/migrations/20261107000002_permisos.sql en el SQL Editor de Supabase y recargá.`;
  }
  if (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache")) {
    return `A la base le faltan tablas o columnas (${mensaje}). Corré en el SQL Editor de Supabase, en orden: ${migraciones}. Después, supabase/seed-canchas.sql.`;
  }
  return `No pude leer la base: ${mensaje}`;
}
