import "server-only";
import { env } from "@/lib/env";

/**
 * Envío de texto libre por la API. Solo funciona dentro de la ventana de 24 horas
 * desde el último mensaje del negocio (por eso el bot únicamente responde, nunca inicia).
 *
 * Proveedor configurable:
 *  - Meta directo (por defecto): https://graph.facebook.com/<versión>/<phone_number_id>/messages, Bearer <token>
 *  - 360dialog u otro proveedor compatible: WHATSAPP_API_URL=<url completa de /messages> y WHATSAPP_AUTH_HEADER=D360-API-KEY
 */
export interface CanalWhatsApp {
  enviarTexto(para: string, texto: string): Promise<{ id: string }>;
}

export function canalWhatsApp(): CanalWhatsApp {
  const e = env();
  if (!e.WHATSAPP_TOKEN || (!e.WHATSAPP_API_URL && !e.WHATSAPP_PHONE_NUMBER_ID)) {
    throw new Error("WhatsApp todavía no está conectado: completá WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID (ver /conectar).");
  }
  const token = e.WHATSAPP_TOKEN;
  const url = e.WHATSAPP_API_URL ?? `https://graph.facebook.com/${e.WHATSAPP_GRAPH_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (e.WHATSAPP_AUTH_HEADER === "Authorization") headers.Authorization = `Bearer ${token}`;
  else headers[e.WHATSAPP_AUTH_HEADER] = token;

  return {
    async enviarTexto(para, texto) {
      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: para, type: "text", text: { body: texto, preview_url: false } }),
        signal: AbortSignal.timeout(15_000),
      });
      const datos = (await r.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null;
      if (!r.ok || !datos?.messages?.[0]) {
        const codigo = datos?.error?.code;
        // 131047: pasaron más de 24 h desde el último mensaje del negocio → solo se puede con plantilla.
        const extra = codigo === 131047 ? " (ventana de 24 h vencida: respondé vos desde la app)" : "";
        throw new Error(`WhatsApp no aceptó el mensaje: ${datos?.error?.message ?? `HTTP ${r.status}`}${extra}`);
      }
      return { id: datos.messages[0].id };
    },
  };
}
