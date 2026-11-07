import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { leerTodo } from "@/lib/datos/leer-todo";
import { DEPORTES, ETIQUETA_SISTEMA, SISTEMAS, type Deporte, type SistemaActual } from "@/lib/dominio/complejos";
import { ETIQUETA_ESTADO, type EstadoProspecto, type Prospecto } from "@/lib/dominio/tipos";
import { BotonLink, Encabezado, Entrada, Selector, Tabla, Tarjeta, Vacio } from "@/components/ui";

export const metadata = { title: "Complejos" };

const MOSTRAR = 500;

type Filtros = { provincia?: string; ciudad?: string; deporte?: string; estado?: string; sistema?: string; q?: string };

/** Para usar en ilike sin que % o _ funcionen como comodines. */
const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function Complejos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const estado = f.estado && f.estado in ETIQUETA_ESTADO ? (f.estado as EstadoProspecto) : null;
  const deporte = (DEPORTES as readonly string[]).includes(f.deporte ?? "") ? (f.deporte as Deporte) : null;
  const sistema = f.sistema === "desconocido" ? "desconocido" : (SISTEMAS as readonly string[]).includes(f.sistema ?? "") ? (f.sistema as SistemaActual) : null;
  const q = (f.q ?? "").trim().slice(0, 100);
  const provincia = (f.provincia ?? "").slice(0, 120) || null;
  const ciudad = (f.ciudad ?? "").slice(0, 120) || null;

  let consulta = db().from("prospectos").select("id, nombre, rubro, ciudad, provincia, prioridad, estado, resenas, deportes, sistema_actual, telefono_wa", { count: "exact" });
  if (provincia) consulta = consulta.eq("provincia", provincia);
  if (ciudad) consulta = consulta.eq("ciudad", ciudad);
  if (deporte) consulta = consulta.contains("deportes", [deporte]);
  if (estado) consulta = consulta.eq("estado", estado);
  if (sistema === "desconocido") consulta = consulta.is("sistema_actual", null);
  else if (sistema) consulta = consulta.eq("sistema_actual", sistema);
  if (q) consulta = consulta.ilike("nombre", `%${escaparLike(q)}%`);

  const [{ data, count, error }, lugares] = await Promise.all([
    consulta.order("prioridad").order("resenas", { ascending: false }).limit(MOSTRAR),
    leerTodo<{ provincia: string | null; ciudad: string | null }>((desde, hasta) => db().from("prospectos").select("provincia, ciudad").order("id").range(desde, hasta)),
  ]);
  const lista = (data ?? []) as Prospecto[];
  const provincias = [...new Set(lugares.map((l) => l.provincia).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, "es"));
  const ciudades = [...new Set(lugares.filter((l) => !provincia || l.provincia === provincia).map((l) => l.ciudad).filter((c): c is string => Boolean(c)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const hayFiltros = Boolean(provincia || ciudad || deporte || estado || sistema || q);

  return (
    <>
      <Encabezado
        titulo="Complejos"
        detalle={`${count ?? 0} ${hayFiltros ? "con estos filtros" : "en la base"}${(count ?? 0) > lista.length ? ` · se muestran los primeros ${lista.length}` : ""}`}
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
            Estado
            <Selector name="estado" defaultValue={estado ?? ""}>
              <option value="">Todos</option>
              {(Object.keys(ETIQUETA_ESTADO) as EstadoProspecto[]).map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
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
          <div className="flex items-end gap-3 sm:col-span-3 lg:col-span-5">
            <button className="rounded-md border border-marca bg-marca px-3.5 py-2 text-sm font-semibold text-marca-tinta hover:brightness-110">Filtrar</button>
            {hayFiltros ? (
              <Link href="/complejos" className="text-sm font-semibold text-tenue hover:text-tinta">
                Limpiar filtros
              </Link>
            ) : null}
          </div>
        </form>
      </Tarjeta>

      {error ? (
        <Vacio titulo="No pude leer la base">Probá de nuevo en un rato.</Vacio>
      ) : !lista.length ? (
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
              {lista.map((p) => (
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
                  <td>{ETIQUETA_ESTADO[p.estado]}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      )}
    </>
  );
}
