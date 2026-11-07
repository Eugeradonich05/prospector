import { z } from "zod";
import { DEPORTES, SISTEMAS, type SistemaActual } from "./complejos";
import { esRubroDeCanchas } from "./lineas";
import { normalizarTelefonoAR } from "./telefono";

/** "@padel.norte", "instagram.com/padel.norte/" o "https://www.instagram.com/padel.norte?hl=es" → "padel.norte". */
export function normalizarInstagram(entrada: string | null | undefined): string | null {
  const t = (entrada ?? "").trim();
  if (!t) return null;
  const desdeUrl = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(t);
  const usuario = (desdeUrl ? desdeUrl[1]! : t.replace(/^@/, "")).replace(/\/+$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? usuario.toLowerCase() : null;
}

/** Para href: solo deja pasar links http(s); cualquier otra cosa (javascript:, data:) queda en null. */
export function enlaceSeguro(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url : null;
}

export function linkInstagram(usuario: string): string {
  return `https://www.instagram.com/${encodeURIComponent(usuario)}/`;
}

/** Solo webs http(s). Sin esquema se asume https. Cualquier otra cosa (javascript:, mailto:, etc.) se descarta. */
export function normalizarWeb(entrada: string | null | undefined): string | null {
  const t = (entrada ?? "").trim();
  if (!t) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conEsquema);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

/** Lo que se puede editar de un complejo desde el panel. Se valida siempre del lado del servidor. */
export const esquemaComplejo = z
  .object({
    nombre: z.string().trim().min(2, "Poné el nombre del complejo.").max(200),
    rubro: z.string().trim().max(80).refine(esRubroDeCanchas, "Solo se cargan complejos de canchas (fútbol, pádel, tenis, etc.)."),
    ciudad: textoOpcional(120),
    provincia: textoOpcional(120),
    direccion: textoOpcional(300),
    telefono: textoOpcional(40),
    instagram: textoOpcional(200),
    web: textoOpcional(300),
    deportes: z.array(z.enum(DEPORTES)).max(DEPORTES.length).default([]),
    canchas_cantidad: z
      .union([z.literal(""), z.coerce.number().int("La cantidad de canchas tiene que ser un número entero.").min(1).max(200)])
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    sistema_actual: z
      .union([z.literal(""), z.enum(SISTEMAS)])
      .nullable()
      .optional()
      .transform((v): SistemaActual | null => (v ? v : null)),
    notas: textoOpcional(2000),
  })
  .transform((c) => ({
    ...c,
    instagram: normalizarInstagram(c.instagram),
    web: normalizarWeb(c.web),
    telefono_wa: normalizarTelefonoAR(c.telefono),
  }));

export type DatosComplejo = z.infer<typeof esquemaComplejo>;

/** Lee el formulario de la ficha (los deportes vienen como varios checkboxes con el mismo nombre). */
export function leerFormularioComplejo(datos: FormData) {
  return esquemaComplejo.safeParse({
    nombre: datos.get("nombre") ?? "",
    rubro: datos.get("rubro") ?? "",
    ciudad: datos.get("ciudad"),
    provincia: datos.get("provincia"),
    direccion: datos.get("direccion"),
    telefono: datos.get("telefono"),
    instagram: datos.get("instagram"),
    web: datos.get("web"),
    deportes: datos.getAll("deportes"),
    canchas_cantidad: datos.get("canchas_cantidad"),
    sistema_actual: datos.get("sistema_actual"),
    notas: datos.get("notas"),
  });
}
