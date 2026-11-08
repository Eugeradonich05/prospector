import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import type { Prospecto } from "@/lib/dominio/tipos";
import { haceCuanto } from "@/lib/dominio/fechas";
import { horasRestantesVentana } from "@/lib/dominio/ventana";
import { EtiquetaEstado } from "@/components/visual";
import { Encabezado, Etiqueta, Tarjeta, Vacio, cx } from "@/components/ui";

export const metadata = { title: "Conversaciones" };

/** Con pocas horas por delante conviene contestar antes: después solo se puede desde el celular. */
const HORAS_POCAS = 4;

export default async function Conversaciones({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro = "activas" } = await searchParams;
  let q = db().from("prospectos").select("*").not("ultimo_entrante_el", "is", null).order("ultimo_entrante_el", { ascending: false }).limit(300);
  if (filtro === "te-necesitan") q = q.eq("necesita_humano", true);
  if (filtro === "activas") q = q.in("estado", ["respondio", "interesado", "demo"]);
  const { data } = await q;
  const lista = (data ?? []) as Prospecto[];

  return (
    <>
      <Encabezado titulo="Conversaciones" detalle="Complejos que respondieron, la más reciente primero." />
      <nav className="flex gap-1" aria-label="Filtrar">
        {[
          ["activas", "Activas"],
          ["te-necesitan", "Te necesitan"],
          ["todas", "Todas"],
        ].map(([id, t]) => (
          <Link
            key={id}
            href={`/conversaciones?filtro=${id}`}
            aria-current={filtro === id ? "page" : undefined}
            className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", filtro === id ? "bg-tinta text-papel" : "bg-superficie text-tenue hover:text-tinta")}
          >
            {t}
          </Link>
        ))}
      </nav>
      {!lista.length ? (
        <Vacio titulo="Nada por acá todavía.">Cuando un complejo conteste, aparece en esta lista.</Vacio>
      ) : (
        <Tarjeta>
          <ul className="flex flex-col divide-y divide-linea">
            {lista.map((p) => (
              <li key={p.id}>
                <Link href={`/conversaciones/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-hundido/60">
                  <span className="min-w-0">
                    <span className="font-semibold">{p.nombre}</span>
                    <span className="text-sm text-tenue">
                      {" "}
                      · {p.ciudad}
                      {p.ultimo_entrante_el ? ` · ${haceCuanto(p.ultimo_entrante_el)}` : ""}
                    </span>
                    {p.motivo_humano && p.necesita_humano ? <span className="block text-sm text-debe">{p.motivo_humano}</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {p.necesita_humano ? <Etiqueta tono="debe">Te necesita</Etiqueta> : null}
                    {!p.bot_activo || (p.humano_hasta && new Date(p.humano_hasta) > new Date()) ? <Etiqueta>Bot en pausa</Etiqueta> : null}
                    <EtiquetaVentana ultimo={p.ultimo_entrante_el} />
                    <EtiquetaEstado estado={p.estado} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}

function EtiquetaVentana({ ultimo }: { ultimo: string | null }) {
  const horas = horasRestantesVentana(ultimo);
  if (horas === null) return <Etiqueta>Ventana cerrada</Etiqueta>;
  return <Etiqueta tono={horas <= HORAS_POCAS ? "debe" : "neutro"}>Quedan {horas} h</Etiqueta>;
}
