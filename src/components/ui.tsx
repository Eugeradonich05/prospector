import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Componentes base. Sin dependencias: Tailwind + tokens de globals.css. */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "mp";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-marca-tinta hover:brightness-110 border-marca",
  secundario: "bg-superficie text-tinta border-linea hover:border-marca",
  fantasma: "bg-transparent text-tinta border-transparent hover:bg-hundido",
  peligro: "bg-transparent text-debe border-debe/40 hover:bg-debe-suave",
  // Celeste de Mercado Pago, solo para botones que llevan a pagar o conectar con Mercado Pago.
  mp: "bg-[#009ee3] text-white border-[#009ee3] hover:brightness-110",
};

const BASE_BOTON =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Boton({ variante = "primario", className, ...p }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={cx(BASE_BOTON, VARIANTES[variante], className)} {...p} />;
}

export function BotonLink({ variante = "primario", className, ...p }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={cx(BASE_BOTON, VARIANTES[variante], className)} {...p} />;
}

export function Tarjeta({ className, ...p }: ComponentProps<"section">) {
  return <section className={cx("rounded-lg border border-linea bg-superficie", className)} {...p} />;
}

export function TituloSeccion({ titulo, detalle, accion }: { titulo: string; detalle?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {detalle ? <p className="text-sm text-tenue">{detalle}</p> : null}
      </div>
      {accion}
    </div>
  );
}

export function Encabezado({ titulo, detalle, acciones }: { titulo: string; detalle?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{titulo}</h1>
        {detalle ? <p className="mt-1 text-tenue">{detalle}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

type Tono = "ok" | "debe" | "aviso" | "neutro" | "marca";

const TONOS: Record<Tono, string> = {
  ok: "bg-ok-suave text-ok",
  debe: "bg-debe-suave text-debe",
  aviso: "bg-aviso-suave text-aviso",
  neutro: "bg-hundido text-tenue",
  marca: "bg-marca-suave text-marca",
};

export function Etiqueta({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONOS[tono])}>{children}</span>;
}

export function Campo({ etiqueta, ayuda, children, htmlFor }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {etiqueta}
      </label>
      {children}
      {ayuda ? <p className="text-xs text-tenue">{ayuda}</p> : null}
    </div>
  );
}

const BASE_INPUT =
  "w-full rounded-md border border-linea bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-tenue/70 focus:border-marca focus:outline-none";

export function Entrada({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(BASE_INPUT, className)} {...p} />;
}

export function Selector({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(BASE_INPUT, className)} {...p} />;
}

export function AreaTexto({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(BASE_INPUT, "min-h-24 leading-relaxed", className)} {...p} />;
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-linea bg-superficie p-6">
      <p className="font-semibold">{titulo}</p>
      {children ? <div className="text-sm text-tenue">{children}</div> : null}
      {accion}
    </div>
  );
}

export function Aviso({ tono = "aviso", children }: { tono?: Tono; children: ReactNode }) {
  return <div className={cx("rounded-md px-4 py-3 text-sm", TONOS[tono])}>{children}</div>;
}

/** Tabla con scroll horizontal propio para no romper el ancho en el celular. */
export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:border-linea [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-tenue">
        {children}
      </table>
    </div>
  );
}
