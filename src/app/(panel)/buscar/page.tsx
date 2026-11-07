import Link from "next/link";
import { env } from "@/lib/env";
import { db } from "@/lib/datos/supabase";
import { buscarDuplicados } from "@/lib/dominio/complejos";
import { ETIQUETA_ESTADO, type Busqueda, type EstadoProspecto } from "@/lib/dominio/tipos";
import { BUSQUEDAS, DEPORTES_BUSQUEDA } from "@/lib/google/complejos-google";
import { Aviso, Campo, Encabezado, Entrada, Tabla, Tarjeta, TituloSeccion } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { buscar } from "./acciones";
import { esquemaEncontrado, leerExistentes } from "./datos";
import { Resultados, type FilaResultado } from "./resultados";

export const metadata = { title: "Buscar complejos" };
// La búsqueda hace hasta 13 llamadas a Google, y «armar tanda» redacta los mensajes con Claude.
export const maxDuration = 120;

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function Buscar({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const conClave = Boolean(env().GOOGLE_MAPS_API_KEY);
  const { data: ultimas } = await db().from("busquedas").select("id, zona, radio_km, deportes, encontrados, nuevos, llamadas, creado").order("creado", { ascending: false }).limit(10);
  const actual = b && /^[0-9a-f-]{36}$/i.test(b) ? await cargarBusqueda(b) : null;

  return (
    <>
      <Encabezado titulo="Buscar complejos" detalle="Complejos de una zona en Google Maps: los que no están en la base se agregan con un clic." />

      {!conClave ? (
        <Aviso>
          <p className="font-semibold">Falta la clave de Google Maps (GOOGLE_MAPS_API_KEY).</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Entrá a{" "}
              <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Google Cloud Console
              </a>
              , creá un proyecto y activá la facturación (Google da un cupo gratis por mes).
            </li>
            <li>En «APIs y servicios → Biblioteca», buscá y habilitá «Places API (New)».</li>
            <li>En «APIs y servicios → Credenciales», creá una clave de API y restringila a «Places API (New)».</li>
            <li>Cargala en Vercel como GOOGLE_MAPS_API_KEY (solo servidor, sin NEXT_PUBLIC_) y volvé a publicar.</li>
          </ol>
        </Aviso>
      ) : null}

      <Tarjeta className="p-5">
        <Formulario accion={buscar}>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Campo etiqueta="Ciudad o zona" htmlFor="zona">
              <Entrada id="zona" name="zona" required minLength={2} maxLength={120} placeholder="San Nicolás de los Arroyos" defaultValue={actual?.zona ?? ""} />
            </Campo>
            <Campo etiqueta="Radio (km)" htmlFor="radio" ayuda="De 5 a 50.">
              <Entrada id="radio" name="radio" type="number" min={5} max={50} step={1} required defaultValue={actual?.radio_km ?? 15} />
            </Campo>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">Deportes (una búsqueda por cada uno)</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DEPORTES_BUSQUEDA.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="deportes" value={d} defaultChecked={actual ? actual.deportes.includes(d) : true} className="size-4 accent-[var(--marca)]" />
                  {BUSQUEDAS[d].etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
          <Enviar className="self-start">Buscar complejos</Enviar>
        </Formulario>
      </Tarjeta>

      {actual ? (
        <>
          <p className="text-sm text-tenue">
            Búsqueda en <strong className="text-tinta">{actual.zona}</strong> ({actual.radio_km} km) · {fecha(actual.creado)} · {actual.encontradosTotal} lugares ·{" "}
            {actual.llamadas} llamadas a Google
          </p>
          {actual.descartadosPorDanio ? <Aviso tono="debe">{actual.descartadosPorDanio} resultados guardados estaban dañados y no se muestran.</Aviso> : null}
          <Resultados key={actual.id} busquedaId={actual.id} nuevos={actual.nuevos} yaEnBase={actual.yaEnBase} />
        </>
      ) : b ? (
        <Aviso tono="debe">No encontré esa búsqueda.</Aviso>
      ) : null}

      <Tarjeta className="flex flex-col gap-3 p-5">
        <TituloSeccion titulo="Últimas búsquedas" detalle="Para saber qué zonas ya barriste." />
        {ultimas?.length ? (
          <Tabla>
            <thead>
              <tr>
                <th>Zona</th>
                <th>Radio</th>
                <th>Deportes</th>
                <th>Encontrados</th>
                <th>Nuevos</th>
                <th>Llamadas</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/buscar?b=${u.id}`} className="font-semibold hover:underline">
                      {u.zona}
                    </Link>
                  </td>
                  <td className="num">{u.radio_km} km</td>
                  <td className="text-tenue">{u.deportes.map((d) => BUSQUEDAS[d as keyof typeof BUSQUEDAS]?.etiqueta ?? d).join(", ")}</td>
                  <td className="num">{u.encontrados}</td>
                  <td className="num">{u.nuevos}</td>
                  <td className="num">{u.llamadas}</td>
                  <td className="text-tenue">{fecha(u.creado)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        ) : (
          <p className="text-sm text-tenue">Todavía no hiciste ninguna búsqueda.</p>
        )}
      </Tarjeta>
    </>
  );
}

/** Una búsqueda guardada, separada contra la base de hoy (lo que ya cargaste pasa a «Ya en la base»). */
async function cargarBusqueda(id: string) {
  const { data } = await db().from("busquedas").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const busqueda = data as Busqueda;
  // Se valida cada resultado por separado: uno dañado no esconde el resto.
  const crudos = Array.isArray(busqueda.resultados) ? busqueda.resultados : [];
  const encontrados = crudos.flatMap((r) => {
    const v = esquemaEncontrado.safeParse(r);
    return v.success ? [v.data] : [];
  });
  const descartadosPorDanio = crudos.length - encontrados.length;
  const duplicados = buscarDuplicados(encontrados, await leerExistentes());

  const fila = (e: (typeof encontrados)[number]): FilaResultado => ({
    place_id: e.place_id,
    nombre: e.nombre,
    ciudad: e.ciudad,
    resenas: e.resenas,
    calificacion: e.calificacion,
    telefono: e.telefono,
    chance: e.chance,
    maps_url: e.maps_url,
    descarte: e.descarte,
  });
  const nuevos: FilaResultado[] = [];
  const yaEnBase: FilaResultado[] = [];
  encontrados.forEach((e, i) => {
    const d = duplicados[i];
    if (!d) nuevos.push(fila(e));
    else if (d.existente) yaEnBase.push({ ...fila(e), estado: ETIQUETA_ESTADO[d.existente.estado as EstadoProspecto] ?? d.existente.estado });
    // Repetido dentro de la misma búsqueda (mismo teléfono o nombre): se muestra una sola vez.
  });
  return { ...busqueda, encontradosTotal: encontrados.length, descartadosPorDanio, nuevos, yaEnBase };
}
