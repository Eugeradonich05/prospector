import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { ETIQUETA_ESTADO, type EstadoProspecto, type Prospecto } from "@/lib/dominio/tipos";
import { LINEAS, lineaDeRubro, type Linea } from "@/lib/dominio/lineas";
import { Encabezado, Tabla, Tarjeta, cx } from "@/components/ui";

export const metadata = { title: "Prospectos" };

export default async function Prospectos({ searchParams }: { searchParams: Promise<{ estado?: string; linea?: string }> }) {
  const { estado, linea } = await searchParams;
  const { data } = await db().from("prospectos").select("id, nombre, rubro, ciudad, prioridad, estado, contactado_el, ultimo_entrante_el").order("prioridad").order("ciudad").limit(2000);
  const base = (data ?? []) as Prospecto[];
  const lineaValida = linea && linea in LINEAS ? (linea as Linea) : linea === "canchas" ? "canchas" : null;
  // Los complejos de canchas (Modo Cancha) no se prospectan desde acá: se ven aparte.
  const deLinea = (p: Prospecto) => lineaDeRubro(p.rubro) ?? "canchas";
  const todos = lineaValida ? base.filter((p) => deLinea(p) === lineaValida) : base;
  const valido = estado && estado in ETIQUETA_ESTADO ? (estado as EstadoProspecto) : null;
  const lista = valido ? todos.filter((p) => p.estado === valido) : todos;
  const conteo = (e: EstadoProspecto) => todos.filter((p) => p.estado === e).length;
  const respondieron = (l: string) => base.filter((p) => deLinea(p) === l && p.ultimo_entrante_el).length;
  const contactados = (l: string) => base.filter((p) => deLinea(p) === l && p.contactado_el).length;
  const enlace = (cambios: { estado?: string | null; linea?: string | null }) => {
    const q = new URLSearchParams();
    const e = cambios.estado === undefined ? valido : cambios.estado;
    const l = cambios.linea === undefined ? lineaValida : cambios.linea;
    if (e) q.set("estado", e);
    if (l) q.set("linea", l);
    return `/prospectos${q.size ? `?${q}` : ""}`;
  };
  const opcionesLinea: { id: string; etiqueta: string }[] = [
    ...(Object.keys(LINEAS) as Linea[]).map((l) => ({ id: l, etiqueta: LINEAS[l].etiqueta })),
    ...(base.some((p) => deLinea(p) === "canchas") ? [{ id: "canchas", etiqueta: "Canchas (Modo Cancha, aparte)" }] : []),
  ];

  return (
    <>
      <Encabezado titulo="Prospectos" detalle={`${base.length} en la base`} />
      <nav className="-mx-1 flex gap-1 overflow-x-auto" aria-label="Filtrar por servicio">
        <Link href={enlace({ linea: null })} className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", !lineaValida ? "bg-marca text-marca-tinta" : "bg-superficie text-tenue")}>
          Todos los servicios
        </Link>
        {opcionesLinea.map((o) => (
          <Link
            key={o.id}
            href={enlace({ linea: o.id })}
            title={`${contactados(o.id)} contactados · ${respondieron(o.id)} respondieron`}
            className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", lineaValida === o.id ? "bg-marca text-marca-tinta" : "bg-superficie text-tenue hover:text-tinta")}
          >
            {o.etiqueta}{" "}
            <span className="num text-xs opacity-70">
              {respondieron(o.id)}/{contactados(o.id)}
            </span>
          </Link>
        ))}
      </nav>
      <p className="-mt-2 text-xs text-tenue">En cada servicio: respondieron / contactados. Sirve para ver qué rubro contesta más.</p>
      <nav className="-mx-1 flex gap-1 overflow-x-auto" aria-label="Filtrar por estado">
        <Link href={enlace({ estado: null })} className={cx("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", !valido ? "bg-tinta text-papel" : "bg-superficie text-tenue")}>
          Todos <span className="num text-xs opacity-70">{todos.length}</span>
        </Link>
        {(Object.keys(ETIQUETA_ESTADO) as EstadoProspecto[]).map((e) => (
          <Link
            key={e}
            href={enlace({ estado: e })}
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
                <td className="text-tenue">
                  {p.rubro}
                  <span className="block text-xs">{lineaDeRubro(p.rubro) ? LINEAS[lineaDeRubro(p.rubro)!].etiqueta : "Modo Cancha (aparte)"}</span>
                </td>
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
