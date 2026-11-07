"use server";

import { exigirSesion } from "@/lib/sesion-servidor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/datos/supabase";
import { leerTodo } from "@/lib/datos/leer-todo";
import { exito, fallo, type EstadoAccion } from "@/lib/acciones";
import { buscarDuplicados, type Existente } from "@/lib/dominio/complejos";
import { leerFormularioComplejo } from "@/lib/dominio/datos-complejo";
import { MAX_FILAS_IMPORTAR, clasificarPlanilla, resumenImportacion, type Clasificacion, type FilaImportada } from "@/lib/dominio/importar";
import { ETIQUETA_ESTADO, type EstadoProspecto } from "@/lib/dominio/tipos";

const uuid = z.string().uuid();
const ESTADOS = Object.keys(ETIQUETA_ESTADO) as [EstadoProspecto, ...EstadoProspecto[]];

async function leerExistentes(): Promise<Existente[]> {
  return leerTodo<Existente>((desde, hasta) => db().from("prospectos").select("id, nombre, ciudad, place_id, telefono_wa, estado, direccion").order("id").range(desde, hasta));
}

function mensajeError(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Ya hay un complejo con ese teléfono, ese lugar de Google Maps o ese nombre y dirección.";
  return `No se pudo guardar: ${e.message}`;
}

// ── Agregar a mano ─────────────────────────────────────

export async function crearComplejo(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const r = leerFormularioComplejo(datos);
  if (!r.success) return fallo(r.error.issues[0]!.message);
  const c = r.data;

  let existentes: Existente[];
  try {
    existentes = await leerExistentes();
  } catch {
    return fallo("No pude leer la base. Probá de nuevo.");
  }
  const [duplicado] = buscarDuplicados([{ nombre: c.nombre, ciudad: c.ciudad, telefono_wa: c.telefono_wa }], existentes);
  if (duplicado?.existente) return fallo(`Ya está en la base como «${duplicado.existente.nombre}» (${ETIQUETA_ESTADO[duplicado.existente.estado as EstadoProspecto] ?? duplicado.existente.estado}).`);

  const { data, error } = await db()
    .from("prospectos")
    .insert({ ...c, prioridad: "B", origen: "manual", estado: "sin_contactar" })
    .select("id")
    .single();
  if (error) return fallo(mensajeError(error));
  revalidatePath("/", "layout");
  redirect(`/complejos/${data.id}`);
}

// ── Ficha ──────────────────────────────────────────────

export async function editarComplejo(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirSesion();
  const id = uuid.safeParse(datos.get("id"));
  if (!id.success) return fallo("Complejo inválido.");
  const estado = z.enum(ESTADOS).safeParse(datos.get("estado"));
  if (!estado.success) return fallo("Estado inválido.");
  const r = leerFormularioComplejo(datos);
  if (!r.success) return fallo(r.error.issues[0]!.message);

  // El WhatsApp se recalcula solo si cambió el teléfono: si no, un número marcado «sin WhatsApp» volvería a las tandas.
  const { data: actual, error: errorLectura } = await db().from("prospectos").select("telefono").eq("id", id.data).maybeSingle();
  if (errorLectura || !actual) return fallo("No encontré ese complejo.");
  const { telefono_wa, ...resto } = r.data;
  const cambios = actual.telefono === r.data.telefono ? resto : { ...resto, telefono_wa };

  const { error } = await db()
    .from("prospectos")
    .update({ ...cambios, estado: estado.data })
    .eq("id", id.data);
  if (error) return fallo(mensajeError(error));
  revalidatePath("/", "layout");
  return exito("Guardado.");
}

// ── Importar planilla ──────────────────────────────────

/** La planilla llega como tabla de textos (la lee el navegador). Acá se vuelve a validar todo. */
const esquemaTabla = z
  .string()
  .max(5_000_000, "La planilla es demasiado grande.")
  .transform((t, ctx) => {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "No pude leer la planilla." });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(z.array(z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).max(60))
      .min(2, "La planilla no tiene filas.")
      .max(MAX_FILAS_IMPORTAR + 1, `Como mucho ${MAX_FILAS_IMPORTAR} filas por vez.`),
  );

export type EstadoImportacion = EstadoAccion & { clasificacion?: Clasificacion; importado?: boolean };

async function clasificar(datos: FormData): Promise<{ error: string } | { clasificacion: Clasificacion }> {
  const tabla = esquemaTabla.safeParse(datos.get("tabla"));
  if (!tabla.success) return { error: tabla.error.issues[0]!.message };
  try {
    return { clasificacion: clasificarPlanilla(tabla.data, await leerExistentes()) };
  } catch {
    return { error: "No pude leer la base. Probá de nuevo." };
  }
}

/** Paso 1: vista previa (no guarda nada). Paso 2 (`confirmar=1`): guarda los nuevos y los sin teléfono. */
export async function importarPlanilla(_: EstadoImportacion, datos: FormData): Promise<EstadoImportacion> {
  await exigirSesion();
  const r = await clasificar(datos);
  if ("error" in r) return fallo(r.error);
  const { clasificacion } = r;
  if (clasificacion.faltaNombre) return fallo("No encontré la columna «nombre». La primera fila tiene que tener los títulos de las columnas.");
  if (datos.get("confirmar") !== "1") return { ...exito(`Vista previa: ${resumenImportacion(clasificacion.resultados)}.`), clasificacion };

  const aGuardar = clasificacion.resultados.flatMap((x) => (x.tipo === "nuevo" || x.tipo === "sin_telefono" ? [x.fila] : []));
  const { guardados, fallidos } = await insertar(aGuardar);
  revalidatePath("/", "layout");
  const extra = fallidos ? ` (${fallidos} no se pudieron guardar)` : "";
  return { ...exito(`Listo: ${resumenImportacion(clasificacion.resultados)}. Guardé ${guardados}${extra}.`), clasificacion, importado: true };
}

async function insertar(filas: FilaImportada[]): Promise<{ guardados: number; fallidos: number }> {
  const filasDb = filas.map((f) => ({ ...f, prioridad: "B" as const, origen: "importado" as const, estado: "sin_contactar" as const }));
  let guardados = 0;
  let fallidos = 0;
  for (let i = 0; i < filasDb.length; i += 100) {
    const lote = filasDb.slice(i, i + 100);
    const { error } = await db().from("prospectos").insert(lote);
    if (!error) {
      guardados += lote.length;
      continue;
    }
    // Si el lote choca (por ejemplo, alguien cargó uno igual mientras tanto), se prueba de a uno.
    for (const fila of lote) {
      const { error: e } = await db().from("prospectos").insert(fila);
      if (e) fallidos++;
      else guardados++;
    }
  }
  return { guardados, fallidos };
}
