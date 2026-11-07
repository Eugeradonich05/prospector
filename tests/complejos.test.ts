import { describe, expect, it } from "vitest";
import {
  buscarDuplicados,
  claveNombreCiudad,
  deportesDesdeTexto,
  placeIdDeMapsUrl,
  prioridadPorResenas,
  rubroDesdeDeportes,
  sistemaDesdeTexto,
  type Existente,
} from "@/lib/dominio/complejos";
import { enlaceSeguro, esquemaComplejo, normalizarInstagram, normalizarWeb } from "@/lib/dominio/datos-complejo";
import { clasificarPlanilla, reconocerColumnas, resumenImportacion } from "@/lib/dominio/importar";

describe("deportes y rubro", () => {
  it("lee los deportes del nombre sin inventar", () => {
    expect(deportesDesdeTexto("Pádel y Fútbol 5 Norte")).toEqual(["fútbol 5", "pádel"]);
    expect(deportesDesdeTexto("Complejo F7 La Quinta")).toEqual(["fútbol 7"]);
    expect(deportesDesdeTexto("Doble5 Futbol 5")).toEqual(["fútbol 5"]);
    expect(deportesDesdeTexto("La Canchita", "Complejo de fútbol")).toEqual(["fútbol"]);
    expect(deportesDesdeTexto("Club de Tenis y Paddle")).toEqual(["pádel", "tenis"]);
    expect(deportesDesdeTexto("Complejo El Chañar", "Complejo deportivo")).toEqual([]);
  });

  it("elige un rubro de canchas", () => {
    expect(rubroDesdeDeportes(["pádel"])).toBe("Pádel");
    expect(rubroDesdeDeportes(["fútbol 5", "fútbol 7"])).toBe("Complejo de fútbol");
    expect(rubroDesdeDeportes(["tenis"])).toBe("Tenis");
    expect(rubroDesdeDeportes(["fútbol 5", "pádel"])).toBe("Complejo deportivo");
    expect(rubroDesdeDeportes([])).toBe("Complejo deportivo");
  });

  it("prioriza igual que el seed (por reseñas)", () => {
    expect(prioridadPorResenas(50)).toBe("A");
    expect(prioridadPorResenas(49)).toBe("B");
    expect(prioridadPorResenas(15)).toBe("B");
    expect(prioridadPorResenas(14)).toBe("C");
    expect(prioridadPorResenas(null)).toBe("C");
  });

  it("saca el place_id del link de Maps del seed", () => {
    expect(placeIdDeMapsUrl("https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJz7givSO0vJURkHgIu9eNHhg")).toBe("ChIJz7givSO0vJURkHgIu9eNHhg");
    expect(placeIdDeMapsUrl("https://maps.google.com/?cid=123")).toBeNull();
    expect(placeIdDeMapsUrl(null)).toBeNull();
  });
});

describe("sistema actual", () => {
  it.each([
    ["ATC", "atc"],
    ["Alquila Tu Cancha", "atc"],
    ["clubo", "clubo"],
    ["Por WhatsApp", "whatsapp_manual"],
    ["a mano en un cuaderno", "whatsapp_manual"],
    ["ninguno", "ninguno"],
    ["no tiene", "ninguno"],
    ["Reservas Plus", "otro"],
    ["", null],
    ["no sé", null],
  ] as const)("«%s» → %s", (texto, esperado) => {
    expect(sistemaDesdeTexto(texto)).toBe(esperado);
  });
});

describe("Instagram y web", () => {
  it("normaliza el usuario de Instagram", () => {
    expect(normalizarInstagram("@Padel.Norte")).toBe("padel.norte");
    expect(normalizarInstagram("https://www.instagram.com/padel_norte/?hl=es")).toBe("padel_norte");
    expect(normalizarInstagram("instagram.com/padelnorte")).toBe("padelnorte");
    expect(normalizarInstagram("no tiene ig")).toBeNull();
    expect(normalizarInstagram("")).toBeNull();
  });

  it("solo acepta webs http(s)", () => {
    expect(normalizarWeb("complejo.com.ar")).toBe("https://complejo.com.ar/");
    expect(normalizarWeb("http://complejo.com.ar/reservas")).toBe("http://complejo.com.ar/reservas");
    expect(normalizarWeb("javascript:alert(1)")).toBeNull();
    expect(normalizarWeb("mailto:a@b.com")).toBeNull();
    expect(normalizarWeb("sin punto")).toBeNull();
  });

  it("al mostrar links, solo deja pasar http(s)", () => {
    expect(enlaceSeguro("https://maps.google.com/?cid=1")).toBe("https://maps.google.com/?cid=1");
    expect(enlaceSeguro("javascript:alert(1)")).toBeNull();
    expect(enlaceSeguro(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(enlaceSeguro(null)).toBeNull();
  });
});

describe("ficha del complejo", () => {
  const base = { nombre: "Pádel del Parque", rubro: "Pádel", telefono: "+54 9 336 412-3456", deportes: ["pádel"], canchas_cantidad: "4", sistema_actual: "atc" };

  it("valida y normaliza", () => {
    const r = esquemaComplejo.safeParse({ ...base, instagram: "@padelparque", web: "", notas: "  " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ telefono_wa: "5493364123456", canchas_cantidad: 4, sistema_actual: "atc", instagram: "padelparque", web: null, notas: null, ciudad: null });
  });

  it("rechaza rubros que no son de canchas, deportes inventados y cantidades raras", () => {
    expect(esquemaComplejo.safeParse({ ...base, rubro: "Peluquería" }).success).toBe(false);
    expect(esquemaComplejo.safeParse({ ...base, deportes: ["curling"] }).success).toBe(false);
    expect(esquemaComplejo.safeParse({ ...base, canchas_cantidad: "0" }).success).toBe(false);
    expect(esquemaComplejo.safeParse({ ...base, sistema_actual: "excel" }).success).toBe(false);
    expect(esquemaComplejo.safeParse({ ...base, nombre: " " }).success).toBe(false);
  });

  it("vacíos quedan como «no se sabe»", () => {
    const r = esquemaComplejo.safeParse({ ...base, canchas_cantidad: "", sistema_actual: "" });
    expect(r.success && r.data.canchas_cantidad === null && r.data.sistema_actual === null).toBe(true);
  });
});

describe("deduplicado", () => {
  const existentes: Existente[] = [
    { id: "1", nombre: "Fútbol +", ciudad: "San Nicolás de los Arroyos", place_id: "ChIJ-A", telefono_wa: "5493364667711", estado: "contactado" },
    { id: "2", nombre: "Tridente | Fútbol 5", ciudad: "San Nicolás de los Arroyos", place_id: null, telefono_wa: null, estado: "sin_contactar" },
  ];

  it("encuentra por place_id, por WhatsApp y por nombre + ciudad normalizados", () => {
    const r = buscarDuplicados(
      [
        { nombre: "Otro nombre", ciudad: "Ramallo", place_id: "ChIJ-A", telefono_wa: null },
        { nombre: "Futbol Más", ciudad: "Ramallo", telefono_wa: "5493364667711" },
        { nombre: "TRIDENTE fútbol 5", ciudad: "San Nicolas de los Arroyos", telefono_wa: "5493360000000" },
        { nombre: "Nuevo Pádel", ciudad: "San Nicolás de los Arroyos", telefono_wa: "5493361111111" },
      ],
      existentes,
    );
    expect(r.map((x) => x?.por ?? null)).toEqual(["place_id", "telefono", "nombre", null]);
    expect(r[0]!.existente!.id).toBe("1");
    expect(r[2]!.existente!.id).toBe("2");
  });

  it("detecta repetidos dentro de la misma lista", () => {
    const r = buscarDuplicados(
      [
        { nombre: "A", ciudad: "X", place_id: "p1", telefono_wa: "5493361111111" },
        { nombre: "B", ciudad: "X", place_id: "p2", telefono_wa: "5493361111111" },
        { nombre: "a", ciudad: "x", telefono_wa: null },
      ],
      [],
    );
    expect(r[0]).toBeNull();
    expect(r[1]).toMatchObject({ por: "telefono", enLista: 0, existente: null });
    expect(r[2]).toMatchObject({ por: "nombre", enLista: 0 });
  });

  it("mismo nombre y ciudad no es duplicado si son lugares distintos (place_id o dirección diferentes)", () => {
    const base: Existente[] = [{ id: "1", nombre: "Pádel Club", ciudad: "CABA", place_id: "ChIJ-Palermo", telefono_wa: null, estado: "sin_contactar", direccion: "Godoy Cruz 2000" }];
    const contraBase = (c: Parameters<typeof buscarDuplicados>[0][number]) => buscarDuplicados([c], base)[0];
    expect(contraBase({ nombre: "Pádel Club", ciudad: "CABA", place_id: "ChIJ-Belgrano", telefono_wa: null })).toBeNull();
    expect(contraBase({ nombre: "Padel Club", ciudad: "CABA", telefono_wa: null, direccion: "Cabildo 3000" })).toBeNull();
    expect(contraBase({ nombre: "Pádel Club", ciudad: "CABA", telefono_wa: null, direccion: "Godoy Cruz 2000" })).toMatchObject({ por: "nombre", existente: { id: "1" } });
    expect(contraBase({ nombre: "Pádel Club", ciudad: "CABA", telefono_wa: null })).toMatchObject({ por: "nombre", existente: { id: "1" } });
    // Dentro de la misma búsqueda: dos sucursales con distinto place_id no se pisan.
    const lista = buscarDuplicados(
      [
        { nombre: "Cadena F5", ciudad: "CABA", place_id: "a", telefono_wa: null },
        { nombre: "Cadena F5", ciudad: "CABA", place_id: "b", telefono_wa: null },
      ],
      [],
    );
    expect(lista).toEqual([null, null]);
  });

  it("normaliza nombre y ciudad", () => {
    expect(claveNombreCiudad("  Pádel—Norte!! ", "San Nicolás")).toBe("padel norte|san nicolas");
  });
});

describe("importar planilla", () => {
  it("reconoce columnas con o sin tildes y avisa las que ignora", () => {
    const { indices, ignoradas } = reconocerColumnas(["Nombre", "Teléfono", "Dirección", "Sistema actual", "Dueño"]);
    expect(indices).toEqual({ nombre: 0, telefono: 1, direccion: 2, sistema_actual: 3 });
    expect(ignoradas).toEqual(["Dueño"]);
  });

  it("clasifica nuevos, repetidos, sin teléfono y rechazados, con el resumen", () => {
    const existentes: Existente[] = [{ id: "1", nombre: "Fútbol +", ciudad: "San Nicolás de los Arroyos", place_id: null, telefono_wa: "5493364667711", estado: "contactado" }];
    const tabla = [
      ["nombre", "ciudad", "provincia", "telefono", "instagram", "sistema actual", "notas", "rubro"],
      ["Pádel Ramallo", "Ramallo", "Buenos Aires", "+54 9 3407 41-2345", "@padelramallo", "ATC", "Tiene 3 canchas", "Pádel"],
      ["Fútbol +", "San Nicolás de los Arroyos", "Buenos Aires", "0336 466-7711", "", "", "", ""],
      ["La Bombonera F5", "Villa Constitución", "Santa Fe", "", "@labombonera", "whatsapp", "", ""],
      ["Peluquería Ana", "Ramallo", "Buenos Aires", "+54 9 3407 40-0000", "", "", "", "Peluquería"],
      ["Pádel Ramallo", "Ramallo", "Buenos Aires", "+54 9 3407 41-9999", "", "", "", ""],
      ["", "fila vacía", "", "", "", "", "", ""],
    ];
    const { resultados, faltaNombre } = clasificarPlanilla(tabla, existentes);
    expect(faltaNombre).toBe(false);
    expect(resultados.map((r) => r.tipo)).toEqual(["nuevo", "ya_estaba", "sin_telefono", "rechazado", "ya_estaba"]);
    const nuevo = resultados[0]!;
    expect(nuevo.tipo === "nuevo" && nuevo.fila).toMatchObject({ telefono_wa: "5493407412345", instagram: "padelramallo", sistema_actual: "atc", rubro: "Pádel", deportes: ["pádel"] });
    const sinTel = resultados[2]!;
    expect(sinTel.tipo === "sin_telefono" && sinTel.fila).toMatchObject({ rubro: "Complejo de fútbol", deportes: ["fútbol 5"], sistema_actual: "whatsapp_manual" });
    expect(resumenImportacion(resultados)).toBe("1 nuevos, 2 ya estaban, 1 sin teléfono, 1 rechazados (no son de canchas)");
  });

  it("pide la columna nombre", () => {
    expect(clasificarPlanilla([["complejo_x", "tel"], ["a", "b"]], []).faltaNombre).toBe(true);
  });
});
