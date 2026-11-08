import { describe, expect, it } from "vitest";
import { calcularEmbudo, coberturaPorProvincia, proximosPasos, resumirBase, type FilaMetricas } from "@/lib/dominio/metricas";
import { contarPorEstado, filtrarComplejos, ordenarComplejos, paginar, type FilaComplejo, type FiltrosComplejos } from "@/lib/dominio/lista-complejos";
import { horasRestantesVentana } from "@/lib/dominio/ventana";
import { haceCuanto } from "@/lib/dominio/fechas";

const fila = (c: Partial<FilaMetricas> = {}): FilaMetricas => ({ estado: "sin_contactar", contactado_el: null, ultimo_entrante_el: null, provincia: "Santa Fe", telefono_wa: "5493410000000", ...c });
const T = "2026-11-01T12:00:00Z";
const INICIO = "2026-11-01T00:00:00-03:00";

describe("embudo", () => {
  it("cuenta cada etapa de forma acumulada y calcula la conversión", () => {
    const e = calcularEmbudo([
      fila(),
      fila({ estado: "contactado", contactado_el: T }),
      fila({ estado: "contactado", contactado_el: T }),
      fila({ estado: "respondio", contactado_el: T, ultimo_entrante_el: T }),
      fila({ estado: "cliente", contactado_el: T, ultimo_entrante_el: T }),
    ]);
    expect(e.map((x) => x.cantidad)).toEqual([4, 2, 1, 1, 1]);
    expect(e.map((x) => x.conversion)).toEqual([null, 50, 50, 100, 100]);
    expect(e[1]!.ancho).toBe(50);
  });

  it("alguien que respondió y después se descartó sigue contando como respuesta", () => {
    expect(calcularEmbudo([fila({ estado: "descartado", contactado_el: T, ultimo_entrante_el: T })]).map((x) => x.cantidad)).toEqual([1, 1, 0, 0, 0]);
  });

  it("nunca crece de una etapa a la siguiente, aunque el estado se haya cargado a mano", () => {
    expect(calcularEmbudo([fila({ estado: "interesado" })]).map((x) => x.cantidad)).toEqual([1, 1, 1, 0, 0]);
  });

  it("con la base vacía no divide por cero", () => {
    expect(calcularEmbudo([]).every((x) => x.ancho === 0 && x.conversion === null)).toBe(true);
  });
});

describe("resumen y cobertura", () => {
  const contactado = fila({ estado: "contactado", contactado_el: T });
  const baja = fila({ estado: "no_contactar", contactado_el: T });

  it("resume la base y solo avisa de bajas con suficientes contactos", () => {
    expect(resumirBase([fila(), fila({ telefono_wa: null }), contactado, baja], INICIO)).toMatchObject({ total: 4, sinContactar: 1, bajas: 1, alertaBajas: false });
    expect(resumirBase([...Array<FilaMetricas>(18).fill(contactado), baja, baja], INICIO).alertaBajas).toBe(true);
    expect(resumirBase([...Array<FilaMetricas>(19).fill(contactado), baja], INICIO).alertaBajas).toBe(false);
  });

  it("cuenta las respuestas de hoy aunque cambie el formato de la hora", () => {
    expect(resumirBase([fila({ ultimo_entrante_el: "2026-11-01T03:30:00+00:00" })], INICIO).respuestasHoy).toBe(1);
    expect(resumirBase([fila({ ultimo_entrante_el: "2026-11-01T02:30:00+00:00" })], INICIO).respuestasHoy).toBe(0);
  });

  it("ordena las provincias por lo que falta contactar", () => {
    const c = coberturaPorProvincia([fila({ provincia: "Córdoba", estado: "contactado", contactado_el: T }), fila({ provincia: "Córdoba" }), fila(), fila(), fila({ provincia: null })]);
    expect(c.map((x) => x.provincia)).toEqual(["Santa Fe", "Córdoba"]);
    expect(c[1]).toMatchObject({ total: 2, contactados: 1, sinContactar: 1, porcentaje: 50 });
  });
});

describe("próximos pasos", () => {
  const base = { urgentes: 0, porEnviar: 0, seguimientos: 0, tandaArmada: true, cupoRestante: 0, sinContactar: 10 };

  it("lo urgente va primero", () => {
    const p = proximosPasos({ ...base, urgentes: 2, porEnviar: 5, seguimientos: 1 });
    expect(p.map((x) => x.href)).toEqual(["#te-necesitan", "#tanda", "#seguimientos"]);
    expect(p[0]!.titulo).toBe("Respondé a 2 complejos que te necesitan");
    expect(p[2]!.titulo).toBe("Mandá 1 seguimiento");
  });

  it("propone armar la tanda solo si hay cupo y complejos", () => {
    expect(proximosPasos({ ...base, tandaArmada: false, cupoRestante: 10 })[0]!.titulo).toBe("Armá la tanda de hoy");
    expect(proximosPasos({ ...base, tandaArmada: false, cupoRestante: 0 })).toEqual([]);
  });

  it("si no quedan complejos, manda a buscar", () => {
    expect(proximosPasos({ ...base, sinContactar: 0 })[0]!.href).toBe("/buscar");
  });
});

describe("lista de complejos", () => {
  const c = (id: string, x: Partial<FilaComplejo> = {}): FilaComplejo => ({
    id,
    nombre: id,
    rubro: "Pádel",
    ciudad: "Rosario",
    provincia: "Santa Fe",
    prioridad: "B",
    estado: "sin_contactar",
    resenas: 10,
    deportes: ["pádel"],
    sistema_actual: null,
    telefono_wa: null,
    ultimo_entrante_el: null,
    contactado_el: null,
    ...x,
  });
  const nada: FiltrosComplejos = { provincia: null, ciudad: null, deporte: null, sistema: null, q: "" };

  it("busca sin tildes ni mayúsculas y combina filtros", () => {
    const l = [c("Pádel Norte"), c("Fútbol Sur", { deportes: ["fútbol 5"], provincia: "Córdoba", sistema_actual: "atc" })];
    expect(filtrarComplejos(l, { ...nada, q: "PADEL" }).map((x) => x.id)).toEqual(["Pádel Norte"]);
    expect(filtrarComplejos(l, { ...nada, deporte: "fútbol 5", provincia: "Córdoba" }).map((x) => x.id)).toEqual(["Fútbol Sur"]);
    expect(filtrarComplejos(l, { ...nada, sistema: "desconocido" }).map((x) => x.id)).toEqual(["Pádel Norte"]);
    expect(filtrarComplejos(l, { ...nada, sistema: "atc" }).map((x) => x.id)).toEqual(["Fútbol Sur"]);
  });

  it("cuenta por estado y ordena sin tocar la lista original", () => {
    const l = [c("b", { resenas: 5, prioridad: "C" }), c("a", { resenas: 50, prioridad: "A", estado: "demo" })];
    expect(contarPorEstado(l)).toEqual({ sin_contactar: 1, demo: 1 });
    expect(ordenarComplejos(l, "prioridad").map((x) => x.id)).toEqual(["a", "b"]);
    expect(ordenarComplejos(l, "nombre").map((x) => x.id)).toEqual(["a", "b"]);
    expect(l.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("pagina y corrige páginas fuera de rango", () => {
    const l = Array.from({ length: 120 }, (_, i) => i);
    expect(paginar(l, 2, 50)).toMatchObject({ pagina: 2, paginas: 3, total: 120 });
    expect(paginar(l, 2, 50).items[0]).toBe(50);
    expect(paginar(l, 99, 50).pagina).toBe(3);
    expect(paginar(l, Number.NaN, 50).pagina).toBe(1);
    expect(paginar([], 1, 50)).toMatchObject({ pagina: 1, paginas: 1, items: [] });
  });
});

describe("tiempos", () => {
  const ahora = new Date("2026-11-08T15:00:00Z");

  it("dice cuánto queda de la ventana de 24 h", () => {
    expect(horasRestantesVentana("2026-11-08T14:00:00Z", ahora)).toBe(23);
    expect(horasRestantesVentana("2026-11-07T15:30:00Z", ahora)).toBe(1);
    expect(horasRestantesVentana("2026-11-07T15:00:00Z", ahora)).toBeNull();
    expect(horasRestantesVentana(null, ahora)).toBeNull();
  });

  it("escribe hace cuánto fue", () => {
    expect(haceCuanto("2026-11-08T14:59:40Z", ahora)).toBe("recién");
    expect(haceCuanto("2026-11-08T14:50:00Z", ahora)).toBe("hace 10 min");
    expect(haceCuanto("2026-11-08T12:00:00Z", ahora)).toBe("hace 3 h");
    expect(haceCuanto("2026-11-07T12:00:00Z", ahora)).toBe("ayer");
    expect(haceCuanto("2026-11-03T12:00:00Z", ahora)).toBe("hace 5 d");
  });
});
