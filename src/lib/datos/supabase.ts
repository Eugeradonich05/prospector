import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Almacen } from "./almacen";
import type { Database, Mensaje, Prospecto } from "@/lib/dominio/tipos";

/** Cliente con la clave secreta. Esta app es de un solo dueño y corre solo en el servidor. */
let cliente: ReturnType<typeof createClient<Database>> | null = null;
export function db() {
  cliente ??= createClient<Database>(env().SUPABASE_URL, env().SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

export const almacenSupabase: Almacen = {
  async porTelefono(t) {
    const { data } = await db().from("prospectos").select("*").eq("telefono_wa", t).maybeSingle();
    return (data as Prospecto | null) ?? null;
  },
  async registrarMensaje(m) {
    const { error } = await db().from("mensajes").insert(m);
    if (error?.code === "23505") return false; // wa_id repetido: ya se procesó
    if (error) throw new Error(error.message);
    return true;
  },
  async historial(id, limite) {
    const { data } = await db().from("mensajes").select("*").eq("prospecto_id", id).order("creado", { ascending: false }).limit(limite);
    return ((data as Mensaje[] | null) ?? []).reverse();
  },
  async contarRespuestasBot(id) {
    const { count } = await db().from("mensajes").select("id", { count: "exact", head: true }).eq("prospecto_id", id).eq("direccion", "bot");
    return count ?? 0;
  },
  async actualizar(id, cambios) {
    const { error } = await db().from("prospectos").update(cambios).eq("id", id);
    if (error) throw new Error(error.message);
  },
};
