import "server-only";
import { db } from "@/lib/datos/supabase";

/**
 * Revisa que la base esté lista antes de mostrar el panel: clave correcta y las dos migraciones aplicadas.
 * Devuelve qué falta, en castellano, o null si está todo bien.
 */
export async function problemaDeBase(): Promise<string | null> {
  try {
    // Sin «head»: con head Supabase no manda el cuerpo y el error llega sin mensaje.
    const r1 = await db().from("prospectos").select("id, place_id, deportes").limit(1);
    if (r1.error) return explicar(detalle(r1.error, r1.status), "20261014000001_prospector.sql y 20261107000001_modo_cancha.sql");
    const r2 = await db().from("busquedas").select("id").limit(1);
    if (r2.error) return explicar(detalle(r2.error, r2.status), "20261107000001_modo_cancha.sql");
    return null;
  } catch (e) {
    return `No pude conectarme a Supabase: ${e instanceof Error ? e.message : "error desconocido"}. Revisá SUPABASE_URL en Vercel.`;
  }
}

type ErrorSupabase = { message?: string; code?: string; details?: string | null; hint?: string | null };

/** Todo lo que trae el error, para que se vea en pantalla qué pasó. */
function detalle(e: ErrorSupabase, status: number): string {
  const partes = [e.message, e.code && `código ${e.code}`, e.details, e.hint, `HTTP ${status}`].filter(Boolean);
  return partes.join(" · ");
}

function explicar(mensaje: string, migraciones: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("api key") || m.includes("jwt") || m.includes("unauthorized") || m.includes("http 401")) {
    return `Supabase rechazó la clave (${mensaje}). Revisá que SUPABASE_SECRET_KEY sea la secret key (sb_secret_…) del mismo proyecto que SUPABASE_URL, y hacé Redeploy.`;
  }
  if (m.includes("invalid schema") || m.includes("pgrst106")) {
    return `Supabase no expone el esquema public por la API (${mensaje}). En Supabase: Project Settings → Data API → «Exposed schemas», agregá public y guardá.`;
  }
  if (m.includes("permission denied") || m.includes("42501")) {
    return `La clave secreta no tiene permiso sobre las tablas (${mensaje}). Corré supabase/migrations/20261107000002_permisos.sql en el SQL Editor de Supabase y recargá.`;
  }
  if (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("pgrst205") || m.includes("42p01")) {
    return `A la base le faltan tablas o columnas (${mensaje}). Corré en el SQL Editor de Supabase, en orden: ${migraciones}. Después, supabase/seed-canchas.sql.`;
  }
  return `No pude leer la base: ${mensaje}`;
}
