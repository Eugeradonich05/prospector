"use server";

import { exigirSesion } from "@/lib/sesion-servidor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/datos/supabase";
import { exito, fallo, type EstadoAccion } from "@/lib/acciones";
import { buscarComplejos, ErrorPlaces, type Fetch } from "@/lib/google/places";
import { DEPORTES_BUSQUEDA } from "@/lib/google/complejos-google";
import { buscarDuplicados, normalizarTexto } from "@/lib/dominio/complejos";
import { armarTandaDeHoy } from "@/lib/tanda-servidor";
import { esquemaResultados, leerExistentes, type EncontradoGuardado } from "./datos";

const esquemaBusqueda = z.object({
  zona: z.string().trim().min(2, "Escribí una ciudad o zona.").max(120),
  radio: z.coerce.number().int().min(5, "El radio va de 5 a 50 km.").max(50, "El radio va de 5 a 50 km."),
  deportes: z.array(z.enum(DEPORTES_BUSQUEDA as [string, ...string[]])).min(1, "Elegí al menos un deporte."),
});

export async function buscar(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const apiKey = env().GOOGLE_MAPS_API_KEY;
  if (!apiKey) return fallo("Falta GOOGLE_MAPS_API_KEY: mirá arriba cómo crearla.");
  const pedido = esquemaBusqueda.safeParse({ zona: datos.get("zona") ?? "", radio: datos.get("radio"), deportes: datos.getAll("deportes") });
  if (!pedido.success) return fallo(pedido.error.issues[0]!.message);
  const { zona, radio, deportes } = pedido.data;

  let id: string;
  try {
    const r = await buscarComplejos({ zona, radioKm: radio, deportes: deportes as (typeof DEPORTES_BUSQUEDA)[number][], apiKey, fetch: fetch as unknown as Fetch });
    const duplicados = buscarDuplicados(r.encontrados, await leerExistentes());
    const nuevos = r.encontrados.filter((e, i) => !duplicados[i] && !e.descarte).length;
    const { data, error } = await db()
      .from("busquedas")
      .insert({ zona, radio_km: radio, deportes, encontrados: r.encontrados.length, nuevos, llamadas: r.llamadas, resultados: r.encontrados })
      .select("id")
      .single();
    if (error) return fallo(`Busqué, pero no pude guardar la búsqueda: ${error.message}`);
    id = data.id;
  } catch (e) {
    if (e instanceof ErrorPlaces) return fallo(e.message);
    if (e instanceof Error && e.name === "TimeoutError") return fallo("Google tardó demasiado en responder. Probá de nuevo.");
    return fallo("No pude buscar en Google Maps. Probá de nuevo en un rato.");
  }
  redirect(`/buscar?b=${id}`);
}

const esquemaAgregar = z.object({
  busqueda: z.string().uuid(),
  places: z.array(z.string().min(1).max(300)).min(1, "No elegiste ningún complejo.").max(300),
  modo: z.enum(["solo", "tanda"]),
});

/** Agrega los complejos elegidos de una búsqueda guardada y, si se pide, arma la tanda de hoy solo con ellos. */
export async function agregarEncontrados(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const pedido = esquemaAgregar.safeParse({ busqueda: datos.get("busqueda"), places: datos.getAll("place_id"), modo: datos.get("modo") });
  if (!pedido.success) return fallo(pedido.error.issues[0]!.message);
  const { busqueda, places, modo } = pedido.data;

  const { data: b, error } = await db().from("busquedas").select("resultados").eq("id", busqueda).maybeSingle();
  if (error || !b) return fallo("No encontré esa búsqueda.");
  const resultados = esquemaResultados.safeParse(b.resultados);
  if (!resultados.success) return fallo("La búsqueda guardada está dañada. Hacela de nuevo.");

  const elegidos = new Set(places);
  const seleccion = resultados.data.filter((e) => elegidos.has(e.place_id));
  let existentes;
  try {
    existentes = await leerExistentes();
  } catch {
    return fallo("No pude leer la base. Probá de nuevo.");
  }
  // Se vuelve a deduplicar: puede que alguno se haya cargado mientras tanto.
  const duplicados = buscarDuplicados(seleccion, existentes);
  const aCargar = seleccion.filter((_, i) => !duplicados[i]);
  const ciudades = new Map(existentes.filter((e) => e.ciudad).map((e) => [normalizarTexto(e.ciudad), e.ciudad!]));
  const ids = await insertar(aCargar, ciudades);
  revalidatePath("/", "layout");

  const salteados = seleccion.length - aCargar.length;
  const resumen = `Agregué ${ids.length} complejos${salteados ? ` (${salteados} ya estaban)` : ""}${ids.length < aCargar.length ? ` y ${aCargar.length - ids.length} no se pudieron guardar` : ""}.`;
  if (modo === "solo") return exito(resumen);
  if (!ids.length) return fallo(`${resumen} No hay complejos nuevos para la tanda.`);
  const tanda = await armarTandaDeHoy({ soloIds: ids });
  if (tanda.error) return fallo(`${resumen} Pero la tanda no se armó: ${tanda.error}`);
  redirect("/");
}

/** Inserta y devuelve los ids. Si un lote choca con algo que se cargó mientras tanto, prueba de a uno. */
async function insertar(lista: EncontradoGuardado[], ciudades: Map<string, string>): Promise<string[]> {
  const filas = lista.map((e) => ({
    nombre: e.nombre,
    rubro: e.rubro,
    // Si la ciudad ya está en la base con otra escritura («de Los Arroyos» / «de los Arroyos»), se usa esa.
    ciudad: e.ciudad ? (ciudades.get(normalizarTexto(e.ciudad)) ?? e.ciudad) : null,
    provincia: e.provincia,
    direccion: e.direccion,
    telefono: e.telefono,
    telefono_wa: e.telefono_wa,
    prioridad: e.prioridad,
    resenas: e.resenas,
    calificacion: e.calificacion,
    maps_url: e.maps_url,
    web: e.web,
    place_id: e.place_id,
    deportes: e.deportes,
    lat: e.lat,
    lng: e.lng,
    origen: "google" as const,
    estado: "sin_contactar" as const,
  }));
  const ids: string[] = [];
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const { data, error } = await db().from("prospectos").insert(lote).select("id");
    if (!error) {
      ids.push(...(data ?? []).map((f) => f.id));
      continue;
    }
    for (const fila of lote) {
      const { data: una } = await db().from("prospectos").insert(fila).select("id").maybeSingle();
      if (una) ids.push(una.id);
    }
  }
  return ids;
}
