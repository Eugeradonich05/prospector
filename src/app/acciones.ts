"use server";

import { exigirSesion } from "@/lib/sesion-servidor";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/datos/supabase";
import { COOKIE_SESION, crearSesion, claveCorrecta } from "@/lib/sesion";
import { exito, fallo, type EstadoAccion } from "@/lib/acciones";
import { TODA_LA_BASE, zonaDesdeTexto } from "@/lib/dominio/tandas";
import { hoyAR } from "@/lib/dominio/fechas";
import { ventanaAbierta } from "@/lib/dominio/ventana";
import { deportesDesdeTexto, placeIdDeMapsUrl } from "@/lib/dominio/complejos";
import { leerTodo } from "@/lib/datos/leer-todo";
import { redactarPrimerMensaje } from "@/lib/bot/claude";
import { COLUMNAS_MENSAJE, armarTandaDeHoy, type ParaMensaje } from "@/lib/tanda-servidor";
import { canalWhatsApp } from "@/lib/whatsapp/enviar";
import type { EstadoProspecto, Prospecto } from "@/lib/dominio/tipos";
import complejosCanchas from "@/lib/datos/complejos-canchas.json";

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

export async function armarTanda(_: EstadoAccion, datos?: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  return armarTandaDeHoy({ zona: zonaDesdeTexto(datos?.get("zona")) });
}

/**
 * Cambia la tanda por otra: los que todavía no mandaste vuelven a la lista (sin mensaje) y se eligen
 * otros complejos con mensajes nuevos. Los que ya mandaste hoy siguen contando para el límite diario.
 */
export async function nuevaTanda(_: EstadoAccion, datos?: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const { data, error } = await db().from("prospectos").select("id").eq("estado", "en_tanda");
  if (error) return fallo("No pude leer la tanda. Probá de nuevo.");
  const devueltos = (data ?? []).map((p) => p.id as string);
  if (devueltos.length) {
    await db().from("prospectos").update({ estado: "sin_contactar", tanda_fecha: null, mensaje_inicial: null }).in("id", devueltos).eq("estado", "en_tanda");
  }
  return armarTandaDeHoy({ evitar: devueltos, zona: zonaDesdeTexto(datos?.get("zona")) });
}

/**
 * Carga en la base los complejos de supabase/seed-canchas.sql desde el panel.
 * Saltea los que ya están (mismo WhatsApp o mismo nombre y dirección).
 */
export async function cargarComplejos(_: EstadoAccion): Promise<EstadoAccion> {
  await exigirSesion();
  let existentes: Pick<Prospecto, "telefono_wa" | "nombre" | "direccion" | "place_id">[];
  try {
    existentes = await leerTodo((desde, hasta) => db().from("prospectos").select("telefono_wa, nombre, direccion, place_id").order("id").range(desde, hasta));
  } catch {
    return fallo("No pude leer la base. Probá de nuevo.");
  }
  const telefonos = new Set(existentes.map((p) => p.telefono_wa).filter(Boolean));
  const lugares = new Set(existentes.map((p) => `${p.nombre}|${p.direccion}`));
  const places = new Set(existentes.map((p) => p.place_id).filter(Boolean));
  const nuevos = complejosCanchas
    .map((c) => ({ ...c, place_id: placeIdDeMapsUrl(c.maps_url), deportes: deportesDesdeTexto(c.nombre, c.rubro), origen: "seed" as const }))
    .filter((c) => !telefonos.has(c.telefono_wa) && !lugares.has(`${c.nombre}|${c.direccion}`) && !(c.place_id && places.has(c.place_id)));
  if (!nuevos.length) return exito("Los complejos ya estaban cargados.");
  for (let i = 0; i < nuevos.length; i += 100) {
    const { error: e } = await db().from("prospectos").insert(nuevos.slice(i, i + 100) as never);
    if (e) return fallo(`Cargué ${i} y después falló: ${e.message}`);
  }
  revalidatePath("/", "layout");
  return exito(`Listo: cargué ${nuevos.length} complejos.`);
}

export async function guardarMensajeInicial(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  const texto = z.string().trim().min(20, "El mensaje es muy corto.").max(1000).safeParse(datos.get("mensaje"));
  if (!id.success) return fallo("Complejo inválido.");
  if (!texto.success) return fallo(texto.error.issues[0]!.message);
  await db().from("prospectos").update({ mensaje_inicial: texto.data }).eq("id", id.data);
  revalidatePath("/", "layout");
  return exito("Mensaje guardado.");
}

/** Para cuando el envío no se detecta solo (sin coexistencia, o desde otro teléfono). */
export async function marcarEnviado(datos: FormData) {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  const tipo = datos.get("tipo") === "seguimiento" ? "seguimiento" : "primero";
  if (!id.success) return;
  const ahora = new Date().toISOString();
  if (tipo === "seguimiento") await db().from("prospectos").update({ seguimiento_el: ahora }).eq("id", id.data);
  else await db().from("prospectos").update({ estado: "contactado", contactado_el: ahora }).eq("id", id.data).in("estado", ["en_tanda", "sin_contactar"]);
  revalidatePath("/", "layout");
}

/**
 * Vuelve a redactar los mensajes de la tanda que todavía no se mandaron, con las reglas actuales
 * (por ejemplo, después de cambiar el conocimiento del bot). Si viene un id, solo ese.
 */
export async function rehacerMensajes(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const id = datos.get("id") ? uuid.safeParse(datos.get("id")) : null;
  if (id && !id.success) return fallo("Prospecto inválido.");
  let consulta = db().from("prospectos").select(COLUMNAS_MENSAJE).eq("estado", "en_tanda");
  if (id?.success) consulta = consulta.eq("id", id.data);
  const { data, error } = await consulta;
  if (error) return fallo("No pude leer la tanda. Probá de nuevo.");
  const lista = (data ?? []) as ParaMensaje[];
  if (!lista.length) return fallo("No hay mensajes pendientes para rehacer.");
  for (let i = 0; i < lista.length; i += 3) {
    await Promise.all(
      lista.slice(i, i + 3).map(async (p) => {
        const mensaje = await redactarPrimerMensaje(p);
        await db().from("prospectos").update({ mensaje_inicial: mensaje }).eq("id", p.id).eq("estado", "en_tanda");
      }),
    );
  }
  revalidatePath("/", "layout");
  return exito(lista.length === 1 ? "Mensaje rehecho." : `Rehice ${lista.length} mensajes.`);
}

/**
 * El número no tiene WhatsApp (lo avisa la app al tocar «Abrir WhatsApp»): sale de la tanda,
 * no vuelve a elegirse y se suma otro complejo de la misma provincia en su lugar.
 */
export async function sinWhatsApp(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return fallo("Complejo inválido.");
  const { data: p } = await db().from("prospectos").select("notas, provincia").eq("id", id.data).single();
  const nota = `Sin WhatsApp (${hoyAR()})`;
  await db()
    .from("prospectos")
    .update({ telefono_wa: null, estado: "sin_contactar", tanda_fecha: null, mensaje_inicial: null, notas: p?.notas ? `${p.notas}\n${nota}` : nota })
    .eq("id", id.data)
    .eq("estado", "en_tanda");
  const provincia = (p?.provincia as string | null) ?? null;
  const r = await armarTandaDeHoy({ evitar: [id.data], zona: provincia ? { tipo: "provincia", provincia } : TODA_LA_BASE });
  revalidatePath("/", "layout");
  return r.ok ? exito("Listo, lo saqué y sumé otro en su lugar.") : exito("Listo, lo saqué de la lista.");
}

/**
 * El complejo no tiene WhatsApp y se lo contactó por otro medio (llamada, Instagram, mail): queda como
 * contactado, con nota, y sin seguimiento por WhatsApp. Las respuestas se anotan a mano en Complejos.
 */
export async function contactadoPorOtroMedio(datos: FormData) {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  const medio = z.enum(["llamada", "instagram", "email"]).safeParse(datos.get("medio"));
  if (!id.success || !medio.success) return;
  const nombres = { llamada: "por teléfono", instagram: "por Instagram", email: "por mail" } as const;
  const { data: p } = await db().from("prospectos").select("notas").eq("id", id.data).single();
  const nota = `Contactado ${nombres[medio.data]} (${hoyAR()}), no por WhatsApp`;
  const ahora = new Date().toISOString();
  await db()
    .from("prospectos")
    .update({ estado: "contactado", contactado_el: ahora, seguimiento_el: ahora, notas: p?.notas ? `${p.notas}\n${nota}` : nota })
    .eq("id", id.data)
    .in("estado", ["en_tanda", "sin_contactar"]);
  revalidatePath("/", "layout");
}

export async function sacarDeTanda(datos: FormData) {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  const nuevo = datos.get("no_contactar") === "1" ? "no_contactar" : "sin_contactar";
  await db().from("prospectos").update({ estado: nuevo, tanda_fecha: nuevo === "sin_contactar" ? null : hoyAR() }).eq("id", id.data).eq("estado", "en_tanda");
  revalidatePath("/", "layout");
}

// ── Conversaciones ─────────────────────────────────────

export async function responderManual(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  const texto = z.string().trim().min(1, "Escribí algo.").max(2000).safeParse(datos.get("texto"));
  if (!id.success) return fallo("Complejo inválido.");
  if (!texto.success) return fallo(texto.error.issues[0]!.message);

  const { data: p } = await db().from("prospectos").select("telefono_wa, ultimo_entrante_el").eq("id", id.data).single();
  if (!p?.telefono_wa) return fallo("Este complejo no tiene WhatsApp.");
  if (!ventanaAbierta(p.ultimo_entrante_el as string | null)) return fallo("Pasaron más de 24 horas desde su último mensaje: respondé desde la app del celular.");
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
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return fallo("Complejo inválido.");
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
  revalidatePath("/", "layout");
  return exito("Guardado.");
}

export async function devolverAlBot(datos: FormData) {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  await db().from("prospectos").update({ humano_hasta: null, necesita_humano: false, motivo_humano: null, bot_activo: true }).eq("id", id.data);
  revalidatePath(`/conversaciones/${id.data}`);
}
