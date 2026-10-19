import type { Almacen } from "@/lib/datos/almacen";
import type { Cerebro } from "./cerebro";
import type { CanalWhatsApp } from "@/lib/whatsapp/enviar";
import type { EventoWhatsApp } from "@/lib/whatsapp/webhook";
import type { Prospecto } from "@/lib/dominio/tipos";
import { normalizarTelefonoAR } from "@/lib/dominio/telefono";
import { esPedidoDeBaja, MENSAJE_BAJA } from "@/lib/dominio/baja";

export type Dependencias = {
  almacen: Almacen;
  canal: CanalWhatsApp;
  cerebro: Cerebro;
  notificar: (p: Prospecto, motivo: string) => Promise<void>;
  ahora: () => Date;
  maxRespuestas: number;
  /** Horas que el bot queda en silencio cuando escribís vos en una conversación en curso. */
  horasPausaHumano?: number;
};

export const MENSAJE_NO_TEXTO = "¡Gracias! Por acá leo solo mensajes de texto. Se lo paso a una persona de Cauce y te responde en breve.";
export const MENSAJE_LIMITE = "Te paso con una persona de Cauce así lo ven directamente. Te escribe en breve.";

/** Procesa un evento del webhook. Devuelve una descripción corta de lo que hizo (para el registro). */
export async function procesarEvento(ev: EventoWhatsApp, d: Dependencias): Promise<string> {
  const telefono = normalizarTelefonoAR(ev.tipo === "entrante" ? ev.de : ev.para);
  if (!telefono) return "teléfono no argentino: ignorado";
  const p = await d.almacen.porTelefono(telefono);
  // El bot solo habla con prospectos de la campaña. Cualquier otro chat de tu número se deja en paz.
  if (!p) return "no es prospecto: ignorado";

  return ev.tipo === "eco" ? procesarEco(ev, p, d) : procesarEntrante(ev, p, d);
}

async function procesarEco(ev: Extract<EventoWhatsApp, { tipo: "eco" }>, p: Prospecto, d: Dependencias): Promise<string> {
  const nuevo = await d.almacen.registrarMensaje({ prospecto_id: p.id, direccion: "humano", tipo: ev.clase, texto: ev.texto, wa_id: ev.waId });
  if (!nuevo) return "eco duplicado";
  const ahora = d.ahora().toISOString();

  if (p.estado === "sin_contactar" || p.estado === "en_tanda") {
    await d.almacen.actualizar(p.id, { estado: "contactado", contactado_el: ahora });
    return "primer mensaje enviado desde la app";
  }
  if (!p.ultimo_entrante_el) {
    // Todavía no contestó: es el recordatorio de seguimiento.
    await d.almacen.actualizar(p.id, { seguimiento_el: ahora });
    return "seguimiento enviado desde la app";
  }
  // Escribiste vos en una conversación en curso: el bot se corre.
  const horas = d.horasPausaHumano ?? 12;
  await d.almacen.actualizar(p.id, { humano_hasta: new Date(d.ahora().getTime() + horas * 3_600_000).toISOString() });
  return `tomaste la conversación: bot en pausa ${horas} h`;
}

async function procesarEntrante(ev: Extract<EventoWhatsApp, { tipo: "entrante" }>, p: Prospecto, d: Dependencias): Promise<string> {
  const nuevo = await d.almacen.registrarMensaje({ prospecto_id: p.id, direccion: "entrante", tipo: ev.clase, texto: ev.texto, wa_id: ev.waId });
  if (!nuevo) return "mensaje duplicado";

  // Copia del estado previo: el almacén puede actualizar el mismo objeto.
  const previo = { estado: p.estado, datos: { ...(p.datos ?? {}) }, bot_activo: p.bot_activo, humano_hasta: p.humano_hasta, necesita_humano: p.necesita_humano };
  const ahora = d.ahora();
  const cambios: Partial<Prospecto> = { ultimo_entrante_el: ahora.toISOString() };
  if (["sin_contactar", "en_tanda", "contactado"].includes(previo.estado)) cambios.estado = "respondio";
  if (ev.nombrePerfil && !previo.datos.contacto) cambios.datos = { ...previo.datos, nombre_perfil: ev.nombrePerfil };
  await d.almacen.actualizar(p.id, cambios);
  const estadoActual = cambios.estado ?? previo.estado;

  if (previo.estado === "no_contactar") return "pidió no ser contactado: sin respuesta";

  // Red de seguridad para pedidos de baja: no depende del modelo.
  if (ev.texto && esPedidoDeBaja(ev.texto)) {
    await enviarYRegistrar(p, MENSAJE_BAJA, d);
    await d.almacen.actualizar(p.id, { estado: "no_contactar", bot_activo: false });
    return "pedido de baja: marcado no contactar";
  }

  if (previo.estado === "cliente" || previo.estado === "descartado") {
    await derivar(p, `Volvió a escribir (estado: ${previo.estado}).`, d);
    return "escribió un prospecto cerrado: derivado sin respuesta";
  }
  if (!previo.bot_activo) return "bot apagado para este prospecto";
  if (previo.humano_hasta && new Date(previo.humano_hasta) > ahora) return "conversación en manos de Eugenio";
  if (previo.necesita_humano) return "esperando a Eugenio";

  if (ev.clase !== "text" && ev.clase !== "button" && ev.clase !== "interactive") {
    await enviarYRegistrar(p, MENSAJE_NO_TEXTO, d);
    await derivar(p, `Mandó un ${ev.clase}: escuchalo/miralo y respondé vos.`, d);
    return `mensaje tipo ${ev.clase}: derivado`;
  }

  const respuestas = await d.almacen.contarRespuestasBot(p.id);
  if (respuestas >= d.maxRespuestas) {
    await enviarYRegistrar(p, MENSAJE_LIMITE, d);
    await derivar(p, `El bot ya respondió ${respuestas} veces: seguí vos.`, d);
    return "límite de respuestas: derivado";
  }

  let decision;
  try {
    const historial = await d.almacen.historial(p.id, 30);
    decision = await d.cerebro.decidir({
      prospecto: { nombre: p.nombre, rubro: p.rubro, ciudad: p.ciudad, datos: { ...previo.datos, ...(cambios.datos ?? {}) } },
      historial,
      esPrimeraRespuestaDelBot: respuestas === 0,
    });
  } catch (e) {
    await derivar(p, `El bot no pudo pensar una respuesta (${e instanceof Error ? e.message : "error"}).`, d);
    return "error del modelo: derivado sin respuesta";
  }

  if (decision.mensaje) await enviarYRegistrar(p, decision.mensaje, d);

  const final: Partial<Prospecto> = { datos: { ...previo.datos, ...(cambios.datos ?? {}), ...decision.datos } };
  if (decision.estado) final.estado = decision.estado;
  if (decision.estado === "descartado" || decision.estado === "no_contactar") final.bot_activo = false;
  await d.almacen.actualizar(p.id, final);

  if (decision.derivar) {
    await derivar(p, decision.motivo ?? "El bot pidió que sigas vos.", d);
    return `respondió y derivó (${decision.estado ?? estadoActual})`;
  }
  return `respondió (${decision.estado ?? estadoActual})`;
}

async function enviarYRegistrar(p: Prospecto, texto: string, d: Dependencias) {
  try {
    const { id } = await d.canal.enviarTexto(p.telefono_wa!, texto);
    await d.almacen.registrarMensaje({ prospecto_id: p.id, direccion: "bot", tipo: "text", texto, wa_id: id });
  } catch (e) {
    await derivar(p, `No se pudo enviar la respuesta del bot: ${e instanceof Error ? e.message : "error"}`, d);
  }
}

async function derivar(p: Prospecto, motivo: string, d: Dependencias) {
  await d.almacen.actualizar(p.id, { necesita_humano: true, motivo_humano: motivo });
  await d.notificar(p, motivo).catch(() => undefined);
}
