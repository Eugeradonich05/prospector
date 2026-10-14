import type { EstadoProspecto, Mensaje, Prospecto } from "@/lib/dominio/tipos";

/** Lo que decide el bot ante un mensaje entrante. */
export type Decision = {
  mensaje: string;
  estado: EstadoProspecto | null;
  derivar: boolean;
  motivo: string | null;
  datos: Record<string, string>;
};

export type ContextoConversacion = {
  prospecto: Pick<Prospecto, "nombre" | "rubro" | "ciudad" | "datos">;
  historial: Pick<Mensaje, "direccion" | "texto" | "tipo">[];
  esPrimeraRespuestaDelBot: boolean;
};

export interface Cerebro {
  decidir(ctx: ContextoConversacion): Promise<Decision>;
}

const ROTULO = { entrante: "Negocio", bot: "Asistente", humano: "Eugenio" } as const;

/** Arma la transcripción que lee el modelo. Se pasa como texto para no depender del orden de roles. */
export function transcripcion(ctx: ContextoConversacion): string {
  const lineas = ctx.historial.map((m) => {
    const texto = m.texto ?? (m.tipo === "text" ? "" : `[envió un ${m.tipo}]`);
    return `[${ROTULO[m.direccion]}]: ${texto}`;
  });
  const datos = Object.entries(ctx.prospecto.datos ?? {})
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("; ");
  return [
    `NEGOCIO: ${ctx.prospecto.nombre} (${ctx.prospecto.rubro ?? "rubro desconocido"}, ${ctx.prospecto.ciudad ?? "ciudad desconocida"})`,
    datos ? `LO QUE YA SABEMOS: ${datos}` : "LO QUE YA SABEMOS: nada todavía",
    ctx.esPrimeraRespuestaDelBot ? "ES TU PRIMERA RESPUESTA en esta conversación." : "Ya te presentaste antes; no lo repitas.",
    "",
    "CONVERSACIÓN (la más vieja primero):",
    ...lineas,
    "",
    "Respondé al último mensaje del negocio usando la herramienta responder.",
  ].join("\n");
}

export const ESQUEMA_RESPUESTA = {
  type: "object" as const,
  properties: {
    mensaje: { type: "string", description: "Texto a enviar por WhatsApp. Corto, sin markdown." },
    estado: {
      type: "string",
      enum: ["respondio", "interesado", "demo", "descartado", "no_contactar"],
      description: "Estado del prospecto después de este intercambio.",
    },
    derivar: { type: "boolean", description: "true si Eugenio tiene que seguir la conversación." },
    motivo: { type: "string", description: "Si derivás, por qué (una frase para Eugenio)." },
    datos: {
      type: "object",
      description: "Datos nuevos que aprendiste del negocio. Solo lo que dijeron, sin suponer.",
      properties: {
        alumnos: { type: "string" },
        medios_de_pago: { type: "string" },
        como_registran: { type: "string" },
        atrasos: { type: "string" },
        sistema_actual: { type: "string" },
        contacto: { type: "string", description: "Nombre de la persona que responde, si lo dijo." },
      },
    },
  },
  required: ["mensaje", "estado", "derivar"],
};

/** Valida y normaliza lo que devuelve el modelo (nunca confiar a ciegas). */
export function normalizarDecision(entrada: unknown): Decision {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const estados: EstadoProspecto[] = ["respondio", "interesado", "demo", "descartado", "no_contactar"];
  const estado = estados.includes(e.estado as EstadoProspecto) ? (e.estado as EstadoProspecto) : null;
  const datosCrudos = (e.datos && typeof e.datos === "object" ? e.datos : {}) as Record<string, unknown>;
  const datos: Record<string, string> = {};
  for (const [k, v] of Object.entries(datosCrudos)) {
    if (typeof v === "string" && v.trim() && v.length <= 300) datos[k] = v.trim();
  }
  const mensaje = typeof e.mensaje === "string" ? e.mensaje.trim().slice(0, 1000) : "";
  return {
    mensaje,
    estado,
    derivar: e.derivar === true || !mensaje,
    motivo: typeof e.motivo === "string" && e.motivo.trim() ? e.motivo.trim().slice(0, 300) : null,
    datos,
  };
}
