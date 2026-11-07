import "server-only";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { db } from "@/lib/datos/supabase";
import { leerTodo } from "@/lib/datos/leer-todo";
import { elegirTanda, TODA_LA_BASE, type CandidatoTanda, type Zona } from "@/lib/dominio/tandas";
import { hoyAR } from "@/lib/dominio/fechas";
import { redactarPrimerMensaje } from "@/lib/bot/claude";
import { exito, fallo, type EstadoAccion } from "@/lib/acciones";
import type { Prospecto } from "@/lib/dominio/tipos";

const COLUMNAS_CANDIDATO = "id, estado, prioridad, telefono, telefono_wa, ciudad, provincia, resenas, rubro";
const DE_A = 5; // mensajes que se redactan en paralelo
/** Lo que usa Claude para escribir el primer mensaje. */
export const COLUMNAS_MENSAJE = "id, nombre, rubro, ciudad, deportes, sistema_actual, canchas_cantidad";
export type ParaMensaje = Pick<Prospecto, "id" | "nombre" | "rubro" | "ciudad" | "deportes" | "sistema_actual" | "canchas_cantidad">;

export type PedidoTanda = {
  /** Ids que no se eligen primero (los que se acaban de devolver); completan si falta. */
  evitar?: string[];
  zona?: Zona;
  /** Si viene, la tanda se arma solo con estos complejos (por ejemplo, los recién encontrados). */
  soloIds?: string[];
};

/**
 * Arma la tanda de hoy respetando TANDA_LIMITE (menos lo ya armado hoy) y TANDA_MAX_POR_CIUDAD,
 * y le pide a Claude un mensaje distinto para cada complejo.
 */
export async function armarTandaDeHoy(pedido: PedidoTanda = {}): Promise<EstadoAccion> {
  const hoy = hoyAR();
  const { count: yaHoy, error: errorHoy } = await db().from("prospectos").select("id", { count: "exact", head: true }).eq("tanda_fecha", hoy);
  if (errorHoy) return fallo("No pude leer la tanda de hoy. Probá de nuevo.");
  const tope = env().TANDA_LIMITE;
  const limite = tope - (yaHoy ?? 0);
  if (limite <= 0) return fallo(`Ya armaste la tanda de hoy (${tope}). Mañana sigue.`);

  let candidatos: CandidatoTanda[];
  try {
    candidatos = await leerCandidatos(pedido.soloIds);
  } catch (e) {
    return fallo(e instanceof Error ? e.message : "No pude leer la base.");
  }

  // Modo Cancha también prueba números que parecen fijos: en ciudades medianas los celulares empiezan con 4.
  const opciones = { limite, maxPorCiudad: env().TANDA_MAX_POR_CIUDAD, incluirFijos: true, zona: pedido.zona ?? TODA_LA_BASE };
  const fuera = new Set(pedido.evitar ?? []);
  let ids = elegirTanda(candidatos.filter((p) => !fuera.has(p.id)), opciones);
  // Si no alcanza con complejos nuevos, se completa con los que se devolvieron.
  if (ids.length < limite && fuera.size) {
    const elegidos = new Set(ids);
    ids = [...ids, ...elegirTanda(candidatos.filter((p) => fuera.has(p.id) && !elegidos.has(p.id)), { ...opciones, limite: limite - ids.length })];
  }
  if (!ids.length) return fallo("No quedan complejos sin contactar con WhatsApp en esa zona. Buscá o cargá más.");

  const { data: elegidos, error } = await db().from("prospectos").select(COLUMNAS_MENSAJE).in("id", ids);
  if (error) return fallo("No pude leer los complejos elegidos. Probá de nuevo.");
  const lista = (elegidos ?? []) as ParaMensaje[];
  await redactarYGuardar(lista, hoy);
  revalidatePath("/", "layout");
  const recorte = pedido.soloIds && pedido.soloIds.length > lista.length ? ` (el límite diario no dejó sumar los ${pedido.soloIds.length})` : "";
  return exito(`Tanda lista: ${lista.length} complejos con su mensaje${recorte}.`);
}

async function leerCandidatos(soloIds?: string[]): Promise<CandidatoTanda[]> {
  if (soloIds) {
    if (!soloIds.length) return [];
    const { data, error } = await db().from("prospectos").select(COLUMNAS_CANDIDATO).in("id", soloIds);
    if (error) throw new Error(`No pude leer la base: ${error.message}`);
    return (data ?? []) as CandidatoTanda[];
  }
  return leerTodo<CandidatoTanda>((desde, hasta) =>
    db().from("prospectos").select(COLUMNAS_CANDIDATO).eq("estado", "sin_contactar").not("telefono_wa", "is", null).order("id").range(desde, hasta),
  );
}

/** Un mensaje distinto para cada uno. Se redactan de a 3 para no tardar demasiado. */
async function redactarYGuardar(lista: ParaMensaje[], hoy: string) {
  for (let i = 0; i < lista.length; i += DE_A) {
    await Promise.all(
      lista.slice(i, i + DE_A).map(async (p) => {
        const mensaje = await redactarPrimerMensaje(p);
        await db().from("prospectos").update({ estado: "en_tanda", tanda_fecha: hoy, mensaje_inicial: mensaje }).eq("id", p.id).eq("estado", "sin_contactar");
      }),
    );
  }
}
