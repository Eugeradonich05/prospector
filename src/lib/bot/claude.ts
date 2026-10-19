import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { instrucciones } from "./conocimiento";
import { LINEAS, lineaDeRubro, plantillaPara, type Linea } from "@/lib/dominio/lineas";
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
      system: instrucciones({ linkPrueba: env().LINK_PRUEBA, linkSitio: env().LINK_SITIO, linea: lineaDeRubro(ctx.prospecto.rubro) }),
      tools: [{ name: "responder", description: "Envía la respuesta al negocio y actualiza su estado.", input_schema: ESQUEMA_RESPUESTA }],
      tool_choice: { type: "tool", name: "responder", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: transcripcion(ctx) }],
    });
    const uso = r.content.find((b) => b.type === "tool_use");
    return normalizarDecision(uso && uso.type === "tool_use" ? uso.input : null);
  },
};

/** Cómo encarar cada línea en el primer mensaje: el problema concreto del rubro, no el producto. */
const ENFOQUE: Record<Linea, string> = {
  cuotas: "Objetivo: pedir 10 minutos para que le cuenten cómo cobran las cuotas. Mencioná en una frase que armó una herramienta que manda solos los avisos de cuota por WhatsApp con link de Mercado Pago.",
  turnos:
    "Objetivo: preguntar cómo manejan hoy los turnos y las consultas por WhatsApp. Mencioná en una frase que arma asistentes de WhatsApp que contestan precios y horarios, agendan en el calendario y mandan el recordatorio. Si el rubro es de salud (odontología, kinesiología, veterinaria), hablá de turnos y pacientes; si es de belleza (peluquería, barbería, estética), de turnos y clientes.",
  documentos:
    "Objetivo: preguntar cuánto tiempo se les va buscando datos en expedientes o documentación, o avisando vencimientos a clientes. Mencioná en una frase el buscador que responde con la cita exacta (documento y página) aunque el PDF esté escaneado. Para estudios contables podés nombrar también los avisos de vencimientos a clientes.",
  a_medida:
    "Objetivo: preguntar qué tarea repiten todos los días que les gustaría que se haga sola. Mencioná en una frase un ejemplo que encaje con el rubro: para inmobiliarias, contestar las consultas de propiedades por WhatsApp y avisar vencimientos de alquileres; para talleres, avisar «tu auto ya está listo» y agendar turnos; para otros, avisos y respuestas automáticas por WhatsApp.",
};

/**
 * Primer mensaje personalizado para un prospecto, según el servicio que le sirve a su rubro.
 * Corto, honesto y distinto en cada caso (los textos idénticos a muchos números son lo que
 * WhatsApp detecta como spam).
 */
export async function redactarPrimerMensaje(p: { nombre: string; rubro: string | null; ciudad: string | null }): Promise<string> {
  const rubro = p.rubro ?? "negocio";
  const linea = lineaDeRubro(p.rubro) ?? "a_medida";
  try {
    const r = await anthropic().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 300,
      system:
        "Escribís el primer mensaje de WhatsApp que Eugenio Radonich, de Cauce (automatización de procesos, Rosario), le manda a un negocio que no lo conoce. " +
        `${ENFOQUE[linea]} NO vendas ni pongas precios. ` +
        "Castellano rioplatense, 3 a 4 oraciones, cálido y directo, sin emojis, sin markdown, sin inventar nada sobre el negocio (no digas que viste reseñas, fotos ni su web). " +
        "Presentate como Eugenio, de Cauce. Cerrá con una pregunta simple. Respondé solo con el mensaje.",
      messages: [{ role: "user", content: `Negocio: ${p.nombre}. Rubro: ${rubro}. Ciudad: ${p.ciudad ?? "Argentina"}. Servicio que le puede servir: ${LINEAS[linea].gancho}.` }],
    });
    const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (texto.length > 40 && texto.length < 700) return texto;
  } catch {
    // Si Claude no responde, se usa la plantilla.
  }
  return plantillaPrimerMensaje(p.nombre, rubro);
}

/** Primer mensaje de respaldo: una de las plantillas de la línea del rubro. */
export function plantillaPrimerMensaje(nombre: string, rubro: string): string {
  return plantillaPara(lineaDeRubro(rubro) ?? "a_medida", nombre, rubro);
}
