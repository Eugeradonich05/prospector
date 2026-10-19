import { describe, expect, it } from "vitest";
import { LINEAS, articuloRubro, lineaDeRubro, plantillaPara, type Linea } from "@/lib/dominio/lineas";
import { elegirTanda, mensajeSeguimiento } from "@/lib/dominio/tandas";
import { instrucciones } from "@/lib/bot/conocimiento";

describe("lineaDeRubro", () => {
  it("manda cada rubro a su servicio", () => {
    expect(lineaDeRubro("Pilates")).toBe("cuotas");
    expect(lineaDeRubro("Funcional / crossfit")).toBe("cuotas");
    expect(lineaDeRubro("Artes marciales")).toBe("cuotas");
    expect(lineaDeRubro("Peluquería")).toBe("turnos");
    expect(lineaDeRubro("Barbería")).toBe("turnos");
    expect(lineaDeRubro("Odontología")).toBe("turnos");
    expect(lineaDeRubro("Veterinaria")).toBe("turnos");
    expect(lineaDeRubro("Estudio jurídico")).toBe("documentos");
    expect(lineaDeRubro("Estudio contable")).toBe("documentos");
    expect(lineaDeRubro("Escribanía")).toBe("documentos");
    expect(lineaDeRubro("Inmobiliaria")).toBe("a_medida");
    expect(lineaDeRubro("Taller mecánico")).toBe("a_medida");
    expect(lineaDeRubro(null)).toBe("a_medida");
  });

  it("deja afuera los complejos de canchas (van por Modo Cancha)", () => {
    expect(lineaDeRubro("Pádel")).toBeNull();
    expect(lineaDeRubro("Complejo de fútbol 5")).toBeNull();
    expect(lineaDeRubro("Canchas de tenis")).toBeNull();
  });
});

describe("mensajes por servicio", () => {
  const lineas = Object.keys(LINEAS) as Linea[];

  it("cada servicio tiene al menos dos primeros mensajes distintos que nombran al negocio", () => {
    for (const l of lineas) {
      const textos = LINEAS[l].plantillas.map((f) => f("Lo de Ana", "Peluquería"));
      expect(textos.length).toBeGreaterThanOrEqual(2);
      expect(new Set(textos).size).toBe(textos.length);
      for (const t of textos) {
        expect(t).toContain("Lo de Ana");
        expect(t).toContain("Cauce");
        expect(t).not.toMatch(/\$\s?\d/); // nunca precios en el primer mensaje
        expect(t.length).toBeLessThan(500);
      }
    }
  });

  it("los primeros mensajes de servicios distintos no se parecen", () => {
    const uno = lineas.map((l) => LINEAS[l].plantillas[0]!("X", "Rubro"));
    expect(new Set(uno).size).toBe(lineas.length);
    expect(LINEAS.turnos.plantillas[0]!("X", "Peluquería")).toMatch(/turno/);
    expect(LINEAS.documentos.plantillas[0]!("X", "Estudio jurídico")).toMatch(/documento y página/);
    expect(LINEAS.cuotas.plantillas[0]!("X", "Pilates")).toMatch(/cuota/);
  });

  it("elige la plantilla de forma estable por negocio", () => {
    expect(plantillaPara("turnos", "Barbería Faraón", "Barbería")).toBe(plantillaPara("turnos", "Barbería Faraón", "Barbería"));
  });

  it("el seguimiento habla del servicio que se ofreció", () => {
    expect(mensajeSeguimiento("Estudio 22", "Pilates")).toMatch(/cuotas/);
    expect(mensajeSeguimiento("Bucles", "Peluquería")).toMatch(/turnos/);
    expect(mensajeSeguimiento("Estudio Pérez", "Estudio jurídico")).not.toMatch(/cuotas|turnos/);
    expect(mensajeSeguimiento("Taller Gus", "Taller mecánico")).toMatch(/automatizar/);
  });

  it("pone los rubros en plural para las frases", () => {
    expect(articuloRubro("Peluquería")).toBe("peluquerías");
    expect(articuloRubro("Estudio contable")).toBe("estudios contables");
    expect(articuloRubro("Funcional / crossfit")).toBe("estudios de funcional");
    expect(articuloRubro("Inmobiliaria")).toBe("inmobiliarias");
  });
});

describe("conocimiento del bot por servicio", () => {
  it("solo da precios de Cuotas al día y nunca ofrece Modo Cancha", () => {
    const turnos = instrucciones({ linea: "turnos" });
    expect(turnos).toContain("Bot de WhatsApp para turnos");
    expect(turnos).toContain("Nunca des un número para esos servicios");
    expect(turnos).toMatch(/Modo Cancha .*no se ofrece por acá/);
    expect(instrucciones({ linea: "cuotas" })).toContain("$24.900");
  });

  it("el link de prueba solo aparece para Cuotas al día", () => {
    expect(instrucciones({ linea: "cuotas", linkPrueba: "https://x.test/registro" })).toContain("https://x.test/registro");
    expect(instrucciones({ linea: "documentos", linkPrueba: "https://x.test/registro" })).not.toContain("https://x.test/registro");
  });
});

describe("elegirTanda por servicio", () => {
  const p = (id: string, rubro: string, ciudad: string, resenas = 10) => ({
    id,
    rubro,
    ciudad,
    resenas,
    estado: "sin_contactar" as const,
    prioridad: "A" as const,
    telefono_wa: "5493410000000",
  });

  it("mezcla servicios con el tope por línea", () => {
    const c = [
      p("g1", "Pilates", "Rosario", 90),
      p("g2", "Pilates", "Córdoba", 80),
      p("g3", "Pilates", "CABA", 70),
      p("t1", "Peluquería", "Mendoza", 60),
      p("d1", "Estudio contable", "Salta", 50),
    ];
    expect(elegirTanda(c, { limite: 4, maxPorCiudad: 5, maxPorLinea: 2 })).toEqual(["g1", "g2", "t1", "d1"]);
  });

  it("nunca elige complejos de canchas", () => {
    const c = [p("c1", "Pádel", "Rosario", 999), p("t1", "Barbería", "Rosario")];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5 })).toEqual(["t1"]);
  });

  it("puede limitarse a algunos servicios", () => {
    const c = [p("g1", "Pilates", "Rosario", 90), p("t1", "Peluquería", "Rosario", 10)];
    expect(elegirTanda(c, { limite: 5, maxPorCiudad: 5, lineas: ["turnos"] })).toEqual(["t1"]);
  });
});
