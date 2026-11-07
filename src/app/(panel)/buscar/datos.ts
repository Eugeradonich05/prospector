import "server-only";
import { z } from "zod";
import { db } from "@/lib/datos/supabase";
import { leerTodo } from "@/lib/datos/leer-todo";
import { DEPORTES, type Existente } from "@/lib/dominio/complejos";

export async function leerExistentes(): Promise<Existente[]> {
  return leerTodo<Existente>((desde, hasta) => db().from("prospectos").select("id, nombre, ciudad, place_id, telefono_wa, estado, direccion").order("id").range(desde, hasta));
}

/** Los resultados se guardan en busquedas.resultados; al leerlos se validan igual (nunca confiar a ciegas). */
export const esquemaEncontrado = z.object({
  place_id: z.string().min(1).max(300),
  nombre: z.string().min(1).max(300),
  direccion: z.string().max(500).nullable(),
  ciudad: z.string().max(200).nullable(),
  provincia: z.string().max(200).nullable(),
  telefono: z.string().max(60).nullable(),
  telefono_wa: z
    .string()
    .regex(/^549\d{10}$/)
    .nullable(),
  chance: z.enum(["alta", "media", "baja"]).nullable(),
  resenas: z.number().int().min(0),
  calificacion: z.number().min(0).max(5).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  maps_url: z.string().url().max(1000).nullable(),
  web: z
    .string()
    .url()
    .max(1000)
    .regex(/^https?:\/\//i)
    .nullable(),
  rubro: z.string().max(80),
  deportes: z.array(z.enum(DEPORTES)),
  prioridad: z.enum(["A", "B", "C"]),
  descarte: z.string().max(200).nullable(),
});

export const esquemaResultados = z.array(esquemaEncontrado).max(500);
export type EncontradoGuardado = z.infer<typeof esquemaEncontrado>;
