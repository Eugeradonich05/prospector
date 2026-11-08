import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { leerTodo } from "@/lib/datos/leer-todo";
import { DEPORTES, ETIQUETA_SISTEMA, SISTEMAS, type SistemaActual } from "@/lib/dominio/complejos";
import { ORDENES, contarPorEstado, filtrarComplejos, ordenarComplejos, paginar, type FilaComplejo, type Orden } from "@/lib/dominio/lista-complejos";
import { ETIQUETA_ESTADO, type EstadoProspecto } from "@/lib/dominio/tipos";
import { BotonLink, Encabezado, Entrada, Selector, Tabla, Tarjeta, Vacio, cx } from "@/components/ui";
import { EtiquetaEstado } from "@/components/visual";
import { Tablero } from "./tablero";

export const metadata = { title: "Complejos" };

const POR_PAGINA = 50;
const COLUMNAS = "id, nombre, rubro, ciudad, provincia, prioridad, estado, resenas, deportes, sistema_actual, telefono_wa, ultimo_entrante_el, contactado_el";

type Parametros = { provincia?: string; ciudad?: string; deporte?: string; estado?: string; sistema?: string; q?: string; orden?: string; vista?: string; pagina?: string };

const claseTab = (activa: boolean) => cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", activa ? "bg-tinta text-papel" : "bg-superficie text-tenue hover:text-tinta");

export default async function Complejos({ searchParams }: { searchParams: Promise<Parametros> }) {
  const f = await searchParams;
  const estado = f.estado && f.estado in ETIQUETA_ESTADO ? (f.estado as EstadoProspecto) : null;
  const deporte = (DEPORTES as readonly string[]).includes(f.deporte ?? "") ? (f.deporte as string) : null;
  const sistema = f.sistema === "desconocido" ? "desconocido" : (SISTEMAS as readonly string[]).includes(f.sistema ?? "") ? (f.sistema as SistemaActual) : null;
  const q = (f.q ?? "").trim().slice(0, 100);
  const provincia = (f.provincia ?? "").slice(0, 120) || null;
  const ciudad = (f.ciudad ?? "").slice(0, 120) || null;
  const orden: Orden = f.orden && f.orden in ORDENES ? (f.orden as Orden) : "prioridad";
  const tablero = f.vista === "tablero";

  const todas = await leerTodo<FilaComplejo>((desde, hasta) => db().from("prospectos").select(COLUMNAS).order("id").range(desde, hasta));
  const filtradas = filtrarComplejos(todas, { provincia, ciudad, deporte, sistema, q });
  const conteo = contarPorEstado(filtradas);
  const deEstado = estado ? filtradas.filter((p) => p.estado === estado) : filtradas;
  const pagina = paginar(ordenarComplejos(deEstado, orden), Number(f.pagina ?? "1"), POR_PAGINA);

  const provincias = [...new Set(todas.map((l) => l.provincia).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, "es"));
  const ciudades = [...new Set(todas.filter((l) => !provincia || l.provincia === provincia).map((l) => l.ciudad).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "es"));
  const hayFiltros = Boolean(provincia || ciudad || deporte || sistema || q);

  /** Enlace a esta misma pantalla cambiando solo lo indicado (y volviendo a la página 1). */
  const enlace = (cambios: Partial<Record<keyof Parametros, string | null>>) => {
    const actuales: Record<string, string | null> = { provincia, ciudad, deporte, sistema, q: q || null, estado, orden: orden === "prioridad" ? null : orden, vista: tablero ? "tablero" : null, ...cambios };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(actuales)) if (v) p.set(k, v);
    return `/complejos${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <Encabezado
        titulo="Complejos"
        detalle={`${deEstado.length} ${hayFiltros || estado ? "con estos filtros" : "en la base"}`}
        acciones={
          <>
            <BotonLink href="/complejos/nuevo">Agregar a mano</BotonLink>
            <BotonLink href="/complejos/importar" variante="secundario">
              Importar planilla
            </BotonLink>
          </>
        }
      />

      <Tarjeta className="p-4">
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filtrar complejos">
          {estado ? <input type="hidden" name="estado" value={estado} /> : null}
          {tablero ? <input type="hidden" name="vista" value="tablero" /> : null}
          <label className="flex flex-col gap-1 text-sm font-semibold lg:col-span-2">
            Nombre
            <Entrada name="q" defaultValue={q} placeholder="Buscar por nombre" type="search" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Provincia
            <Selector name="provincia" defaultValue={provincia ?? ""}>
              <option value="">Todas</option>
              {provincias.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Selector>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Ciudad
            <Selector name="ciudad" defaultValue={ciudad ?? ""}>
              <option value="">Todas</option>
              {ciudades.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Selector>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Deporte
            <Selector name="deporte" defaultValue={deporte ?? ""}>
              <option value="">Todos</option>
              {DEPORTES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Selector>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Sistema actual
            <Selector name="sistema" defaultValue={sistema ?? ""}>
              <option value="">Todos</option>
              <option value="desconocido">No se sabe</option>
              {SISTEMAS.map((s) => (
                <option key={s} value={s}>
                  {ETIQUETA_SISTEMA[s]}
                </option>
              ))}
            </Selector>
          </label>
          {!tablero ? (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Ordenar por
              <Selector name="orden" defaultValue={orden}>
                {Object.entries(ORDENES).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Selector>
            </label>
          ) : null}
          <div className="flex items-end gap-3 sm:col-span-2">
            <button className="rounded-md border border-marca bg-marca px-3.5 py-2 text-sm font-semibold text-marca-tinta hover:brightness-110">Filtrar</button>
            {hayFiltros ? (
              <Link href={enlace({ provincia: null, ciudad: null, deporte: null, sistema: null, q: null })} className="text-sm font-semibold text-tenue hover:text-tinta">
                Limpiar filtros
              </Link>
            ) : null}
          </div>
        </form>
      </Tarjeta>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!tablero ? (
          <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto" aria-label="Filtrar por estado">
            <Link href={enlace({ estado: null })} className={claseTab(!estado)} aria-current={!estado ? "page" : undefined}>
              Todos <span className="num text-xs opacity-70">{filtradas.length}</span>
            </Link>
            {(Object.keys(ETIQUETA_ESTADO) as EstadoProspecto[])
              .filter((e) => conteo[e] || estado === e)
              .map((e) => (
                <Link key={e} href={enlace({ estado: e })} className={claseTab(estado === e)} aria-current={estado === e ? "page" : undefined}>
                  {ETIQUETA_ESTADO[e]} <span className="num text-xs opacity-70">{conteo[e] ?? 0}</span>
                </Link>
              ))}
          </nav>
        ) : (
          <p className="text-sm text-tenue">Sin contactar, descartados y bajas se ven en la lista.</p>
        )}
        <nav className="inline-flex rounded-md border border-linea p-0.5 text-sm font-semibold" aria-label="Vista">
          <Link href={enlace({ vista: null })} aria-current={!tablero ? "page" : undefined} className={cx("rounded px-3 py-1", !tablero ? "bg-marca-suave text-marca" : "text-tenue hover:text-tinta")}>
            Lista
          </Link>
          <Link href={enlace({ vista: "tablero", estado: null })} aria-current={tablero ? "page" : undefined} className={cx("rounded px-3 py-1", tablero ? "bg-marca-suave text-marca" : "text-tenue hover:text-tinta")}>
            Tablero
          </Link>
        </nav>
      </div>

      {tablero ? (
        <Tablero filas={ordenarComplejos(filtradas, "reciente")} enlaceEstado={(e) => enlace({ vista: null, estado: e })} />
      ) : !pagina.items.length ? (
        <Vacio titulo="No hay complejos con estos filtros" />
      ) : (
        <Tarjeta>
          <Tabla>
            <thead>
              <tr>
                <th>Complejo</th>
                <th>Ciudad</th>
                <th>Deportes</th>
                <th>Reseñas</th>
                <th>Sistema</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagina.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/complejos/${p.id}`} className="font-semibold hover:underline">
                      {p.nombre}
                    </Link>
                    <span className="block text-xs text-tenue">
                      {p.rubro} · prioridad {p.prioridad}
                      {p.telefono_wa ? "" : " · sin WhatsApp"}
                    </span>
                  </td>
                  <td className="text-tenue">
                    {p.ciudad}
                    <span className="block text-xs">{p.provincia}</span>
                  </td>
                  <td className="text-tenue">{p.deportes?.length ? p.deportes.join(", ") : "—"}</td>
                  <td className="num">{p.resenas ?? 0}</td>
                  <td className="text-tenue">{p.sistema_actual ? ETIQUETA_SISTEMA[p.sistema_actual] : "—"}</td>
                  <td>
                    <EtiquetaEstado estado={p.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      )}

      {!tablero && pagina.paginas > 1 ? (
        <nav className="flex items-center justify-center gap-4 text-sm font-semibold" aria-label="Páginas">
          {pagina.pagina > 1 ? (
            <Link href={`${enlace({})}${enlace({}).includes("?") ? "&" : "?"}pagina=${pagina.pagina - 1}`} className="text-marca hover:underline">
              ← Anterior
            </Link>
          ) : null}
          <span className="num text-tenue">
            Página {pagina.pagina} de {pagina.paginas}
          </span>
          {pagina.pagina < pagina.paginas ? (
            <Link href={`${enlace({})}${enlace({}).includes("?") ? "&" : "?"}pagina=${pagina.pagina + 1}`} className="text-marca hover:underline">
              Siguiente →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
