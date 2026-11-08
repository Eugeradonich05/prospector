"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";
import { Barra } from "@/components/visual";
import { Boton, cx } from "@/components/ui";

/**
 * Los mensajes de la tanda, de a uno (para concentrarse) o todos juntos.
 * Los ocultos siguen montados: si editaste un mensaje y cambiás de complejo, no se pierde.
 */
export function ListaTanda({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [deAUno, setDeAUno] = useState(true);
  const [indice, setIndice] = useState(0);
  // Al mandar uno la lista se achica y queda a la vista el siguiente.
  const actual = Math.max(0, Math.min(indice, items.length - 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Cómo ver la tanda" className="inline-flex rounded-md border border-linea p-0.5 text-sm font-semibold">
          {[
            [true, "Uno por vez"],
            [false, "Todos"],
          ].map(([valor, texto]) => (
            <button
              key={String(valor)}
              type="button"
              aria-pressed={deAUno === valor}
              onClick={() => setDeAUno(valor as boolean)}
              className={cx("rounded px-3 py-1", deAUno === valor ? "bg-marca-suave text-marca" : "text-tenue hover:text-tinta")}
            >
              {texto}
            </button>
          ))}
        </div>
        {deAUno && items.length > 1 ? (
          <div className="flex items-center gap-2">
            <Boton type="button" variante="secundario" disabled={actual === 0} onClick={() => setIndice(actual - 1)}>
              ← Anterior
            </Boton>
            <span className="num text-sm font-semibold">
              {actual + 1} de {items.length}
            </span>
            <Boton type="button" variante="secundario" disabled={actual === items.length - 1} onClick={() => setIndice(actual + 1)}>
              Siguiente →
            </Boton>
          </div>
        ) : null}
      </div>
      {deAUno && items.length > 1 ? <Barra valor={((actual + 1) / items.length) * 100} etiqueta="Posición en la tanda" tono="acento" /> : null}
      <ul className="flex flex-col gap-4">
        {items.map((item, i) => (
          <li key={isValidElement(item) && item.key !== null ? item.key : i} hidden={deAUno && i !== actual}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
