import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { procesarEvento, MENSAJE_NO_TEXTO, MENSAJE_LIMITE, type Dependencias } from "@/lib/bot/manejar";
import { almacenEnMemoria } from "@/lib/datos/almacen";
import { parsearWebhook, firmaMetaValida, type EventoWhatsApp } from "@/lib/whatsapp/webhook";
import { elegirTanda, seguimientosPendientes } from "@/lib/dominio/tandas";
import { esPedidoDeBaja, MENSAJE_BAJA } from "@/lib/dominio/baja";
import { normalizarDecision, transcripcion, type Cerebro, type Decision } from "@/lib/bot/cerebro";
import { normalizarTelefonoAR } from "@/lib/dominio/telefono";
import type { Prospecto } from "@/lib/dominio/tipos";

const AHORA = new Date("2026-10-15T14:00:00Z");

function prospecto(cambios: Partial<Prospecto> = {}): Prospecto {
  return {
    id: "p1", nombre: "Josefina Estudio", rubro: "Pilates", ciudad: "Rosario", provincia: "Santa Fe", direccion: null,
    telefono: "+54 341 691-0835", telefono_wa: "5493416910835", prioridad: "A", resenas: 254, calificacion: 5, maps_url: null,
    estado: "contactado", tanda_fecha: "2026-10-14", mensaje_inicial: "Hola!", contactado_el: "2026-10-14T13:00:00Z",
    seguimiento_el: null, ultimo_entrante_el: null, bot_activo: true, humano_hasta: null, necesita_humano: false,
    motivo_humano: null, datos: {}, notas: null, creado: "2026-10-14T00:00:00Z", ...cambios,
  };
}

function entorno(p: Prospecto, decision?: Partial<Decision>, opciones: { falla?: boolean } = {}) {
  const almacen = almacenEnMemoria([p]);
  const enviados: string[] = [];
  const avisos: string[] = [];
  let n = 0;
  const cerebro: Cerebro = {
    decidir: vi.fn(async () => {
      if (opciones.falla) throw new Error("timeout");
      return { mensaje: "¡Hola! Soy el asistente de Eugenio. ¿Cuántos alumnos tienen?", estado: "respondio", derivar: false, motivo: null, datos: {}, ...decision } as Decision;
    }),
  };
  const d: Dependencias = {
    almacen,
    canal: { enviarTexto: async (_para, texto) => (enviados.push(texto), { id: `wamid.bot${++n}` }) },
    cerebro,
    notificar: async (_p, motivo) => void avisos.push(motivo),
    ahora: () => AHORA,
    maxRespuestas: 3,
  };
  return { d, almacen, enviados, avisos, cerebro };
}

const entrante = (texto: string | null, waId = "wamid.in1", clase = "text"): EventoWhatsApp => ({
  tipo: "entrante", de: "5493416910835", waId, momento: 1, clase, texto, nombrePerfil: "Jose",
});

describe("conversación del bot", () => {
  it("responde a un prospecto contactado y lo pasa a 'respondió'", async () => {
    const p = prospecto();
    const { d, enviados, almacen } = entorno(p);
    const r = await procesarEvento(entrante("Hola, sí, contame"), d);
    expect(r).toMatch(/respondió/);
    expect(enviados).toHaveLength(1);
    expect(p.estado).toBe("respondio");
    expect(p.ultimo_entrante_el).toBe(AHORA.toISOString());
    expect(almacen.mensajes.map((m) => m.direccion)).toEqual(["entrante", "bot"]);
  });

  it("ignora chats de gente que no está en la campaña", async () => {
    const { d, enviados } = entorno(prospecto());
    const r = await procesarEvento({ ...entrante("hola"), de: "5491100000000" } as EventoWhatsApp, d);
    expect(r).toMatch(/no es prospecto/);
    expect(enviados).toHaveLength(0);
  });

  it("no procesa dos veces el mismo mensaje (reintentos de Meta)", async () => {
    const { d, enviados } = entorno(prospecto());
    await procesarEvento(entrante("hola"), d);
    const r = await procesarEvento(entrante("hola"), d);
    expect(r).toBe("mensaje duplicado");
    expect(enviados).toHaveLength(1);
  });

  it("ante un pedido de baja responde una vez y no vuelve a escribir", async () => {
    const p = prospecto();
    const { d, enviados, cerebro } = entorno(p);
    await procesarEvento(entrante("No me interesa, gracias"), d);
    expect(enviados).toEqual([MENSAJE_BAJA]);
    expect(p.estado).toBe("no_contactar");
    expect(cerebro.decidir).not.toHaveBeenCalled();
    const r = await procesarEvento(entrante("???", "wamid.in2"), d);
    expect(r).toMatch(/no ser contactado/);
    expect(enviados).toHaveLength(1);
  });

  it("deriva audios e imágenes a Eugenio", async () => {
    const p = prospecto();
    const { d, enviados, avisos } = entorno(p);
    await procesarEvento(entrante(null, "wamid.a", "audio"), d);
    expect(enviados).toEqual([MENSAJE_NO_TEXTO]);
    expect(p.necesita_humano).toBe(true);
    expect(avisos[0]).toMatch(/audio/);
  });

  it("deriva cuando el modelo lo pide, guarda los datos y no responde más hasta que intervengas", async () => {
    const p = prospecto();
    const { d, enviados, avisos } = entorno(p, { estado: "interesado", derivar: true, motivo: "Quiere arrancar la prueba", datos: { alumnos: "120" } });
    await procesarEvento(entrante("Dale, quiero probarlo"), d);
    expect(p.estado).toBe("interesado");
    expect(p.datos.alumnos).toBe("120");
    expect(p.necesita_humano).toBe(true);
    expect(avisos).toEqual(["Quiere arrancar la prueba"]);
    await procesarEvento(entrante("¿Hola?", "wamid.in2"), d);
    expect(enviados).toHaveLength(1);
  });

  it("si escribiste vos en la conversación, el bot se calla 12 horas", async () => {
    const p = prospecto({ estado: "respondio", ultimo_entrante_el: "2026-10-15T13:00:00Z" });
    const { d, enviados } = entorno(p);
    const r = await procesarEvento({ tipo: "eco", para: "5493416910835", waId: "wamid.eco1", momento: 1, clase: "text", texto: "Hola, soy Eugenio" }, d);
    expect(r).toMatch(/pausa 12 h/);
    await procesarEvento(entrante("Buenísimo"), d);
    expect(enviados).toHaveLength(0);
  });

  it("el primer mensaje enviado desde la app marca al prospecto como contactado", async () => {
    const p = prospecto({ estado: "en_tanda", contactado_el: null });
    const { d } = entorno(p);
    await procesarEvento({ tipo: "eco", para: "5493416910835", waId: "wamid.eco1", momento: 1, clase: "text", texto: "Hola!" }, d);
    expect(p.estado).toBe("contactado");
    expect(p.contactado_el).toBe(AHORA.toISOString());
    expect(p.humano_hasta).toBeNull();
  });

  it("un segundo mensaje tuyo sin respuesta cuenta como seguimiento, no como toma de control", async () => {
    const p = prospecto();
    const { d } = entorno(p);
    await procesarEvento({ tipo: "eco", para: "5493416910835", waId: "wamid.eco2", momento: 1, clase: "text", texto: "Hola de nuevo!" }, d);
    expect(p.seguimiento_el).toBe(AHORA.toISOString());
    expect(p.humano_hasta).toBeNull();
  });

  it("corta en el límite de respuestas y deriva", async () => {
    const p = prospecto();
    const { d, enviados } = entorno(p);
    for (let i = 1; i <= 4; i++) await procesarEvento(entrante(`mensaje ${i}`, `wamid.in${i}`), d);
    expect(enviados).toHaveLength(4);
    expect(enviados[3]).toBe(MENSAJE_LIMITE);
    expect(p.necesita_humano).toBe(true);
  });

  it("si el modelo falla, no manda nada raro y te avisa", async () => {
    const p = prospecto();
    const { d, enviados, avisos } = entorno(p, undefined, { falla: true });
    await procesarEvento(entrante("hola"), d);
    expect(enviados).toHaveLength(0);
    expect(avisos[0]).toMatch(/no pudo pensar/);
  });

  it("al descartarse, el bot cierra y se apaga para ese prospecto", async () => {
    const p = prospecto();
    const { d } = entorno(p, { mensaje: "Gracias igual, éxitos!", estado: "descartado" });
    await procesarEvento(entrante("Ya usamos otro sistema y andamos bien"), d);
    expect(p.estado).toBe("descartado");
    expect(p.bot_activo).toBe(false);
  });
});

describe("webhook de WhatsApp", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: "5493416910835", profile: { name: "Jose" } }],
              messages: [{ from: "5493416910835", id: "wamid.A", timestamp: "1760536800", type: "text", text: { body: "Hola" } }],
              statuses: [{ id: "x", status: "read" }],
            },
          },
          {
            field: "smb_message_echoes",
            value: { message_echoes: [{ from: "5493410000000", to: "5493416910835", id: "wamid.B", timestamp: "1760536900", type: "text", text: { body: "Hola!" } }] },
          },
        ],
      },
    ],
  };

  it("separa mensajes entrantes y ecos de la app", () => {
    expect(parsearWebhook(payload)).toEqual([
      { tipo: "entrante", de: "5493416910835", waId: "wamid.A", momento: 1760536800, clase: "text", texto: "Hola", nombrePerfil: "Jose" },
      { tipo: "eco", para: "5493416910835", waId: "wamid.B", momento: 1760536900, clase: "text", texto: "Hola!" },
    ]);
  });

  it("ignora payloads que no son de WhatsApp", () => {
    expect(parsearWebhook({ object: "page" })).toEqual([]);
    expect(parsearWebhook(null)).toEqual([]);
  });

  it("valida la firma de Meta", () => {
    const cuerpo = JSON.stringify(payload);
    const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
    expect(firmaMetaValida(cuerpo, firma, "secreto")).toBe(true);
    expect(firmaMetaValida(cuerpo + " ", firma, "secreto")).toBe(false);
    expect(firmaMetaValida(cuerpo, firma, "otro")).toBe(false);
    expect(firmaMetaValida(cuerpo, null, "secreto")).toBe(false);
  });

  it("acepta celulares argentinos con y sin el 9", () => {
    expect(normalizarTelefonoAR("5493416910835")).toBe("5493416910835");
    expect(normalizarTelefonoAR("543416910835")).toBe("5493416910835");
    expect(normalizarTelefonoAR("+54 341 691-0835")).toBe("5493416910835");
  });
});

describe("tandas", () => {
  const base = (id: string, ciudad: string, prioridad: "A" | "B" | "C", resenas = 50, estado: Prospecto["estado"] = "sin_contactar") => ({
    id, ciudad, prioridad, resenas, estado, telefono_wa: "5493410000000",
  });

  it("prioriza A, reparte entre ciudades y respeta el límite", () => {
    const c = [base("b1", "Rosario", "B"), base("a1", "Rosario", "A", 10), base("a2", "Rosario", "A", 80), base("a3", "Rosario", "A"), base("a4", "Córdoba", "A"), base("x", "Salta", "A", 99, "contactado")];
    // Rosario tiene cupo 2: entran sus dos A con más reseñas; después Córdoba; el B de Rosario queda afuera.
    expect(elegirTanda(c, { limite: 4, maxPorCiudad: 2 })).toEqual(["a2", "a3", "a4"]);
    expect(elegirTanda(c, { limite: 2, maxPorCiudad: 5 })).toEqual(["a2", "a3"]);
  });

  it("no incluye prospectos sin WhatsApp", () => {
    expect(elegirTanda([{ ...base("s", "Rosario", "A"), telefono_wa: null }], { limite: 5, maxPorCiudad: 5 })).toEqual([]);
  });

  it("propone un solo seguimiento a los 3 días sin respuesta", () => {
    const p = (id: string, contactado: string, extra = {}) => ({ id, estado: "contactado" as const, contactado_el: contactado, seguimiento_el: null, ultimo_entrante_el: null, ...extra });
    const lista = [
      p("viejo", "2026-10-11T12:00:00Z"),
      p("reciente", "2026-10-14T12:00:00Z"),
      p("ya-seguido", "2026-10-10T12:00:00Z", { seguimiento_el: "2026-10-13T12:00:00Z" }),
      p("respondio", "2026-10-10T12:00:00Z", { ultimo_entrante_el: "2026-10-11T12:00:00Z" }),
    ];
    expect(seguimientosPendientes(lista, AHORA)).toEqual(["viejo"]);
  });
});

describe("bajas", () => {
  it.each(["No me interesa", "no nos interesa gracias", "No estoy interesada", "Por favor no me escriban más", "Dejá de mandar mensajes", "BAJA", "stop", "No, gracias", "esto es spam"])("detecta: %s", (t) => {
    expect(esPedidoDeBaja(t)).toBe(true);
  });
  it.each(["Hola, sí me interesa", "¿Cuánto sale?", "No sé cuántos alumnos tenemos", "no tenemos sistema", "Gracias por escribir"])("no confunde: %s", (t) => {
    expect(esPedidoDeBaja(t)).toBe(false);
  });
});

describe("salida del modelo", () => {
  it("normaliza y descarta valores inválidos", () => {
    expect(normalizarDecision({ mensaje: "  Hola ", estado: "cliente", derivar: "si", datos: { alumnos: "80", basura: 3 } })).toEqual({
      mensaje: "Hola", estado: null, derivar: false, motivo: null, datos: { alumnos: "80" },
    });
  });
  it("sin mensaje, deriva", () => {
    expect(normalizarDecision(null).derivar).toBe(true);
  });
  it("arma la transcripción con roles claros", () => {
    const t = transcripcion({
      prospecto: { nombre: "Josefina Estudio", rubro: "Pilates", ciudad: "Rosario", datos: { alumnos: "120" } },
      historial: [
        { direccion: "humano", texto: "Hola!", tipo: "text" },
        { direccion: "entrante", texto: null, tipo: "audio" },
        { direccion: "entrante", texto: "Contame", tipo: "text" },
      ],
      esPrimeraRespuestaDelBot: true,
    });
    expect(t).toContain("[Eugenio]: Hola!");
    expect(t).toContain("[Negocio]: [envió un audio]");
    expect(t).toContain("alumnos: 120");
    expect(t).toContain("ES TU PRIMERA RESPUESTA");
  });
});

import { leerMensajeSignup } from "@/lib/whatsapp/conexion";

describe("asistente de conexión de Meta", () => {
  const ok = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { waba_id: "111", phone_number_id: "222" } };
  it("lee el fin de la conexión con coexistencia", () => {
    expect(leerMensajeSignup("https://www.facebook.com", ok)).toEqual({ wabaId: "111", phoneNumberId: "222", evento: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", error: null });
    expect(leerMensajeSignup("https://web.facebook.com", JSON.stringify(ok))?.wabaId).toBe("111");
  });
  it("ignora mensajes de otros orígenes o de otro tipo", () => {
    expect(leerMensajeSignup("https://facebook.com.evil.com", ok)).toBeNull();
    expect(leerMensajeSignup("https://evil.com", ok)).toBeNull();
    expect(leerMensajeSignup("https://www.facebook.com", { type: "OTRO" })).toBeNull();
    expect(leerMensajeSignup("https://www.facebook.com", "no es json")).toBeNull();
  });
  it("informa la cancelación", () => {
    expect(leerMensajeSignup("https://www.facebook.com", { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: {} })?.error).toMatch(/cancel/i);
  });
});
