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
import { LINEAS_CAUCE, lineaDeRubro } from "@/lib/dominio/lineas";
import { hoyAR } from "@/lib/dominio/fechas";
import { redactarPrimerMensaje } from "@/lib/bot/claude";
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

/** Las tandas van por separado: la de Cauce (Hoy) y la de Modo Cancha (su pestaña). */
type Grupo = "cauce" | "canchas";
const grupoDe = (rubro: string | null | undefined): Grupo => (lineaDeRubro(rubro) === "canchas" ? "canchas" : "cauce");
const leerGrupo = (datos?: FormData): Grupo => (datos?.get("grupo") === "canchas" ? "canchas" : "cauce");

export async function armarTanda(_: EstadoAccion, datos?: FormData): Promise<EstadoAccion> {
  return armar([], leerGrupo(datos));
}

/**
 * Cambia la tanda por otra: los que todavía no mandaste vuelven a la lista (sin mensaje) y se eligen
 * otros prospectos con mensajes nuevos. Los que ya mandaste hoy siguen contando para el límite diario.
 * Solo toca la tanda del mismo grupo (Cauce o Modo Cancha).
 */
export async function nuevaTanda(_: EstadoAccion, datos?: FormData): Promise<EstadoAccion> {
  const grupo = leerGrupo(datos);
  const { data } = await db().from("prospectos").select("id, rubro").eq("estado", "en_tanda");
  const devueltos = (data ?? []).filter((p) => grupoDe(p.rubro as string | null) === grupo).map((p) => p.id as string);
  if (devueltos.length) {
    await db().from("prospectos").update({ estado: "sin_contactar", tanda_fecha: null, mensaje_inicial: null }).in("id", devueltos).eq("estado", "en_tanda");
  }
  return armar(devueltos, grupo);
}

async function armar(evitar: string[], grupo: Grupo): Promise<EstadoAccion> {
  const hoy = hoyAR();
  const { data: deHoy } = await db().from("prospectos").select("rubro").eq("tanda_fecha", hoy);
  const yaHoy = (deHoy ?? []).filter((p) => grupoDe(p.rubro as string | null) === grupo).length;
  const tope = grupo === "canchas" ? env().TANDA_LIMITE_CANCHAS : env().TANDA_LIMITE;
  const limite = tope - yaHoy;
  if (limite <= 0) return fallo(`Ya armaste la tanda de hoy${grupo === "canchas" ? " de Modo Cancha" : ""} (${tope}). Mañana sigue.`);

  const { data } = await db().from("prospectos").select("id, estado, prioridad, telefono, telefono_wa, ciudad, resenas, rubro").eq("estado", "sin_contactar");
  // Modo Cancha también prueba números que parecen fijos: en ciudades medianas los celulares empiezan con 4.
  const opciones =
    grupo === "canchas"
      ? { limite, maxPorCiudad: env().TANDA_MAX_POR_CIUDAD, lineas: ["canchas" as const], incluirFijos: true }
      : { limite, maxPorCiudad: env().TANDA_MAX_POR_CIUDAD, maxPorLinea: env().TANDA_MAX_POR_LINEA, lineas: LINEAS_CAUCE };
  const todos = (data ?? []) as Prospecto[];
  const fuera = new Set(evitar);
  let ids = elegirTanda(todos.filter((p) => !fuera.has(p.id)), opciones);
  // Si no alcanza con prospectos nuevos, se completa con los que se devolvieron.
  if (ids.length < limite && fuera.size) {
    const elegidos = new Set(ids);
    ids = [...ids, ...elegirTanda(todos.filter((p) => fuera.has(p.id) && !elegidos.has(p.id)), { ...opciones, limite: limite - ids.length })];
  }
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
  revalidatePath("/", "layout");
  return exito(`Tanda lista: ${lista.length} prospectos con su mensaje.`);
}

/**
 * Carga en la base los complejos de canchas de Modo Cancha (lo mismo que supabase/seed-canchas.sql),
 * para poder hacerlo desde el panel. Saltea los que ya están (mismo WhatsApp o mismo nombre y dirección).
 */
export async function cargarComplejos(_: EstadoAccion): Promise<EstadoAccion> {
  const { data, error } = await db().from("prospectos").select("telefono_wa, nombre, direccion").limit(10000);
  if (error) return fallo("No pude leer la base. Probá de nuevo.");
  const telefonos = new Set((data ?? []).map((p) => p.telefono_wa).filter(Boolean));
  const lugares = new Set((data ?? []).map((p) => `${p.nombre}|${p.direccion}`));
  const nuevos = complejosCanchas.filter((c) => !telefonos.has(c.telefono_wa) && !lugares.has(`${c.nombre}|${c.direccion}`));
  if (!nuevos.length) return exito("Los complejos ya estaban cargados.");
  for (let i = 0; i < nuevos.length; i += 100) {
    const { error: e } = await db().from("prospectos").insert(nuevos.slice(i, i + 100) as never);
    if (e) return fallo(`Cargué ${i} y después falló: ${e.message}`);
  }
  revalidatePath("/", "layout");
  return exito(`Listo: cargué ${nuevos.length} complejos.`);
}

export async function guardarMensajeInicial(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = uuid.safeParse(datos.get("id"));
  const texto = z.string().trim().min(20, "El mensaje es muy corto.").max(1000).safeParse(datos.get("mensaje"));
  if (!id.success) return fallo("Prospecto inválido.");
  if (!texto.success) return fallo(texto.error.issues[0]!.message);
  await db().from("prospectos").update({ mensaje_inicial: texto.data }).eq("id", id.data);
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
}

/**
 * Vuelve a redactar los mensajes de la tanda que todavía no se mandaron, con las reglas actuales
 * (por ejemplo, después de cambiar cómo se presenta Cauce). Si viene un id, solo ese.
 */
export async function rehacerMensajes(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = datos.get("id") ? uuid.safeParse(datos.get("id")) : null;
  if (id && !id.success) return fallo("Prospecto inválido.");
  let consulta = db().from("prospectos").select("id, nombre, rubro, ciudad").eq("estado", "en_tanda");
  if (id?.success) consulta = consulta.eq("id", id.data);
  const { data } = await consulta;
  const grupo = leerGrupo(datos);
  const lista = ((data ?? []) as Pick<Prospecto, "id" | "nombre" | "rubro" | "ciudad">[]).filter((p) => id?.success || grupoDe(p.rubro) === grupo);
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
 * no vuelve a elegirse y se suma otro prospecto en su lugar.
 */
export async function sinWhatsApp(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return fallo("Prospecto inválido.");
  const { data: p } = await db().from("prospectos").select("notas, rubro").eq("id", id.data).single();
  const nota = `Sin WhatsApp (${hoyAR()})`;
  await db()
    .from("prospectos")
    .update({ telefono_wa: null, estado: "sin_contactar", tanda_fecha: null, mensaje_inicial: null, notas: p?.notas ? `${p.notas}\n${nota}` : nota })
    .eq("id", id.data)
    .eq("estado", "en_tanda");
  const r = await armar([id.data], grupoDe(p?.rubro as string | null));
  revalidatePath("/", "layout");
  return r.ok ? exito("Listo, lo saqué y sumé otro en su lugar.") : exito("Listo, lo saqué de la lista.");
}

export async function sacarDeTanda(datos: FormData) {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  const nuevo = datos.get("no_contactar") === "1" ? "no_contactar" : "sin_contactar";
  await db().from("prospectos").update({ estado: nuevo, tanda_fecha: nuevo === "sin_contactar" ? null : hoyAR() }).eq("id", id.data).eq("estado", "en_tanda");
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  return exito("Guardado.");
}

export async function devolverAlBot(datos: FormData) {
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return;
  await db().from("prospectos").update({ humano_hasta: null, necesita_humano: false, motivo_humano: null, bot_activo: true }).eq("id", id.data);
  revalidatePath(`/conversaciones/${id.data}`);
}
