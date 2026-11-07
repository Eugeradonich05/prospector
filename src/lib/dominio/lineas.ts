/**
 * Prospector vende un solo producto: Modo Cancha (reservas de canchas online) a complejos deportivos.
 * Este módulo decide qué rubros entran en la base y arma los textos de respaldo (primer mensaje,
 * seguimiento y guion de llamada) cuando Claude no responde.
 */

export type Linea = "canchas";

/** Link de la prueba gratis de Modo Cancha (el complejo se registra solo). Se puede cambiar con LINK_PRUEBA_GRATIS. */
export const LINK_MODO_CANCHA = "https://www.modocanchas.com/prueba-gratis";

/** Web de Modo Cancha. Se puede cambiar con LINK_SITIO. */
export const SITIO_MODO_CANCHA = "https://www.modocanchas.com";

export function marcaDe(_linea?: Linea): "Modo Cancha" {
  return "Modo Cancha";
}

export type InfoLinea = {
  /** Nombre corto para el panel. */
  etiqueta: string;
  /** Qué ofrece Modo Cancha, en una frase (para el primer mensaje y el guion de llamada). */
  gancho: string;
  /** Pregunta de apertura: sobre cómo lo hacen hoy, no sobre el producto. */
  pregunta: string;
  /** Primeros mensajes de respaldo si Claude no responde. Se elige uno por complejo. */
  plantillas: ((nombre: string, rubro: string) => string)[];
  /** Único recordatorio a los 3 días. */
  seguimiento: (nombre: string, linkPrueba: string) => string;
};

export const LINEAS: Record<Linea, InfoLinea> = {
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
    seguimiento: (n, link) =>
      `Hola de nuevo! Les escribimos de Modo Cancha una sola vez más por lo de las reservas de ${n}. Si quieren verlo, el primer mes es de prueba gratis: ${link}. Si no es buen momento, ningún problema y no los molestamos más. ¡Éxitos!`,
  },
};

export function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Rubros de complejos que alquilan canchas. Cualquier otro rubro se rechaza al cargar. */
const CANCHAS = /cancha|padel|paddle|futbol|futsal|tenis|squash|complejo deportivo|beach voley|voley|basquet|hockey/;

/** Rubros que se pueden elegir al cargar un complejo a mano. */
export const RUBROS_CANCHAS = ["Complejo de fútbol", "Pádel", "Tenis", "Complejo deportivo"] as const;

export function esRubroDeCanchas(rubro: string | null | undefined): boolean {
  return CANCHAS.test(sinTildes(rubro ?? ""));
}

/** Línea de un rubro: "canchas" si es un complejo de canchas, null si no corresponde a Modo Cancha. */
export function lineaDeRubro(rubro: string | null | undefined): Linea | null {
  return esRubroDeCanchas(rubro) ? "canchas" : null;
}

/** "Pádel" → "complejos de pádel"; "Complejo deportivo" → "complejos deportivos". Para frases tipo "para complejos de pádel". */
export function articuloRubro(rubro: string): string {
  const r = rubro.trim().toLowerCase();
  if (!r) return "complejos como el tuyo";
  const especiales: Record<string, string> = {
    pádel: "complejos de pádel",
    padel: "complejos de pádel",
    tenis: "complejos de tenis",
    "complejo deportivo": "complejos deportivos",
    "complejo de fútbol": "complejos de fútbol",
  };
  if (especiales[r]) return especiales[r]!;
  const plural = (p: string) => (/[aeiouáéó]$/.test(p) ? `${p}s` : /z$/.test(p) ? `${p.slice(0, -1)}ces` : `${p}es`);
  const [primera, ...resto] = r.split(" ");
  return [plural(primera!), ...resto].join(" ");
}

/** Guion corto para llamar por teléfono cuando el número no tiene WhatsApp (suele ser un fijo). */
export function guionLlamada(nombre: string): string {
  const { gancho, pregunta } = LINEAS.canchas;
  const preguntaMayuscula = pregunta.replace(/^¿(.)/, (_, c: string) => `¿${c.toUpperCase()}`);
  return `Hola, ¿hablo con ${nombre}? Te llamo de Modo Cancha. Armamos ${gancho}. ${preguntaMayuscula} Si te interesa, ¿a qué WhatsApp o mail te mandamos la info?`;
}

/** Elige una de las plantillas de forma estable para cada complejo (así dos seguidos no reciben el mismo texto). */
export function plantillaPara(nombre: string, rubro: string): string {
  const opciones = LINEAS.canchas.plantillas;
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return opciones[h % opciones.length]!(nombre, rubro);
}
