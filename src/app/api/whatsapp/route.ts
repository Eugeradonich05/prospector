import { after, NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { parsearWebhook, firmaMetaValida } from "@/lib/whatsapp/webhook";
import { procesarEvento } from "@/lib/bot/manejar";
import { almacenSupabase } from "@/lib/datos/supabase";
import { canalWhatsApp } from "@/lib/whatsapp/enviar";
import { cerebroClaude } from "@/lib/bot/claude";
import { avisarAEugenio } from "@/lib/avisos";

/**
 * Webhook de WhatsApp.
 * GET: verificación que hace Meta al configurar la URL (hub.challenge).
 * POST: mensajes entrantes y ecos de la app. Se responde 200 al instante y se procesa después
 * (Meta reintenta si tardás), con `after()`.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = Buffer.from(q.get("hub.verify_token") ?? "");
  const esperado = Buffer.from(env().WHATSAPP_VERIFY_TOKEN);
  const ok = q.get("hub.mode") === "subscribe" && token.length === esperado.length && timingSafeEqual(token, esperado);
  return ok ? new NextResponse(q.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("token inválido", { status: 403 });
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();
  const secreto = env().WHATSAPP_APP_SECRET;
  if (secreto && !firmaMetaValida(crudo, req.headers.get("x-hub-signature-256"), secreto)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const eventos = parsearWebhook(payload);
  if (eventos.length) {
    after(async () => {
      let canal;
      try {
        canal = canalWhatsApp();
      } catch (e) {
        console.error("[whatsapp]", e instanceof Error ? e.message : e);
        return;
      }
      const deps = {
        almacen: almacenSupabase,
        canal,
        cerebro: cerebroClaude,
        notificar: avisarAEugenio,
        ahora: () => new Date(),
        maxRespuestas: env().BOT_MAX_RESPUESTAS,
      };
      for (const ev of eventos) {
        try {
          const r = await procesarEvento(ev, deps);
          console.log(`[whatsapp] ${ev.tipo} ${ev.waId}: ${r}`);
        } catch (e) {
          console.error(`[whatsapp] error con ${ev.waId}:`, e);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
