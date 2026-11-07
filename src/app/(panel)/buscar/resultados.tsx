"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones";
import { Boton, Etiqueta, Tabla, Tarjeta, TituloSeccion, cx } from "@/components/ui";
import { enlaceSeguro } from "@/lib/dominio/datos-complejo";
import { agregarEncontrados } from "./acciones";

export type FilaResultado = {
  place_id: string;
  nombre: string;
  ciudad: string | null;
  resenas: number;
  calificacion: number | null;
  telefono: string | null;
  chance: "alta" | "media" | "baja" | null;
  maps_url: string | null;
  descarte: string | null;
  /** Solo en «Ya en la base». */
  estado?: string;
};

function BotonModo({ modo, children, variante, deshabilitado }: { modo: "solo" | "tanda"; children: React.ReactNode; variante?: "primario" | "secundario"; deshabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" name="modo" value={modo} variante={variante} disabled={pending || deshabilitado}>
      {pending ? "Un momento…" : children}
    </Boton>
  );
}

function Telefono({ f }: { f: FilaResultado }) {
  if (!f.telefono) return <span className="text-tenue">Sin teléfono</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="num">{f.telefono}</span>
      {f.chance === "alta" ? <Etiqueta tono="marca">Celular</Etiqueta> : <Etiqueta>WhatsApp sin confirmar</Etiqueta>}
    </span>
  );
}

function Maps({ url }: { url: string | null }) {
  const seguro = enlaceSeguro(url);
  return seguro ? (
    <a href={seguro} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
      Maps
    </a>
  ) : null;
}

/** Resultados de una búsqueda: los nuevos (marcados) y los que ya están en la base. */
export function Resultados({ busquedaId, nuevos, yaEnBase }: { busquedaId: string; nuevos: FilaResultado[]; yaEnBase: FilaResultado[] }) {
  const [elegidos, setElegidos] = useState(() => new Set(nuevos.filter((n) => !n.descarte).map((n) => n.place_id)));
  const [estado, despachar] = useActionState<EstadoAccion, FormData>(agregarEncontrados, ESTADO_INICIAL);
  // Solo cuentan los que siguen en la lista (los ya agregados pasan a «Ya en la base»).
  const n = nuevos.filter((f) => elegidos.has(f.place_id)).length;

  const alternar = (id: string) =>
    setElegidos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  return (
    <>
      <Tarjeta className="flex flex-col gap-4 p-5">
        <TituloSeccion
          titulo={`Nuevos (${nuevos.filter((x) => !x.descarte).length})`}
          detalle="No están en la base. Los tachados parecen no ser complejos de alquiler (clubes con socios, escuelas, tiendas, cerrados o fuera del radio): marcalos si me equivoqué."
        />
        {nuevos.length ? (
          <form action={despachar} className="flex flex-col gap-4">
            <input type="hidden" name="busqueda" value={busquedaId} />
            <Tabla>
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Elegir</span>
                  </th>
                  <th>Complejo</th>
                  <th>Ciudad</th>
                  <th>Reseñas</th>
                  <th>Calificación</th>
                  <th>Teléfono</th>
                  <th>
                    <span className="sr-only">Mapa</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {nuevos.map((f) => (
                  <tr key={f.place_id} className={cx(f.descarte && "text-tenue")}>
                    <td>
                      <input
                        type="checkbox"
                        name="place_id"
                        value={f.place_id}
                        checked={elegidos.has(f.place_id)}
                        onChange={() => alternar(f.place_id)}
                        aria-label={`Agregar ${f.nombre}`}
                        className="size-4 accent-[var(--marca)]"
                      />
                    </td>
                    <td>
                      <span className={cx("font-semibold", f.descarte && "line-through")}>{f.nombre}</span>
                      {f.descarte ? <span className="block text-xs text-acento-tinta">{f.descarte}</span> : null}
                    </td>
                    <td>{f.ciudad}</td>
                    <td className="num">{f.resenas}</td>
                    <td className="num">{f.calificacion ?? "—"}</td>
                    <td>
                      <Telefono f={f} />
                    </td>
                    <td>
                      <Maps url={f.maps_url} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <div className="flex flex-wrap items-center gap-3">
              <BotonModo modo="tanda" deshabilitado={!n}>
                Agregar y armar tanda con estos
              </BotonModo>
              <BotonModo modo="solo" variante="secundario" deshabilitado={!n}>
                Agregar los {n} seleccionados
              </BotonModo>
            </div>
            <p className="text-xs text-tenue">
              «Agregar y armar tanda» los carga como «Sin contactar» y arma la tanda de hoy solo con ellos (respetando el límite diario y lo que ya mandaste hoy), con un
              mensaje de Claude para cada uno. Tarda uno o dos minutos y te lleva a Hoy.
            </p>
            {estado.error || estado.ok ? (
              <p role="status" aria-live="polite" className={cx("rounded-md px-3 py-2 text-sm", estado.error ? "bg-debe-suave text-debe" : "bg-ok-suave text-ok")}>
                {estado.error ?? estado.ok}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="text-sm text-tenue">Todo lo que encontró ya está en la base.</p>
        )}
      </Tarjeta>

      {yaEnBase.length ? (
        <Tarjeta className="flex flex-col gap-3 p-5">
          <TituloSeccion titulo={`Ya en la base (${yaEnBase.length})`} />
          <Tabla>
            <thead>
              <tr>
                <th>Complejo</th>
                <th>Ciudad</th>
                <th>Reseñas</th>
                <th>Calificación</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Mapa</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {yaEnBase.map((f) => (
                <tr key={f.place_id}>
                  <td className="font-semibold">{f.nombre}</td>
                  <td>{f.ciudad}</td>
                  <td className="num">{f.resenas}</td>
                  <td className="num">{f.calificacion ?? "—"}</td>
                  <td>
                    <Telefono f={f} />
                  </td>
                  <td>{f.estado}</td>
                  <td>
                    <Maps url={f.maps_url} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : null}
    </>
  );
}
