import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { instrucciones } from "./conocimiento";
import { ESQUEMA_RESPUESTA, normalizarDecision, transcripcion, type Cerebro } from "./cerebro";

let cliente: Anthropic | null = null;
function anthropic() {
  cliente ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return cliente;
}

/** Cerebro real: Claude decide qué responder usando una herramienta con salida estructurada. */
export const cerebroClaude: Cerebro = {
  async decidir(ctx) {
    const r = await anthropic().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 800,
      system: instrucciones({ linkPrueba: env().LINK_PRUEBA }),
      tools: [{ name: "responder", description: "Envía la respuesta al negocio y actualiza su estado.", input_schema: ESQUEMA_RESPUESTA }],
      tool_choice: { type: "tool", name: "responder", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: transcripcion(ctx) }],
    });
    const uso = r.content.find((b) => b.type === "tool_use");
    return normalizarDecision(uso && uso.type === "tool_use" ? uso.input : null);
  },
};

/**
 * Primer mensaje personalizado para un prospecto. Corto, honesto y distinto en cada caso
 * (los textos idénticos a muchos números son lo que WhatsApp detecta como spam).
 */
export async function redactarPrimerMensaje(p: { nombre: string; rubro: string | null; ciudad: string | null }): Promise<string> {
  const rubro = (p.rubro ?? "estudio").toLowerCase();
  try {
    const r = await anthropic().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 300,
      system:
        "Escribís el primer mensaje de WhatsApp que Eugenio Radonich, desarrollador de Rosario, le manda a un negocio que no lo conoce. " +
        "Objetivo: pedir 10 minutos para que le cuenten cómo cobran las cuotas, NO vender. Mencioná en una frase que está armando una herramienta que manda los avisos de cuota por WhatsApp con link de Mercado Pago. " +
        "Castellano rioplatense, 3 a 4 oraciones, cálido y directo, sin emojis, sin markdown, sin inventar nada sobre el negocio (no digas que viste reseñas ni fotos). " +
        "Cerrá con una pregunta simple. Respondé solo con el mensaje.",
      messages: [{ role: "user", content: `Negocio: ${p.nombre}. Rubro: ${rubro}. Ciudad: ${p.ciudad ?? "Argentina"}.` }],
    });
    const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (texto.length > 40 && texto.length < 700) return texto;
  } catch {
    // Si Claude no responde, se usa la plantilla.
  }
  return plantillaPrimerMensaje(p.nombre, rubro);
}

export function plantillaPrimerMensaje(nombre: string, rubro: string): string {
  return `Hola! ¿Hablo con ${nombre}? Soy Eugenio, desarrollador de Rosario. Estoy armando una herramienta para estudios de ${rubro} que manda solos los avisos de cuota por WhatsApp con link de Mercado Pago y muestra quién debe. ¿Me contarías en 10 minutos cómo cobran hoy las cuotas? Me ayuda mucho a hacerla bien.`;
}
