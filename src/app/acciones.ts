"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/datos/supabase";
import { COOKIE_SESION, crearSesion, claveCorrecta } from "@/lib/sesion";
import { exito, fallo, type EstadoAccion } from "@/lib/acciones";
import { elegirTanda } from "@/lib/dominio/tandas";
import { hoyAR } from "@/lib/dominio/fechas";
import { redactarPrimerMensaje } from "@/lib/bot/claude";
import { canalWhatsApp } from "@/lib/whatsapp/enviar";
import type { EstadoProspecto, Prospecto } from "@/lib/dominio/tipos";

const uuid = z.string().uuid();

// ── Sesión ─────────────────────────────────────────────

export async function ingresar(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const clave = String(datos.get("clave") ?? "");
  if (!claveCorrecta(clave, env().ADMIN_CLAVE)) return fallo("Clave incorrecta.");
  (await cookies()).set(COOKIE_SESION, crearSesion(env().SESION_SECRETO), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/ingresar");
}

// ── Tandas ─────────────────────────────────────────────

export async function armarTanda(_: EstadoAccion): Promise<EstadoAccion> {
  const hoy = hoyAR();
  const { count: yaHoy } = await db().from("prospectos").select("id", { count: "exact", head: true }).eq("tanda_fecha", hoy);
  const limite = env().TANDA_LIMITE - (yaHoy ?? 0);
  if (limite <= 0) return fallo(`Ya armaste la tanda de hoy (${env().TANDA_LIMITE}). Mañana sigue.`);

  const { data } = await db().from("prospectos").select("id, estado, prioridad, telefono_wa, ciudad, resenas").eq("estado", "sin_contactar");
  const ids = elegirTanda((data ?? []) as Prospecto[], { limite, maxPorCiudad: env().TANDA_MAX_POR_CIUDAD });
  if (!ids.length) return fallo("No quedan prospectos sin contactar con WhatsApp. Cargá más en la base.");

  const { data: elegidos } = await db().from("prospectos").select("id, nombre, rubro, ciudad").in("id", ids);
  // Un mensaje distinto para cada uno. Se redactan de a 3 para no tardar demasiado.
  const lista = (elegidos ?? []) as Pick<Prospecto, "id" | "nombre" | "rubro" | "ciudad">[];
  for (let i = 0; i < lista.length; i += 3) {
    await Promise.all(
      lista.slice(i, i + 3).map(async (p) => {
        const mensaje = await redactarPrimerMensaje(p);
        await db().from("prospectos").update({ estado: "en_tanda", tanda_fecha: hoy, mensaje_inicial: mensaje }).eq("id", p.id).eq("estado", "sin_contactar");
      }),
    );
  }
  revalidatePath("/");
  return exito(`Tanda lista: ${lista.length} prospectos con su mensaje.`);
}

export async function guardarMensajeInicial(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = uuid.safeParse(datos.get("id"));
  const texto = z.string().trim().min(20, "El mensaje es muy corto.").max(1000).safeParse(datos.get("mensaje"));
  if (!id.success) return fallo("Prospecto inválido.");
  if (!texto.success) return fallo(texto.error.issues[0]!.message);
  await db().from("prospectos").update({ mensaje_inicial: texto.data }).eq("id", id.data);
  revalidatePath("/");
  return exito("Mensaje guardado.");
}

/** Para cuando el envío no se detecta solo (sin coexistencia, o desde otro teléfono). */
export async function marcarEnviado(datos: FormData) {
  const id = uuid.safeParse(datos.get("id"));
  const tipo = datos.get("tipo") === "seguimiento" ? "seguimiento" : "primero";
  if (!id.success) return;
  const ahora = new Date().toISOString();
  if (tipo === "seguimiento") await db().from("prospectos").update({ seguimiento_el: ahora }).eq("id", id.data);
  else await db().from("prospectos").update({ estado: "contactado", contactado_el: ahora }).eq("id", id.data).in("estado", ["en_tanda", "sin_contactar"]);
  revalidatePath("/");
}

export async function sacarDeTanda(datos: FormData) {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  const nuevo = datos.get("no_contactar") === "1" ? "no_contactar" : "sin_contactar";
  await db().from("prospectos").update({ estado: nuevo, tanda_fecha: nuevo === "sin_contactar" ? null : hoyAR() }).eq("id", id.data).eq("estado", "en_tanda");
  revalidatePath("/");
}

// ── Conversaciones ─────────────────────────────────────

export async function responderManual(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = uuid.safeParse(datos.get("id"));
  const texto = z.string().trim().min(1, "Escribí algo.").max(2000).safeParse(datos.get("texto"));
  if (!id.success) return fallo("Prospecto inválido.");
  if (!texto.success) return fallo(texto.error.issues[0]!.message);

  const { data: p } = await db().from("prospectos").select("telefono_wa").eq("id", id.data).single();
  if (!p?.telefono_wa) return fallo("Este prospecto no tiene WhatsApp.");
  try {
    const { id: waId } = await canalWhatsApp().enviarTexto(p.telefono_wa as string, texto.data);
    await db().from("mensajes").insert({ prospecto_id: id.data, direccion: "humano", tipo: "text", texto: texto.data, wa_id: waId });
    await db()
      .from("prospectos")
      .update({ humano_hasta: new Date(Date.now() + 12 * 3_600_000).toISOString(), necesita_humano: false, motivo_humano: null })
      .eq("id", id.data);
  } catch (e) {
    return fallo(e instanceof Error ? e.message : "No se pudo enviar.");
  }
  revalidatePath(`/conversaciones/${id.data}`);
  return exito("Enviado. El bot queda en pausa 12 horas en esta conversación.");
}

export async function actualizarProspecto(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return fallo("Prospecto inválido.");
  const estados: EstadoProspecto[] = ["sin_contactar", "en_tanda", "contactado", "respondio", "interesado", "demo", "cliente", "descartado", "no_contactar"];
  const estado = z.enum(estados as [EstadoProspecto, ...EstadoProspecto[]]).safeParse(datos.get("estado"));
  if (!estado.success) return fallo("Estado inválido.");
  await db()
    .from("prospectos")
    .update({
      estado: estado.data,
      bot_activo: datos.get("bot_activo") === "on",
      notas: String(datos.get("notas") ?? "").slice(0, 2000) || null,
      ...(datos.get("resuelto") === "on" ? { necesita_humano: false, motivo_humano: null } : {}),
    })
    .eq("id", id.data);
  revalidatePath(`/conversaciones/${id.data}`);
  revalidatePath("/");
  return exito("Guardado.");
}

export async function devolverAlBot(datos: FormData) {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  await db().from("prospectos").update({ humano_hasta: null, necesita_humano: false, motivo_humano: null, bot_activo: true }).eq("id", id.data);
  revalidatePath(`/conversaciones/${id.data}`);
}
