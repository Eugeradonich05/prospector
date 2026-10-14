import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lectura del webhook de WhatsApp Cloud API.
 *
 * Eventos que nos importan:
 *  - field "messages"            → value.messages[]:       mensajes que te mandan los negocios
 *  - field "smb_message_echoes"  → value.message_echoes[]: mensajes que mandaste VOS desde la app
 *                                  (solo con coexistencia: app de WhatsApp Business + API en el mismo número)
 *  - value.statuses[]            → entregado / leído / fallido (se ignoran salvo para registro)
 *
 * El formato de smb_message_echoes es el documentado por Meta para coexistencia; si cambia,
 * ajustá `ecos()` y el test de tests/webhook.test.ts.
 */

export type EventoWhatsApp =
  | { tipo: "entrante"; de: string; waId: string; momento: number; clase: string; texto: string | null; nombrePerfil: string | null }
  | { tipo: "eco"; para: string; waId: string; momento: number; clase: string; texto: string | null };

type Mensaje = {
  from?: string;
  to?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

type Cambio = {
  field?: string;
  value?: {
    contacts?: { wa_id?: string; profile?: { name?: string } }[];
    messages?: Mensaje[];
    message_echoes?: Mensaje[];
  };
};

type Payload = { object?: string; entry?: { changes?: Cambio[] }[] };

function textoDe(m: Mensaje): string | null {
  return m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
}

export function parsearWebhook(payload: unknown): EventoWhatsApp[] {
  const p = payload as Payload;
  if (!p || p.object !== "whatsapp_business_account" || !Array.isArray(p.entry)) return [];
  const eventos: EventoWhatsApp[] = [];

  for (const entrada of p.entry) {
    for (const cambio of entrada.changes ?? []) {
      const v = cambio.value ?? {};
      if (cambio.field === "messages") {
        const nombres = new Map((v.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? null]));
        for (const m of v.messages ?? []) {
          if (!m.from || !m.id) continue;
          eventos.push({
            tipo: "entrante",
            de: m.from,
            waId: m.id,
            momento: Number(m.timestamp ?? 0),
            clase: m.type ?? "unknown",
            texto: textoDe(m),
            nombrePerfil: nombres.get(m.from) ?? null,
          });
        }
      }
      if (cambio.field === "smb_message_echoes") {
        for (const m of v.message_echoes ?? []) {
          if (!m.to || !m.id) continue;
          eventos.push({ tipo: "eco", para: m.to, waId: m.id, momento: Number(m.timestamp ?? 0), clase: m.type ?? "unknown", texto: textoDe(m) });
        }
      }
    }
  }
  return eventos;
}

/** Valida X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el App Secret de Meta). */
export function firmaMetaValida(cuerpoCrudo: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const recibido = Buffer.from(header.slice(7), "hex");
  const esperado = createHmac("sha256", appSecret).update(cuerpoCrudo, "utf8").digest();
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
