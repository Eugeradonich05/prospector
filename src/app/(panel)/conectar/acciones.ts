"use server";

import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Completa la conexión con Meta: canjea el código, suscribe la app a la cuenta de WhatsApp
 * y devuelve los datos para cargar en las variables de entorno.
 * Solo vos llegás acá (el panel exige sesión).
 */
export type ResultadoConexion =
  | { ok: true; wabaId: string; phoneNumberId: string; numero: string | null; token: string }
  | { ok: false; error: string };

const G = () => `https://graph.facebook.com/${env().WHATSAPP_GRAPH_VERSION}`;

async function graph<T>(ruta: string, token: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${G()}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(d.error?.message ?? `Meta respondió HTTP ${r.status}`);
  return d;
}

export async function completarConexion(entrada: { code: string; wabaId: string; phoneNumberId: string | null }): Promise<ResultadoConexion> {
  const e = env();
  const datos = z.object({ code: z.string().min(10), wabaId: z.string().regex(/^\d+$/), phoneNumberId: z.string().regex(/^\d+$/).nullable() }).safeParse(entrada);
  if (!datos.success) return { ok: false, error: "Meta no devolvió los datos esperados. Probá de nuevo." };
  if (!e.META_APP_ID || !e.WHATSAPP_APP_SECRET) return { ok: false, error: "Faltan META_APP_ID y WHATSAPP_APP_SECRET en las variables de entorno." };

  try {
    // 1. Código → token de la cuenta conectada
    const q = new URLSearchParams({ client_id: e.META_APP_ID, client_secret: e.WHATSAPP_APP_SECRET, code: datos.data.code });
    const r = await fetch(`${G()}/oauth/access_token?${q}`, { signal: AbortSignal.timeout(15_000) });
    const t = (await r.json()) as { access_token?: string; error?: { message?: string } };
    if (!t.access_token) return { ok: false, error: `No se pudo obtener el token: ${t.error?.message ?? "respuesta vacía"}` };
    const token = t.access_token;

    // 2. Suscribir tu app a la cuenta de WhatsApp, para que lleguen los mensajes al webhook
    await graph(`/${datos.data.wabaId}/subscribed_apps`, token, { method: "POST" });

    // 3. Número conectado
    const numeros = await graph<{ data: { id: string; display_phone_number?: string }[] }>(
      `/${datos.data.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      token,
    );
    const elegido = numeros.data.find((n) => n.id === datos.data.phoneNumberId) ?? numeros.data[0];
    if (!elegido) return { ok: false, error: "La cuenta quedó conectada pero no encontramos el número. Revisalo en WhatsApp Manager." };

    return { ok: true, wabaId: datos.data.wabaId, phoneNumberId: elegido.id, numero: elegido.display_phone_number ?? null, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error con Meta." };
  }
}
