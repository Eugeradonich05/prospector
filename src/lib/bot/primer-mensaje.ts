import { LINEAS, plantillaPara } from "@/lib/dominio/lineas";
import { ETIQUETA_SISTEMA, type SistemaActual } from "@/lib/dominio/complejos";

/** Lo que se sabe del complejo al redactar el primer mensaje. Lo que falta no se inventa. */
export type DatosPrimerMensaje = {
  nombre: string;
  rubro: string | null;
  ciudad: string | null;
  deportes?: string[] | null;
  sistema_actual?: SistemaActual | null;
  canchas_cantidad?: number | null;
};

const PRESENTACION =
  "Escribís el primer mensaje de WhatsApp que Modo Cancha (plataforma de reservas de canchas online) le manda a un complejo de canchas que no la conoce. " +
  'Escribís como la marca, en primera persona del plural ("te escribimos de Modo Cancha", "armamos"), sin nombres de personas. ' +
  "En una frase contá que en Modo Cancha los jugadores ven los horarios libres, reservan y pagan la seña con Mercado Pago, y el complejo lo maneja todo desde un panel.";

const REGLAS =
  "No pongas montos ni precios en números. " +
  "Castellano rioplatense con voseo, 3 a 4 oraciones, cálido y directo, sin emojis, sin markdown, sin inventar nada sobre el complejo (no digas que viste reseñas, fotos ni su web; usá solo los datos que te paso). " +
  "Que el mensaje sea distinto de una plantilla: usá el nombre del complejo y lo que sabemos de él. Presentate como Modo Cancha. Cerrá con una pregunta simple. Respondé solo con el mensaje.";

/** Cómo encarar el mensaje según lo que sabemos de cómo reservan hoy. */
export function enfoqueSegunSistema(sistema: SistemaActual | null | undefined): string {
  if (sistema === "atc" || sistema === "clubo") {
    return (
      `Ya usan ${ETIQUETA_SISTEMA[sistema]} para las reservas. No critiques ni compares de forma negativa a ${ETIQUETA_SISTEMA[sistema]}: preguntá cómo les va con las reservas, ` +
      "y mencioná en una sola frase que Modo Cancha tiene un precio fijo en pesos sin importar cuántas canchas tengan y que la seña va directo a su cuenta de Mercado Pago."
    );
  }
  if (sistema === "whatsapp_manual" || sistema === "ninguno") {
    return "Objetivo: preguntar cómo toman hoy las reservas (por WhatsApp, por teléfono, anotándolas a mano) y si les pasa que reservan y no vienen.";
  }
  return "Objetivo: preguntar cómo toman hoy las reservas de las canchas (WhatsApp, teléfono, cuaderno o alguna app).";
}

/** De qué deporte hablar: el concreto si lo sabemos; si no, el del rubro. */
export function enfoqueSegunDeportes(deportes: string[] | null | undefined, rubro: string | null): string {
  if (deportes?.length) {
    return `El complejo tiene canchas de ${deportes.join(" y ")}: hablá de ese deporte concreto (por ejemplo «las canchas de ${deportes[0]}»), no de canchas en general.`;
  }
  return `Hablá del deporte del rubro (${rubro ?? "complejo de canchas"}); si es un complejo deportivo, de canchas en general.`;
}

/**
 * Arma el pedido a Claude para el primer mensaje de un complejo. Es puro (sin red) para poder testearlo.
 * Corto, honesto y distinto en cada caso: los textos idénticos a muchos números son lo que WhatsApp detecta como spam.
 */
export function pedidoPrimerMensaje(p: DatosPrimerMensaje): { system: string; user: string } {
  const system = [PRESENTACION, enfoqueSegunSistema(p.sistema_actual), enfoqueSegunDeportes(p.deportes, p.rubro), REGLAS].join(" ");
  const datos = [
    `Complejo: ${p.nombre}.`,
    `Rubro: ${p.rubro ?? "complejo de canchas"}.`,
    `Ciudad: ${p.ciudad ?? "Argentina"}.`,
    p.deportes?.length ? `Deportes: ${p.deportes.join(", ")}.` : null,
    p.canchas_cantidad ? `Cantidad de canchas: ${p.canchas_cantidad}.` : null,
    p.sistema_actual ? `Cómo reservan hoy: ${ETIQUETA_SISTEMA[p.sistema_actual]}.` : null,
    `Lo que ofrecemos: ${LINEAS.canchas.gancho}.`,
  ].filter(Boolean);
  return { system, user: datos.join(" ") };
}

/** Primer mensaje de respaldo, si Claude no responde. */
export function plantillaPrimerMensaje(nombre: string, rubro: string | null): string {
  return plantillaPara(nombre, rubro ?? "complejo deportivo");
}

/** Acepta lo que devolvió Claude solo si tiene un largo razonable. */
export function textoAceptable(texto: string): boolean {
  return texto.length > 40 && texto.length < 700;
}
