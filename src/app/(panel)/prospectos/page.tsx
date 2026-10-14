import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { ETIQUETA_ESTADO, type EstadoProspecto, type Prospecto } from "@/lib/dominio/tipos";
import { Encabezado, Tabla, Tarjeta, cx } from "@/components/ui";

export const metadata = { title: "Prospectos" };

export default async function Prospectos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const { data } = await db().from("prospectos").select("id, nombre, rubro, ciudad, prioridad, estado, contactado_el, ultimo_entrante_el").order("prioridad").order("ciudad").limit(2000);
  const todos = (data ?? []) as Prospecto[];
  const valido = estado && estado in ETIQUETA_ESTADO ? (estado as EstadoProspecto) : null;
  const lista = valido ? todos.filter((p) => p.estado === valido) : todos;
  const conteo = (e: EstadoProspecto) => todos.filter((p) => p.estado === e).length;

  return (
    <>
      <Encabezado titulo="Prospectos" detalle={`${todos.length} en la base`} />
      <nav className="-mx-1 flex gap-1 overflow-x-auto" aria-label="Filtrar por estado">
        <Link href="/prospectos" className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", !valido ? "bg-tinta text-papel" : "bg-superficie text-tenue")}>
          Todos <span className="num text-xs opacity-70">{todos.length}</span>
        </Link>
        {(Object.keys(ETIQUETA_ESTADO) as EstadoProspecto[]).map((e) => (
          <Link
            key={e}
            href={`/prospectos?estado=${e}`}
            className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", valido === e ? "bg-tinta text-papel" : "bg-superficie text-tenue hover:text-tinta")}
          >
            {ETIQUETA_ESTADO[e]} <span className="num text-xs opacity-70">{conteo(e)}</span>
          </Link>
        ))}
      </nav>
      <Tarjeta>
        <Tabla>
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Rubro</th>
              <th>Ciudad</th>
              <th>Prioridad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.ultimo_entrante_el ? (
                    <Link href={`/conversaciones/${p.id}`} className="font-semibold hover:underline">
                      {p.nombre}
                    </Link>
                  ) : (
                    <span className="font-semibold">{p.nombre}</span>
                  )}
                </td>
                <td className="text-tenue">{p.rubro}</td>
                <td className="text-tenue">{p.ciudad}</td>
                <td className="num">{p.prioridad}</td>
                <td>{ETIQUETA_ESTADO[p.estado]}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Tarjeta>
    </>
  );
}
