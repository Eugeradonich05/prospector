"use client";

import { useState } from "react";
import { cx } from "./ui";

/**
 * Abre WhatsApp con el mensaje escrito. Vos tocás Enviar en la app.
 * Con coexistencia, el envío llega al webhook como "eco" y el prospecto pasa solo a Contactado.
 */
export function AbrirWhatsApp({ telefono, mensaje, className }: { telefono: string; mensaje: string; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <a
      href={`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setAbierto(true)}
      className={cx(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold",
        abierto ? "border-linea bg-hundido text-tenue" : "border-marca bg-marca text-marca-tinta hover:brightness-110",
        className,
      )}
    >
      {abierto ? "Abierto ✓" : "Abrir WhatsApp"}
    </a>
  );
}
