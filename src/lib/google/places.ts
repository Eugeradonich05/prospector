/**
 * Cliente mínimo de Google Places API (New), `places:searchText`. Recibe `fetch` para poder testearlo
 * con respuestas de ejemplo (tests/fixtures) sin llamar a Google. La clave nunca sale del servidor.
 */
import { BUSQUEDAS, unirResultados, type DeporteBusqueda, type Encontrado, type LugarPlaces, type Punto } from "./complejos-google";

export const URL_SEARCH_TEXT = "https://places.googleapis.com/v1/places:searchText";

/** Field mask mínimo (nextPageToken hace falta para paginar). */
export const CAMPOS_LUGAR = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.businessStatus",
  "places.types",
  "places.addressComponents",
  "nextPageToken",
].join(",");
const CAMPOS_ZONA = "places.location,places.formattedAddress";

export const MAX_PAGINAS = 3; // 20 por página: hasta 60 resultados por consulta
const POR_PAGINA = 20;
const TIEMPO_MAXIMO_MS = 15_000;

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class ErrorPlaces extends Error {}

type RespuestaSearch = { places?: LugarPlaces[]; nextPageToken?: string };

export function crearClientePlaces(apiKey: string, fetchImpl: Fetch) {
  let llamadas = 0;

  async function searchText(cuerpo: Record<string, unknown>, campos: string): Promise<RespuestaSearch> {
    llamadas++;
    const r = await fetchImpl(URL_SEARCH_TEXT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": campos },
      body: JSON.stringify({ languageCode: "es", regionCode: "AR", ...cuerpo }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const datos = (await r.json().catch(() => ({}))) as RespuestaSearch & { error?: { message?: string; status?: string } };
    if (!r.ok) {
      // El mensaje de Google no incluye la clave; se muestra para saber qué configurar.
      throw new ErrorPlaces(`Google respondió ${r.status}${datos.error?.status ? ` (${datos.error.status})` : ""}: ${datos.error?.message ?? "sin detalle"}`);
    }
    return datos;
  }

  return {
    get llamadas() {
      return llamadas;
    },

    /** Centro de la zona escrita ("San Nicolás de los Arroyos"). */
    async ubicarZona(zona: string): Promise<{ centro: Punto; direccion: string | null } | null> {
      const r = await searchText({ textQuery: `${zona}, Argentina`, pageSize: 1 }, CAMPOS_ZONA);
      const lugar = r.places?.[0];
      const lat = lugar?.location?.latitude;
      const lng = lugar?.location?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return { centro: { lat, lng }, direccion: lugar?.formattedAddress ?? null };
    },

    /** Una consulta, paginando hasta MAX_PAGINAS. */
    async buscar(textQuery: string, centro: Punto, radioKm: number): Promise<LugarPlaces[]> {
      const base = {
        textQuery,
        pageSize: POR_PAGINA,
        locationBias: { circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius: Math.min(radioKm, 50) * 1000 } },
      };
      const lugares: LugarPlaces[] = [];
      let pageToken: string | undefined;
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const r = await searchText(pageToken ? { ...base, pageToken } : base, CAMPOS_LUGAR);
        lugares.push(...(r.places ?? []));
        pageToken = r.nextPageToken;
        if (!pageToken) break;
      }
      return lugares;
    },
  };
}

export type ResultadoBusqueda = { encontrados: Encontrado[]; llamadas: number; centro: Punto; direccionZona: string | null };

/** Busca complejos en una zona: una consulta por deporte («canchas de pádel en San Nicolás…»). */
export async function buscarComplejos(opciones: { zona: string; radioKm: number; deportes: DeporteBusqueda[]; apiKey: string; fetch: Fetch }): Promise<ResultadoBusqueda> {
  const cliente = crearClientePlaces(opciones.apiKey, opciones.fetch);
  const ubicacion = await cliente.ubicarZona(opciones.zona);
  if (!ubicacion) throw new ErrorPlaces(`No encontré «${opciones.zona}» en Google Maps. Probá con la ciudad y la provincia.`);

  const porBusqueda = await Promise.all(
    opciones.deportes.map(async (deporte) => ({
      deporte,
      lugares: await cliente.buscar(`${BUSQUEDAS[deporte].consulta} en ${opciones.zona}`, ubicacion.centro, opciones.radioKm),
    })),
  );
  return {
    encontrados: unirResultados(porBusqueda, ubicacion.centro, opciones.radioKm),
    llamadas: cliente.llamadas,
    centro: ubicacion.centro,
    direccionZona: ubicacion.direccion,
  };
}
