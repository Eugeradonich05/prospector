import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { instrucciones } from "./conocimiento";
import { ESQUEMA_RESPUESTA, normalizarDecision, transcripcion, type Cerebro } from "./cerebro";
import { conSitio, pedidoPrimerMensaje, plantillaPrimerMensaje, textoAceptable, type DatosPrimerMensaje } from "./primer-mensaje";

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
      system: instrucciones({ linkPrueba: env().LINK_PRUEBA_GRATIS, linkSitio: env().LINK_SITIO }),
      tools: [{ name: "responder", description: "Envía la respuesta al complejo y actualiza su estado.", input_schema: ESQUEMA_RESPUESTA }],
      tool_choice: { type: "tool", name: "responder", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: transcripcion(ctx) }],
    });
    const uso = r.content.find((b) => b.type === "tool_use");
    return normalizarDecision(uso && uso.type === "tool_use" ? uso.input : null);
  },
};

/** Primer mensaje personalizado para un complejo, siempre como Modo Cancha. Si Claude falla, usa una plantilla. */
export async function redactarPrimerMensaje(p: DatosPrimerMensaje): Promise<string> {
  const sitio = env().LINK_SITIO;
  const { system, user } = pedidoPrimerMensaje(p, sitio);
  try {
    const r = await anthropic().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: user }],
    });
    const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (textoAceptable(texto)) return conSitio(texto, sitio);
  } catch {
    // Si Claude no responde, se usa la plantilla.
  }
  return plantillaPrimerMensaje(p.nombre, p.rubro, sitio);
}
