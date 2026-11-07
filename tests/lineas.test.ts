import { describe, expect, it } from "vitest";
import { LINEAS, articuloRubro, esRubroDeCanchas, guionLlamada, lineaDeRubro, marcaDe, plantillaPara } from "@/lib/dominio/lineas";
import { elegirTanda, enZona, mensajeSeguimiento, zonaATexto, zonaDesdeTexto, type Zona } from "@/lib/dominio/tandas";
import { PRECIOS_PLANES, instrucciones } from "@/lib/bot/conocimiento";

describe("rubros de canchas", () => {
  it("acepta complejos de canchas", () => {
    for (const r of ["Pádel", "Complejo de fútbol", "Complejo deportivo", "Canchas de tenis", "Fútbol 5", "Squash"]) {
      expect(esRubroDeCanchas(r)).toBe(true);
      expect(lineaDeRubro(r)).toBe("canchas");
    }
  });

  it("rechaza todo lo que no es de canchas", () => {
    for (const r of ["Pilates", "Peluquería", "Estudio jurídico", "Inmobiliaria", "Gimnasio", "", null]) {
      expect(esRubroDeCanchas(r)).toBe(false);
      expect(lineaDeRubro(r)).toBeNull();
    }
  });

  it("la marca es siempre Modo Cancha", () => {
    expect(marcaDe()).toBe("Modo Cancha");
    expect(marcaDe("canchas")).toBe("Modo Cancha");
  });
});

describe("mensajes de respaldo", () => {
  it("hay al menos dos primeros mensajes distintos que nombran al complejo, sin precios ni Cauce", () => {
    const textos = LINEAS.canchas.plantillas.map((f) => f("La Bombonera 5", "Complejo de fútbol"));
    expect(textos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(textos).size).toBe(textos.length);
    for (const t of textos) {
      expect(t).toContain("La Bombonera 5");
      expect(t).toContain("Modo Cancha");
      expect(t).not.toMatch(/Cauce|Eugenio/);
      expect(t).not.toMatch(/\$\s?\d/);
      expect(t.length).toBeLessThan(500);
    }
    expect(LINEAS.canchas.plantillas[0]!("X", "Pádel")).toMatch(/complejos de pádel.*seña/);
  });

  it("arma un guion de llamada como Modo Cancha", () => {
    const g = guionLlamada("La Bombonera 5");
    expect(g).toContain("Te llamo de Modo Cancha");
    expect(g).toContain("¿Cómo toman hoy las reservas de las canchas?");
    expect(g).not.toMatch(/\$\s?\d|Cauce/);
  });

  it("elige la plantilla de forma estable por complejo", () => {
    expect(plantillaPara("Pádel Norte", "Pádel")).toBe(plantillaPara("Pádel Norte", "Pádel"));
  });

  it("el seguimiento es uno solo, con la prueba gratis y salida fácil", () => {
    expect(mensajeSeguimiento("La Bombonera 5")).toMatch(/Modo Cancha.*reservas.*prueba gratis.*prueba-gratis.*no los molestamos más/);
    expect(mensajeSeguimiento("X", "https://x.test/prueba")).toContain("https://x.test/prueba");
  });

  it("los avisos automáticos del bot salen a nombre de Modo Cancha", async () => {
    const { MENSAJE_NO_TEXTO, MENSAJE_LIMITE } = await import("@/lib/bot/manejar");
    for (const t of [MENSAJE_NO_TEXTO, MENSAJE_LIMITE]) {
      expect(t).toContain("Modo Cancha");
      expect(t).not.toMatch(/Cauce|Eugenio/);
    }
  });

  it("pone los rubros en plural para las frases", () => {
    expect(articuloRubro("Pádel")).toBe("complejos de pádel");
    expect(articuloRubro("Complejo deportivo")).toBe("complejos deportivos");
    expect(articuloRubro("Complejo de fútbol")).toBe("complejos de fútbol");
    expect(articuloRubro("")).toBe("complejos como el tuyo");
  });
});

describe("conocimiento del bot", () => {
  const texto = instrucciones({ linkPrueba: "https://x.test/prueba", linkSitio: "https://x.test" });

  it("habla como Modo Cancha y nunca de Cauce", () => {
    expect(texto).toMatch(/^Sos el asistente virtual de Modo Cancha\./);
    expect(texto).not.toMatch(/Cauce|Cuotas al día/);
  });

  it("sabe lo que tiene hoy el producto", () => {
    for (const f of ["paga la seña con Mercado Pago", "recordatorio por email", "Tienda integrada", "Estadísticas", "si pide seña y de cuánto", "nunca pasa por Modo Cancha"]) {
      expect(texto).toContain(f);
    }
  });

  it("da los precios de los planes con el primer mes gratis", () => {
    expect(PRECIOS_PLANES).toEqual({ esencial: 35_000, completo: 45_000 });
    expect(texto).toMatch(/Plan Esencial \$35\.000 y Plan Completo \$45\.000/);
    expect(texto).toContain("sin importar cuántas canchas");
    expect(texto).toContain("primer mes es gratis");
  });

  it("no promete torneos ni lo que no sabe", () => {
    expect(texto).toMatch(/TORNEOS: están en camino para el Plan Completo.*No prometas fechas/);
    expect(texto).toMatch(/app para descargar, facturación, integraciones/);
  });

  it("usa los links configurados", () => {
    expect(texto).toContain("https://x.test/prueba");
    expect(texto).toContain("podés pasar https://x.test.");
    expect(instrucciones()).toContain("https://www.modocanchas.com/prueba-gratis");
  });
});

describe("tanda", () => {
  const p = (id: string, ciudad: string, extra: Record<string, unknown> = {}) => ({
    id,
    ciudad,
    provincia: "Buenos Aires",
    resenas: 10,
    rubro: "Complejo de fútbol",
    estado: "sin_contactar" as const,
    prioridad: "A" as const,
    telefono_wa: "5493410000000",
    ...extra,
  });

  it("celulares primero, después prioridad y reseñas, y prueba los fijos si se pide", () => {
    const c = [
      p("fijo", "San Nicolás", { telefono: "+54 336 466-7711", resenas: 300 }),
      p("celB", "Rosario", { telefono: "+54 9 341 555-1234", prioridad: "B", resenas: 999 }),
      p("celA", "Rosario", { telefono: "+54 9 341 555-0000", resenas: 5 }),
    ];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5, incluirFijos: true })).toEqual(["celA", "celB", "fijo"]);
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5 })).toEqual(["celA", "celB"]);
  });

  it("no elige rubros que no son de canchas ni complejos sin WhatsApp", () => {
    const c = [p("pel", "Rosario", { rubro: "Peluquería" }), p("sin", "Rosario", { telefono_wa: null }), p("ok", "Rosario")];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5 })).toEqual(["ok"]);
  });

  it("limita por zona: provincia o ciudad", () => {
    const c = [
      p("sn", "San Nicolás de los Arroyos", { resenas: 50 }),
      p("ros", "Rosario", { provincia: "Santa Fe", resenas: 40 }),
      p("ram", "Ramallo", { resenas: 30 }),
    ];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5, zona: { tipo: "provincia", provincia: "Santa Fe" } })).toEqual(["ros"]);
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5, zona: { tipo: "ciudad", provincia: "Buenos Aires", ciudad: "Ramallo" } })).toEqual(["ram"]);
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5, zona: { tipo: "todo" } })).toEqual(["sn", "ros", "ram"]);
  });

  it("sigue repartiendo entre ciudades", () => {
    const c = [p("a", "Rosario", { resenas: 30 }), p("b", "Rosario", { resenas: 20 }), p("c", "Pergamino", { resenas: 10 })];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 1 })).toEqual(["a", "c"]);
  });

  it("codifica y lee la zona del selector", () => {
    const zonas: Zona[] = [{ tipo: "todo" }, { tipo: "provincia", provincia: "Santa Fe" }, { tipo: "ciudad", provincia: "Buenos Aires", ciudad: "San Nicolás de los Arroyos" }];
    for (const z of zonas) expect(zonaDesdeTexto(zonaATexto(z))).toEqual(z);
    expect(zonaDesdeTexto("cualquier cosa")).toEqual({ tipo: "todo" });
    expect(zonaDesdeTexto(null)).toEqual({ tipo: "todo" });
    expect(zonaDesdeTexto("c:|")).toEqual({ tipo: "todo" });
    expect(enZona({ provincia: "Santa Fe", ciudad: "Rosario" }, { tipo: "ciudad", provincia: null, ciudad: "Rosario" })).toBe(true);
  });
});

describe("chance de WhatsApp", () => {
  it("reconoce celulares, fijos y dudosos por cómo figuran en Google Maps", async () => {
    const { chanceWhatsApp } = await import("@/lib/dominio/telefono");
    expect(chanceWhatsApp("+54 9 11 5347-9309")).toBe("alta");
    expect(chanceWhatsApp("0341 15-555-1234")).toBe("alta");
    expect(chanceWhatsApp("+54 341 412-7277")).toBe("baja");
    expect(chanceWhatsApp("+54 11 3420-4252")).toBe("media");
    expect(chanceWhatsApp(null, "5493410000000")).toBe("media");
  });
});
