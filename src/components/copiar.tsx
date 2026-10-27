"use client";

import { useState } from "react";
import { cx } from "./ui";

/** Copia un texto al portapapeles (para pegarlo en Instagram o en un mail). */
export function Copiar({ texto, children, className }: { texto: string; children: React.ReactNode; className?: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setListo(true);
          setTimeout(() => setListo(false), 2000);
        } catch {
          // Sin permiso de portapapeles: no pasa nada, el texto está a la vista para copiarlo a mano.
        }
      }}
      className={cx("inline-flex items-center rounded-md border border-linea px-3 py-1.5 text-sm font-semibold text-tinta hover:bg-hundido", className)}
    >
      {listo ? "Copiado ✓" : children}
    </button>
  );
}
