import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buscarComplejos, CAMPOS_LUGAR, ErrorPlaces, URL_SEARCH_TEXT, type Fetch } from "@/lib/google/places";
import { ciudadYProvincia, distanciaKm, motivoDescarte, normalizarProvincia, type LugarPlaces } from "@/lib/google/complejos-google";
import { buscarDuplicados, type Existente } from "@/lib/dominio/complejos";

const fixture = (nombre: string) => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", nombre), "utf8")) as unknown;

type Pedido = { url: string; headers: Record<string, string>; cuerpo: Record<string, unknown> };

/** Google falso: responde según la consulta, con las respuestas de tests/fixtures. */
function googleFalso(opciones: { status?: number } = {}) {
  const pedidos: Pedido[] = [];
  const fetch: Fetch = async (url, init) => {
    const cuerpo = JSON.parse(init.body) as Record<string, unknown>;
    pedidos.push({ url, headers: init.headers, cuerpo });
    if (opciones.status) return { ok: false, status: opciones.status, json: async () => ({ error: { status: "PERMISSION_DENIED", message: "Places API (New) has not been used in project" } }) };
    const q = String(cuerpo.textQuery);
    const archivo = q.endsWith(", Argentina")
      ? "places-zona.json"
      : q.startsWith("canchas de fútbol")
        ? cuerpo.pageToken === "pagina-2"
          ? "places-futbol-p2.json"
          : "places-futbol-p1.json"
        : q.startsWith("canchas de pádel")
          ? "places-padel.json"
          : null;
    return { ok: true, status: 200, json: async () => (archivo ? fixture(archivo) : {}) };
  };
  return { fetch, pedidos };
}

describe("búsqueda en Google Places (con respuestas de ejemplo)", () => {
  it("ubica la zona, hace una consulta por deporte con locationBias y pagina", async () => {
    const g = googleFalso();
    const r = await buscarComplejos({ zona: "San Nicolás de los Arroyos", radioKm: 15, deportes: ["futbol", "padel"], apiKey: "clave-de-prueba-123456789", fetch: g.fetch });

    // 1 para la zona + 2 páginas de fútbol + 1 de pádel
    expect(r.llamadas).toBe(4);
    expect(g.pedidos.every((p) => p.url === URL_SEARCH_TEXT && p.headers["X-Goog-Api-Key"] === "clave-de-prueba-123456789")).toBe(true);
    const futbol = g.pedidos.filter((p) => String(p.cuerpo.textQuery).startsWith("canchas de fútbol"));
    expect(futbol.map((p) => p.cuerpo.textQuery)).toEqual(["canchas de fútbol 5 en San Nicolás de los Arroyos", "canchas de fútbol 5 en San Nicolás de los Arroyos"]);
    expect(futbol[1]!.cuerpo.pageToken).toBe("pagina-2");
    expect(futbol[0]!.headers["X-Goog-FieldMask"]).toBe(CAMPOS_LUGAR);
    expect(futbol[0]!.cuerpo).toMatchObject({
      regionCode: "AR",
      languageCode: "es",
      pageSize: 20,
      locationBias: { circle: { center: { latitude: -33.3342, longitude: -60.2108 }, radius: 15000 } },
    });
    expect(r.centro).toEqual({ lat: -33.3342, lng: -60.2108 });
  });

  it("une los repetidos entre deportes, normaliza y marca (sin ocultar) lo que no es un complejo", async () => {
    const g = googleFalso();
    const { encontrados } = await buscarComplejos({ zona: "San Nicolás de los Arroyos", radioKm: 30 /* Ramallo (25 km) entra; Rosario (59 km) no */, deportes: ["futbol", "padel"], apiKey: "clave-de-prueba-123456789", fetch: g.fetch });
    const por = Object.fromEntries(encontrados.map((e) => [e.nombre, e]));

    expect(encontrados).toHaveLength(8); // 3 + 2 de fútbol y 4 de pádel, con La Redonda en las dos
    expect(encontrados.filter((e) => e.nombre === "Complejo La Redonda F5")).toHaveLength(1);
    expect(por["Complejo La Redonda F5"]).toMatchObject({
      place_id: "ChIJ_LaRedonda",
      ciudad: "San Nicolás de Los Arroyos",
      provincia: "Buenos Aires",
      telefono_wa: "5493364123456",
      chance: "alta",
      calificacion: 4.6,
      prioridad: "A",
      deportes: ["fútbol 5"],
      rubro: "Complejo de fútbol",
      web: "https://laredonda.com.ar/",
      descarte: null,
    });
    // Sin deporte en el nombre: toma el de la única búsqueda en la que apareció.
    expect(por["El Remate"]).toMatchObject({ deportes: ["pádel"], rubro: "Pádel", chance: "baja", prioridad: "B", descarte: null });
    expect(por["Futbol +"]).toMatchObject({ telefono_wa: "5493364667711", deportes: ["fútbol"], descarte: null });

    expect(por["Deportes Ramallo Sport Shop"]!.descarte).toBe("tienda de deportes");
    expect(por["Club Atlético Somisa"]!.descarte).toBe("club con socios");
    expect(por["Canchas El Galpón"]!.descarte).toBe("cerrado definitivamente");
    expect(por["Escuelita de Fútbol Los Pibes"]!.descarte).toBe("escuela");
    expect(por["Pádel Rosario Centro"]!.descarte).toMatch(/^fuera del radio \(\d+ km\)$/);
    // Los candidatos primero (más reseñas arriba), los descartados al final.
    expect(encontrados.slice(0, 3).map((e) => e.nombre)).toEqual(["Futbol +", "Complejo La Redonda F5", "El Remate"]);
  });

  it("deduplica contra la base por place_id, WhatsApp o nombre + ciudad", async () => {
    const g = googleFalso();
    const { encontrados } = await buscarComplejos({ zona: "San Nicolás de los Arroyos", radioKm: 30, deportes: ["futbol", "padel"], apiKey: "clave-de-prueba-123456789", fetch: g.fetch });
    const base: Existente[] = [
      { id: "seed-1", nombre: "Futbol +", ciudad: "San Nicolás de los Arroyos", place_id: "ChIJyygdw75nt5URqC1v3Nz8SO8", telefono_wa: "5493364667711", estado: "contactado" },
      { id: "plan-1", nombre: "El Remate", ciudad: "Ramallo", place_id: null, telefono_wa: null, estado: "sin_contactar" },
    ];
    const dup = buscarDuplicados(encontrados, base);
    const ya = encontrados.filter((_, i) => dup[i]).map((e) => e.nombre);
    expect(ya).toEqual(["Futbol +", "El Remate"]);
    expect(dup[encontrados.findIndex((e) => e.nombre === "El Remate")]!.por).toBe("nombre");
  });

  it("explica los errores de Google sin mostrar la clave", async () => {
    const g = googleFalso({ status: 403 });
    const p = buscarComplejos({ zona: "San Nicolás", radioKm: 10, deportes: ["padel"], apiKey: "clave-secreta-123456789", fetch: g.fetch });
    await expect(p).rejects.toBeInstanceOf(ErrorPlaces);
    await expect(p).rejects.toThrow(/403 \(PERMISSION_DENIED\)/);
    await expect(p).rejects.not.toThrow(/clave-secreta/);
  });

  it("avisa si no encuentra la zona", async () => {
    const fetch: Fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    await expect(buscarComplejos({ zona: "Zzzz", radioKm: 10, deportes: ["padel"], apiKey: "x".repeat(20), fetch })).rejects.toThrow(/No encontré «Zzzz»/);
  });
});

describe("normalización de lugares", () => {
  it("normaliza provincias como en el seed", () => {
    expect(normalizarProvincia("Provincia de Buenos Aires")).toBe("Buenos Aires");
    expect(normalizarProvincia("Santa Fe Province")).toBe("Santa Fe");
    expect(normalizarProvincia("Ciudad Autónoma de Buenos Aires")).toBe("CABA");
    expect(normalizarProvincia("Córdoba")).toBe("Córdoba");
    expect(normalizarProvincia("")).toBeNull();
  });

  it("en CABA la ciudad también es CABA; si no hay localidad usa el partido", () => {
    expect(ciudadYProvincia({ id: "x", addressComponents: [{ longText: "Buenos Aires", types: ["locality"] }, { longText: "Ciudad Autónoma de Buenos Aires", types: ["administrative_area_level_1"] }] })).toEqual({
      ciudad: "CABA",
      provincia: "CABA",
    });
    expect(ciudadYProvincia({ id: "x", addressComponents: [{ longText: "Partido de Pilar", types: ["administrative_area_level_2"] }] })).toEqual({ ciudad: "Partido de Pilar", provincia: null });
  });

  it("calcula distancias en km", () => {
    expect(Math.round(distanciaKm({ lat: -33.3342, lng: -60.2108 }, { lat: -32.9468, lng: -60.6393 }))).toBe(59);
  });
});

describe("filtro de «no es complejo»", () => {
  const lugar = (nombre: string, extra: Partial<LugarPlaces> = {}): LugarPlaces => ({ id: "x", displayName: { text: nombre }, businessStatus: "OPERATIONAL", ...extra });

  it.each([
    ["Village Futbol Club", null],
    ["GRÜN FC", null],
    ["Club de Tenis y Paddle San Nicolás", null],
    ["Hangar PILAR - PADEL y FUTBOL Techado", null],
    ["Club Atlético Belgrano", "club con socios"],
    ["Sociedad de Fomento Barrio Norte", "club con socios"],
    ["Escuela de Fútbol Infantil", "escuela"],
    ["Sport Shop Ramallo", "tienda de deportes"],
    ["Gimnasio Olimpo", "gimnasio"],
  ])("%s → %s", (nombre, esperado) => {
    expect(motivoDescarte(lugar(nombre))).toBe(esperado);
  });

  it("mira los tipos de Google, pero una cancha que vende cosas no es una tienda", () => {
    expect(motivoDescarte(lugar("Mundo Deportivo", { types: ["sporting_goods_store", "store"] }))).toBe("tienda de deportes");
    expect(motivoDescarte(lugar("Complejo Norte", { types: ["sports_complex", "store"] }))).toBeNull();
    expect(motivoDescarte(lugar("Instituto San José", { types: ["school"] }))).toBe("escuela");
    expect(motivoDescarte(lugar("La Cancha", { businessStatus: "CLOSED_TEMPORARILY" }))).toBe("cerrado temporalmente");
  });
});
