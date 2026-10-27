/**
 * Líneas de servicio de Cauce que se ofrecen por prospección.
 * Cada rubro cae en una línea, y la línea decide el primer mensaje, el seguimiento
 * y lo que el bot ofrece. Modo Cancha (complejos de canchas) tiene su propia línea y su propia
 * pestaña: no se mezcla con las tandas de Cauce (ver `LINEAS_CAUCE`).
 */

export type Linea = "cuotas" | "turnos" | "documentos" | "a_medida" | "canchas";

/** Las líneas de la tanda general de Cauce. Modo Cancha se arma aparte, desde su pestaña. */
export type LineaCauce = Exclude<Linea, "canchas">;
export const LINEAS_CAUCE: LineaCauce[] = ["cuotas", "turnos", "documentos", "a_medida"];

/** Link de la prueba gratis de Modo Cancha (el complejo se registra solo). */
export const LINK_MODO_CANCHA = "https://www.modocanchas.com/prueba-gratis";

/** Marca con la que se presenta cada línea. */
export function marcaDe(linea: Linea): "Cauce" | "Modo Cancha" {
  return linea === "canchas" ? "Modo Cancha" : "Cauce";
}

export type InfoLinea = {
  /** Nombre corto para el panel. */
  etiqueta: string;
  /** Qué le ofrece Cauce a esta línea, en una frase (para el primer mensaje). */
  gancho: string;
  /** Pregunta de apertura: sobre cómo lo hacen hoy, no sobre el producto. */
  pregunta: string;
  /** Primeros mensajes de respaldo si Claude no responde. Se elige uno por prospecto. */
  plantillas: ((nombre: string, rubro: string) => string)[];
  /** Único recordatorio a los 3 días. */
  seguimiento: (nombre: string) => string;
};

export const LINEAS: Record<Linea, InfoLinea> = {
  cuotas: {
    etiqueta: "Cuotas al día",
    gancho: "una herramienta que manda solos los avisos de cuota por WhatsApp con link de Mercado Pago y muestra quién debe",
    pregunta: "¿cómo cobran hoy las cuotas?",
    plantillas: [
      (n, r) =>
        `Hola! ¿Hablo con ${n}? Te escribimos de Cauce, de Rosario. Armamos una herramienta para ${articuloRubro(r)} que manda solos los avisos de cuota por WhatsApp con link de Mercado Pago y muestra quién debe. ¿Nos contarías en 10 minutos cómo cobran hoy las cuotas? Nos ayuda mucho a hacerla bien.`,
      (n) =>
        `Hola, ¿qué tal? ¿Es ${n}? Te escribimos de Cauce (Rosario). Trabajamos con estudios y gimnasios que pierden tiempo reclamando cuotas: los avisos salen solos por WhatsApp y el pago se marca solo. ¿Cómo lo manejan ustedes hoy?`,
    ],
    seguimiento: (n) => `Hola de nuevo! Les escribimos de Cauce una sola vez más por lo de las cuotas de ${n}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
  turnos: {
    etiqueta: "Turnos por WhatsApp",
    gancho: "un asistente de WhatsApp que contesta precios y horarios, agenda y cancela turnos en el calendario y manda el recordatorio",
    pregunta: "¿cómo manejan hoy los turnos y las consultas por WhatsApp?",
    plantillas: [
      (n, r) =>
        `Hola! ¿Hablo con ${n}? Te escribimos de Cauce, de Rosario. Armamos asistentes de WhatsApp para ${articuloRubro(r)}: contestan precios y horarios, agendan el turno en el calendario y mandan el recordatorio, y si algo se complica te pasan la charla. ¿Cómo manejan hoy los turnos?`,
      (n) =>
        `Hola, ¿qué tal? ¿Es ${n}? Te escribimos de Cauce (Rosario). Una pregunta corta: ¿cuántos mensajes por día les llegan preguntando precios o pidiendo turno? Armamos un asistente que los responde y agenda solo, y queremos entender cómo lo hacen hoy.`,
    ],
    seguimiento: (n) => `Hola de nuevo! Les escribimos de Cauce una sola vez más por lo de los turnos de ${n}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
  documentos: {
    etiqueta: "Documentos y avisos",
    gancho:
      "un buscador para estudios con muchos PDF y expedientes: preguntás en tus palabras y responde con la cita exacta (documento y página), aunque esté escaneado",
    pregunta: "¿cuánto tiempo se les va buscando un dato en expedientes o documentación?",
    plantillas: [
      (n, r) =>
        `Hola! ¿Hablo con ${n}? Te escribimos de Cauce, de Rosario. Armamos un buscador para ${articuloRubro(r)}: le preguntás en tus palabras y te responde con la cita exacta, documento y página, aunque el PDF esté escaneado. ¿Cuánto tiempo se les va hoy buscando un dato en la documentación?`,
      (n) =>
        `Hola, ¿qué tal? ¿Es ${n}? Te escribimos de Cauce (Rosario). Automatizamos tareas repetitivas en estudios: buscar datos en expedientes y PDF, avisos de vencimientos a clientes, reportes. ¿Hay algo de eso que hoy les saque mucho tiempo?`,
    ],
    seguimiento: (n) => `Hola de nuevo! Les escribimos de Cauce una sola vez más por lo que te comenté para ${n}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
  a_medida: {
    etiqueta: "Automatización a medida",
    gancho: "automatizaciones a medida: respuestas por WhatsApp a las consultas de siempre, avisos que salen solos (vencimientos, «ya está listo») y reportes del mes",
    pregunta: "¿qué tarea repiten todos los días que les gustaría que se haga sola?",
    plantillas: [
      (n, r) =>
        `Hola! ¿Hablo con ${n}? Te escribimos de Cauce, de Rosario. Automatizamos tareas repetitivas para ${articuloRubro(r)}: respuestas por WhatsApp a las consultas de siempre, avisos que salen solos y reportes del mes. ¿Qué es lo que más tiempo les saca hoy?`,
      (n) =>
        `Hola, ¿qué tal? ¿Es ${n}? Te escribimos de Cauce (Rosario). Ayudamos a negocios a que lo repetitivo se haga solo: contestar las mismas consultas, avisar a los clientes, armar planillas. ¿Hay alguna tarea así que les gustaría sacarse de encima?`,
    ],
    seguimiento: (n) => `Hola de nuevo! Les escribimos de Cauce una sola vez más por lo de automatizar tareas en ${n}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
  canchas: {
    etiqueta: "Modo Cancha",
    gancho:
      "Modo Cancha, una plataforma de reservas online: los jugadores ven los horarios libres, reservan y pagan la seña con Mercado Pago, y el complejo maneja canchas, precios y reservas desde un panel",
    pregunta: "¿cómo toman hoy las reservas de las canchas?",
    plantillas: [
      (n, r) =>
        `Hola! ¿Hablo con ${n}? Te escribimos de Modo Cancha. Armamos una plataforma para ${articuloRubro(r)} donde los jugadores ven los horarios libres, reservan y pagan la seña con Mercado Pago, sin llamar ni escribir. ¿Cómo toman hoy las reservas?`,
      (n) =>
        `Hola, ¿qué tal? ¿Es ${n}? Te escribimos de Modo Cancha. Una pregunta corta: ¿las reservas les llegan por WhatsApp y las anotan a mano? Armamos un sistema donde el jugador reserva solo y deja la seña pagada con Mercado Pago, y queremos saber cómo lo manejan ustedes.`,
    ],
    seguimiento: (n) =>
      `Hola de nuevo! Les escribimos de Modo Cancha una sola vez más por lo de las reservas de ${n}. Si quieren verlo, la prueba es gratis: ${LINK_MODO_CANCHA}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
};

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Complejos de canchas: línea Modo Cancha. */
const CANCHAS = /cancha|padel|paddle|futbol|futsal|tenis|squash|complejo deportivo|beach voley/;

const REGLAS: [RegExp, Linea][] = [
  [/pilates|gimnasio|gym|funcional|crossfit|yoga|danza|baile|artes marciales|karate|taekwondo|judo|boxeo|natacion|academia|escuela de musica|idiomas|ingles/, "cuotas"],
  [/peluq|barber|estetica|spa|unas|manicur|depil|cosmet|odonto|dental|dentist|kinesi|fisiot|consultorio|nutric|psicolog|veterin|masaj|podolog|tatuaj|tattoo/, "turnos"],
  [/juridic|abogad|contab|contador|escriban|notari|estudio/, "documentos"],
];

/** Línea de un rubro. Los complejos de canchas van a Modo Cancha; lo que no encaja en nada, a medida. */
export function lineaDeRubro(rubro: string | null | undefined): Linea {
  const r = sinTildes(rubro ?? "");
  if (CANCHAS.test(r)) return "canchas";
  for (const [patron, linea] of REGLAS) if (patron.test(r)) return linea;
  return "a_medida";
}

/** "Peluquería" → "peluquerías"; "Estudio contable" → "estudios contables". Para frases tipo "para peluquerías". */
export function articuloRubro(rubro: string): string {
  const r = rubro.trim().toLowerCase();
  if (!r) return "negocios como el tuyo";
  if (r.includes("/")) return `estudios de ${r.split("/")[0]!.trim()}`;
  const plural = (p: string) => (/[aeiouáéó]$/.test(p) ? `${p}s` : /z$/.test(p) ? `${p.slice(0, -1)}ces` : `${p}es`);
  const especiales: Record<string, string> = {
    pilates: "estudios de pilates",
    odontología: "consultorios odontológicos",
    kinesiología: "consultorios de kinesiología",
    estética: "centros de estética",
    danza: "estudios de danza",
    yoga: "estudios de yoga",
    "artes marciales": "academias de artes marciales",
    "taller mecánico": "talleres mecánicos",
    "estudio jurídico": "estudios jurídicos",
    "estudio contable": "estudios contables",
    pádel: "complejos de pádel",
    padel: "complejos de pádel",
    "complejo deportivo": "complejos deportivos",
    "complejo de fútbol": "complejos de fútbol",
  };
  if (especiales[r]) return especiales[r]!;
  const [primera, ...resto] = r.split(" ");
  return [plural(primera!), ...resto].join(" ");
}

/** Elige una de las plantillas de forma estable para cada negocio (así dos negocios seguidos no reciben el mismo texto). */
export function plantillaPara(linea: Linea, nombre: string, rubro: string): string {
  const opciones = LINEAS[linea].plantillas;
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return opciones[h % opciones.length]!(nombre, rubro);
}
