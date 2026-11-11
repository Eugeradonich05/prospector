import { describe, expect, it } from "vitest";
import { conSitio, pedidoPrimerMensaje, plantillaPrimerMensaje, sitioVisible, textoAceptable } from "@/lib/bot/primer-mensaje";
import { opcionesDeZona, textoListaTanda } from "@/lib/dominio/tandas";

const base = { nombre: "Pádel del Parque", rubro: "Pádel", ciudad: "San Nicolás de los Arroyos" };

describe("primer mensaje (pedido a Claude)", () => {
  it("siempre habla como Modo Cancha, 3 a 4 oraciones, sin emojis ni markdown, cerrando con pregunta y sin montos", () => {
    const { system, user } = pedidoPrimerMensaje(base);
    expect(system).toContain("Modo Cancha");
    expect(system).not.toMatch(/Cauce|Eugenio/);
    expect(system).toMatch(/3 a 4 oraciones/);
    expect(system).toMatch(/sin emojis, sin markdown/);
    expect(system).toMatch(/Cerrá con una pregunta/);
    expect(system).toMatch(/No pongas montos/);
    expect(system).toMatch(/sin inventar nada/);
    expect(user).toContain("Complejo: Pádel del Parque.");
    expect(user).toContain("Ciudad: San Nicolás de los Arroyos.");
  });

  it("con deportes, habla del deporte concreto", () => {
    const { system, user } = pedidoPrimerMensaje({ ...base, deportes: ["pádel", "fútbol 5"] });
    expect(system).toContain("canchas de pádel y fútbol 5");
    expect(system).toContain("ese deporte concreto");
    expect(user).toContain("Deportes: pádel, fútbol 5.");
  });

  it("sin deportes, usa el rubro y no inventa", () => {
    const { system, user } = pedidoPrimerMensaje({ ...base, rubro: "Complejo deportivo", deportes: [] });
    expect(system).toContain("Hablá del deporte del rubro (Complejo deportivo)");
    expect(user).not.toContain("Deportes:");
  });

  it.each(["atc", "clubo"] as const)("si usan %s: no critica, pregunta cómo les va y menciona precio fijo y seña directa", (sistema) => {
    const { system, user } = pedidoPrimerMensaje({ ...base, sistema_actual: sistema });
    expect(system).toMatch(/No critiques/);
    expect(system).toMatch(/preguntá cómo les va/);
    expect(system).toMatch(/precio fijo en pesos sin importar cuántas canchas/);
    expect(system).toMatch(/seña va directo a su cuenta de Mercado Pago/);
    expect(user).toMatch(/Cómo reservan hoy: (ATC|Clubo)\./);
  });

  it.each(["whatsapp_manual", "ninguno"] as const)("si reservan %s: pregunta cómo toman hoy las reservas", (sistema) => {
    const { system } = pedidoPrimerMensaje({ ...base, sistema_actual: sistema });
    expect(system).toMatch(/preguntar cómo toman hoy las reservas/);
    expect(system).not.toMatch(/precio fijo/);
  });

  it("usa la cantidad de canchas solo si la sabemos", () => {
    expect(pedidoPrimerMensaje({ ...base, canchas_cantidad: 4 }).user).toContain("Cantidad de canchas: 4.");
    expect(pedidoPrimerMensaje(base).user).not.toContain("Cantidad de canchas");
  });

  it("le pide a Claude la web una sola vez, después de nombrar a Modo Cancha", () => {
    const { system } = pedidoPrimerMensaje(base);
    expect(system).toContain("www.modocanchas.com");
    expect(system).toMatch(/una sola vez/);
    expect(pedidoPrimerMensaje(base, "https://otra.com.ar/").system).toContain("otra.com.ar");
  });

  it("muestra la web sin https ni barra final", () => {
    expect(sitioVisible("https://www.modocanchas.com/")).toBe("www.modocanchas.com");
    expect(sitioVisible()).toBe("www.modocanchas.com");
  });

  it("agrega la web si falta, después de la primera mención de Modo Cancha, y no la duplica", () => {
    const sin = "Hola! Te escribimos de Modo Cancha. ¿Cómo toman hoy las reservas?";
    expect(conSitio(sin)).toBe("Hola! Te escribimos de Modo Cancha (www.modocanchas.com). ¿Cómo toman hoy las reservas?");
    const con = "Hola! Te escribimos de Modo Cancha (www.modocanchas.com). ¿Cómo toman hoy las reservas?";
    expect(conSitio(con)).toBe(con);
    expect(conSitio("Hola, mirá https://modocanchas.com ¿qué te parece?")).toBe("Hola, mirá https://modocanchas.com ¿qué te parece?");
    expect(conSitio("Hola! ¿Cómo toman las reservas?")).toBe("Hola! ¿Cómo toman las reservas?\nwww.modocanchas.com");
  });

  it("las plantillas de respaldo también llevan la web una sola vez", () => {
    for (const nombre of ["Pádel del Parque", "La Bombonera 5", "Tridente"]) {
      const t = plantillaPrimerMensaje(nombre, "Pádel");
      expect(t.match(/modocanchas\.com/g)).toHaveLength(1);
      expect(t).toContain("Modo Cancha (www.modocanchas.com)");
    }
  });

  it("tiene respaldo si Claude no responde y rechaza respuestas raras", () => {
    expect(plantillaPrimerMensaje("Pádel del Parque", "Pádel")).toContain("Modo Cancha");
    expect(textoAceptable("ok")).toBe(false);
    expect(textoAceptable("Hola! Te escribimos de Modo Cancha, ¿cómo toman hoy las reservas de pádel?")).toBe(true);
  });
});

describe("selector de zona", () => {
  it("cuenta por provincia y por ciudad, con las más grandes primero", () => {
    const z = opcionesDeZona([
      { provincia: "Buenos Aires", ciudad: "San Nicolás de los Arroyos" },
      { provincia: "Buenos Aires", ciudad: "San Nicolás de los Arroyos" },
      { provincia: "Buenos Aires", ciudad: "Ramallo" },
      { provincia: "Santa Fe", ciudad: "Villa Constitución" },
      { provincia: null, ciudad: null },
    ]);
    expect(z.provincias).toEqual([
      { provincia: "Buenos Aires", cantidad: 3 },
      { provincia: "Santa Fe", cantidad: 1 },
    ]);
    expect(z.ciudades[0]).toEqual({ provincia: "Buenos Aires", ciudad: "San Nicolás de los Arroyos", cantidad: 2 });
    expect(z.ciudades).toHaveLength(3);
  });
});

describe("Copiar lista", () => {
  it("copia nombre, teléfono y mensaje de cada uno", () => {
    const t = textoListaTanda([
      { nombre: "Pádel del Parque", telefono: "+54 9 336 412-3456", telefono_wa: "5493364123456", mensaje_inicial: "Hola! ¿Hablo con Pádel del Parque?" },
      { nombre: "Fútbol +", telefono: "+54 336 466-7711", telefono_wa: null, mensaje_inicial: null },
    ]);
    expect(t).toBe("Pádel del Parque\n+5493364123456\nHola! ¿Hablo con Pádel del Parque?\n\n---\n\nFútbol +\n+54 336 466-7711\n");
  });
});
