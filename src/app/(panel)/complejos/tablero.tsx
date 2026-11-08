import Link from "next/link";
import { ETIQUETA_SISTEMA } from "@/lib/dominio/complejos";
import { haceCuanto } from "@/lib/dominio/fechas";
import type { FilaComplejo } from "@/lib/dominio/lista-complejos";
import { ETIQUETA_ESTADO, type EstadoProspecto } from "@/lib/dominio/tipos";

/** Las etapas donde hay algo en movimiento. Sin contactar, descartados y bajas quedan en la lista. */
const COLUMNAS: EstadoProspecto[] = ["en_tanda", "contactado", "respondio", "interesado", "demo", "cliente"];
const MAX_POR_COLUMNA = 30;

/** Vista de tablero: cada complejo en la etapa en la que está. */
export function Tablero({ filas, enlaceEstado }: { filas: FilaComplejo[]; enlaceEstado: (e: EstadoProspecto) => string }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
      {COLUMNAS.map((estado) => {
        const deColumna = filas.filter((p) => p.estado === estado);
        const sobrantes = deColumna.length - MAX_POR_COLUMNA;
        return (
          <section key={estado} aria-label={ETIQUETA_ESTADO[estado]} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-hundido/60 p-2">
            <h2 className="flex items-baseline justify-between px-1 text-sm font-bold">
              {ETIQUETA_ESTADO[estado]} <span className="num text-xs font-semibold text-tenue">{deColumna.length}</span>
            </h2>
            {deColumna.slice(0, MAX_POR_COLUMNA).map((p) => (
              <Link key={p.id} href={`/complejos/${p.id}`} className="rounded-md border border-linea bg-superficie p-2.5 text-sm hover:border-marca">
                <span className="block font-semibold">{p.nombre}</span>
                <span className="block text-xs text-tenue">{[p.ciudad, p.sistema_actual ? ETIQUETA_SISTEMA[p.sistema_actual] : null].filter(Boolean).join(" · ")}</span>
                {p.ultimo_entrante_el ? <span className="mt-1 block text-xs text-acento-tinta">Respondió {haceCuanto(p.ultimo_entrante_el)}</span> : null}
              </Link>
            ))}
            {sobrantes > 0 ? (
              <Link href={enlaceEstado(estado)} className="px-1 text-xs font-semibold text-marca underline">
                y {sobrantes} más
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
