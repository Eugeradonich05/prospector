"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones";
import { Boton, cx } from "./ui";

type Accion = (previo: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;

/**
 * Formulario conectado a una Server Action: muestra el resultado (ok / error)
 * y opcionalmente se limpia al guardar bien.
 */
export function Formulario({
  accion,
  children,
  className,
  limpiarAlGuardar = false,
  id,
}: {
  accion: Accion;
  children: ReactNode;
  className?: string;
  limpiarAlGuardar?: boolean;
  id?: string;
}) {
  const [estado, despachar] = useActionState(accion, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok && limpiarAlGuardar) ref.current?.reset();
  }, [estado.marca, estado.ok, limpiarAlGuardar]);

  return (
    <form ref={ref} action={despachar} className={cx("flex flex-col gap-4", className)} id={id}>
      {children}
      <Mensaje estado={estado} />
    </form>
  );
}

function Mensaje({ estado }: { estado: EstadoAccion }) {
  if (!estado.ok && !estado.error) return null;
  return (
    <p role="status" aria-live="polite" className={cx("rounded-md px-3 py-2 text-sm", estado.error ? "bg-debe-suave text-debe" : "bg-ok-suave text-ok")}>
      {estado.error ?? estado.ok}
    </p>
  );
}

/** Botón de envío que se deshabilita mientras la acción corre. */
export function Enviar({ children, variante, className }: { children: ReactNode; variante?: "primario" | "secundario" | "fantasma" | "peligro" | "mp"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" variante={variante} disabled={pending} className={className}>
      {pending ? "Un momento…" : children}
    </Boton>
  );
}
