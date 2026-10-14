import "server-only";
import { env } from "@/lib/env";
import type { Prospecto } from "@/lib/dominio/tipos";

/**
 * Te avisa por email (Resend) cuando una conversación necesita que intervengas.
 * Si no configuraste RESEND_API_KEY y EMAIL_AVISOS, el aviso queda solo en el panel.
 */
export async function avisarAEugenio(p: Prospecto, motivo: string): Promise<void> {
  const e = env();
  if (!e.RESEND_API_KEY || !e.EMAIL_AVISOS) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: e.EMAIL_REMITENTE ?? "Prospector <onboarding@resend.dev>",
      to: [e.EMAIL_AVISOS],
      subject: `${p.nombre} (${p.ciudad ?? ""}) necesita que respondas`,
      text: `${motivo}\n\nAbrí la conversación: ${e.NEXT_PUBLIC_APP_URL}/conversaciones/${p.id}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
}
