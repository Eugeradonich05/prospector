/**
 * Convierte resultados de Google Places API (New) en complejos para la base, y descarta (sin ocultar)
 * lo que claramente no es un complejo de alquiler. Puro: se testea con respuestas de ejemplo.
 */
import { deportesDesdeTexto, prioridadPorResenas, rubroDesdeDeportes, type Deporte } from "@/lib/dominio/complejos";
import { sinTildes } from "@/lib/dominio/lineas";
import { chanceWhatsApp, normalizarTelefonoAR, type ChanceWhatsApp } from "@/lib/dominio/telefono";

/** Lo que pedimos en el field mask de places:searchText. */
export type LugarPlaces = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  websiteUri?: string;
  businessStatus?: string;
  types?: string[];
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

/** Deportes del formulario de búsqueda. */
export const BUSQUEDAS = {
  futbol: { etiqueta: "Fútbol", consulta: "canchas de fútbol 5", deporte: "fútbol" },
  padel: { etiqueta: "Pádel", consulta: "canchas de pádel", deporte: "pádel" },
  tenis: { etiqueta: "Tenis", consulta: "canchas de tenis", deporte: "tenis" },
  complejo: { etiqueta: "Complejo deportivo", consulta: "complejo deportivo", deporte: null },
} as const satisfies Record<string, { etiqueta: string; consulta: string; deporte: Deporte | null }>;
export type DeporteBusqueda = keyof typeof BUSQUEDAS;
export const DEPORTES_BUSQUEDA = Object.keys(BUSQUEDAS) as DeporteBusqueda[];

export type Encontrado = {
  place_id: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  telefono: string | null;
  telefono_wa: string | null;
  chance: ChanceWhatsApp | null;
  resenas: number;
  calificacion: number | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  web: string | null;
  rubro: string;
  deportes: Deporte[];
  prioridad: "A" | "B" | "C";
  /** Por qué parece que no es un complejo de alquiler (se muestra tachado). null = es candidato. */
  descarte: string | null;
};

// ── Provincia y ciudad ─────────────────────────────────

const CABA = /ciudad autonoma de buenos aires|^caba$|capital federal|autonomous city of buenos aires/;

/** "Provincia de Buenos Aires" → "Buenos Aires"; "Santa Fe Province" → "Santa Fe"; CABA → "CABA" (como en el seed). */
export function normalizarProvincia(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (CABA.test(sinTildes(t))) return "CABA";
  return t.replace(/^provincia de\s+/i, "").replace(/\s+province$/i, "").trim() || null;
}

function componente(lugar: LugarPlaces, tipo: string): string | null {
  return lugar.addressComponents?.find((c) => c.types?.includes(tipo))?.longText?.trim() || null;
}

export function ciudadYProvincia(lugar: LugarPlaces): { ciudad: string | null; provincia: string | null } {
  const provincia = normalizarProvincia(componente(lugar, "administrative_area_level_1"));
  if (provincia === "CABA") return { ciudad: "CABA", provincia };
  const ciudad = componente(lugar, "locality") ?? componente(lugar, "administrative_area_level_2") ?? componente(lugar, "sublocality");
  return { ciudad, provincia };
}

// ── ¿Es un complejo de alquiler? ───────────────────────

const TIPOS_TIENDA = ["sporting_goods_store", "clothing_store", "shoe_store", "store", "shopping_mall", "department_store"];
const TIPOS_ESCUELA = ["school", "primary_school", "secondary_school", "university", "preschool"];
const TIPOS_CANCHA = ["sports_complex", "athletic_field", "stadium", "sports_activity_location"];
/** Palabras que indican que se alquilan canchas: con esto, «club» o «gym» en el nombre no alcanzan para descartar. */
const SENAL_CANCHA = /cancha|futbol|\bf ?5\b|\bf ?7\b|padel|paddle|complejo|alquiler|sintetic|indoor|soccer|tenis|squash/;

export function motivoDescarte(lugar: LugarPlaces): string | null {
  if (lugar.businessStatus && lugar.businessStatus !== "OPERATIONAL") {
    return lugar.businessStatus === "CLOSED_PERMANENTLY" ? "cerrado definitivamente" : "cerrado temporalmente";
  }
  const nombre = sinTildes(lugar.displayName?.text ?? "");
  const tipos = lugar.types ?? [];
  const pareceCancha = SENAL_CANCHA.test(nombre) || tipos.some((t) => TIPOS_CANCHA.includes(t));

  if (/sport ?shop|tienda|indumentaria|articulos deportivos|casa de deportes|calzado/.test(nombre)) return "tienda de deportes";
  if (tipos.some((t) => TIPOS_TIENDA.includes(t)) && !pareceCancha) return "tienda de deportes";
  if (/escuela|escuelita|colegio|instituto|jardin de infantes/.test(nombre)) return "escuela";
  if (tipos.some((t) => TIPOS_ESCUELA.includes(t))) return "escuela";
  if (/\bclub\b|atletico|asociacion|sociedad de fomento|mutual/.test(nombre) && !SENAL_CANCHA.test(nombre)) return "club con socios";
  if (/gimnasio|\bgym\b|fitness|crossfit/.test(nombre) && !SENAL_CANCHA.test(nombre)) return "gimnasio";
  return null;
}

// ── Distancia ──────────────────────────────────────────

export type Punto = { lat: number; lng: number };

export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ── Conversión ─────────────────────────────────────────

/**
 * Un lugar de Places → complejo. `deportesBuscados`: en qué búsquedas apareció; se usan solo si el nombre
 * no dice el deporte y apareció en una sola búsqueda de deporte concreto (si no, sería inventar).
 */
export function lugarAEncontrado(lugar: LugarPlaces, deportesBuscados: DeporteBusqueda[], centro: Punto | null, radioKm: number): Encontrado {
  const nombre = lugar.displayName?.text?.trim() || "(sin nombre)";
  const { ciudad, provincia } = ciudadYProvincia(lugar);
  const telefono = lugar.internationalPhoneNumber ?? lugar.nationalPhoneNumber ?? null;
  const telefonoWa = normalizarTelefonoAR(telefono);
  let deportes = deportesDesdeTexto(nombre);
  const concretos = [...new Set(deportesBuscados.map((d): Deporte | null => BUSQUEDAS[d].deporte).filter((d): d is Deporte => d !== null))];
  if (!deportes.length && concretos.length === 1) deportes = concretos;
  const lat = lugar.location?.latitude ?? null;
  const lng = lugar.location?.longitude ?? null;
  const resenas = lugar.userRatingCount ?? 0;

  let descarte = motivoDescarte(lugar);
  if (!descarte && centro && lat !== null && lng !== null) {
    const km = distanciaKm(centro, { lat, lng });
    if (km > radioKm) descarte = `fuera del radio (${Math.round(km)} km)`;
  }

  return {
    place_id: lugar.id,
    nombre,
    direccion: lugar.formattedAddress ?? null,
    ciudad,
    provincia,
    telefono,
    telefono_wa: telefonoWa,
    chance: telefonoWa ? chanceWhatsApp(telefono, telefonoWa) : null,
    resenas,
    calificacion: typeof lugar.rating === "number" ? Math.round(lugar.rating * 10) / 10 : null,
    lat,
    lng,
    maps_url: lugar.googleMapsUri ?? null,
    web: lugar.websiteUri && /^https?:\/\//i.test(lugar.websiteUri) ? lugar.websiteUri : null,
    rubro: rubroDesdeDeportes(deportes),
    deportes,
    prioridad: prioridadPorResenas(resenas),
    descarte,
  };
}

/** Une los resultados de todas las búsquedas (un mismo lugar puede salir en fútbol y en pádel). */
export function unirResultados(porBusqueda: { deporte: DeporteBusqueda; lugares: LugarPlaces[] }[], centro: Punto | null, radioKm: number): Encontrado[] {
  const lugares = new Map<string, LugarPlaces>();
  const enBusquedas = new Map<string, DeporteBusqueda[]>();
  for (const { deporte, lugares: lista } of porBusqueda) {
    for (const l of lista) {
      if (!l.id) continue;
      if (!lugares.has(l.id)) lugares.set(l.id, l);
      enBusquedas.set(l.id, [...(enBusquedas.get(l.id) ?? []), deporte]);
    }
  }
  return [...lugares.values()]
    .map((l) => lugarAEncontrado(l, enBusquedas.get(l.id) ?? [], centro, radioKm))
    .sort((a, b) => Number(a.descarte !== null) - Number(b.descarte !== null) || b.resenas - a.resenas);
}
