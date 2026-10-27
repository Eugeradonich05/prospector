"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/", texto: "Hoy" },
  { href: "/conversaciones", texto: "Conversaciones" },
  { href: "/modo-cancha", texto: "Modo Cancha" },
  { href: "/prospectos", texto: "Prospectos" },
  { href: "/conectar", texto: "Conectar WhatsApp" },
];

export function Navegacion() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto">
      {ITEMS.map((i) => {
        const activo = i.href === "/" ? ruta === "/" : ruta.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activo ? "page" : undefined}
            className={cx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold", activo ? "bg-marca-suave text-marca" : "text-tenue hover:bg-hundido hover:text-tinta")}
          >
            {i.texto}
          </Link>
        );
      })}
    </nav>
  );
}
