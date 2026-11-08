import { ETIQUETA_ESTADO, type EstadoProspecto } from "@/lib/dominio/tipos";
import { Etiqueta, cx } from "./ui";

const TONO_ESTADO: Record<EstadoProspecto, "ok" | "debe" | "aviso" | "neutro" | "marca"> = {
  sin_contactar: "neutro",
  en_tanda: "aviso",
  contactado: "neutro",
  respondio: "aviso",
  interesado: "marca",
  demo: "ok",
  cliente: "ok",
  descartado: "neutro",
  no_contactar: "debe",
};

export function EtiquetaEstado({ estado }: { estado: EstadoProspecto }) {
  return <Etiqueta tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Etiqueta>;
}

/** Barra de progreso (0 a 100). Si hay algo, siempre se ve un poquito. */
export function Barra({ valor, etiqueta, tono = "marca", className }: { valor: number; etiqueta: string; tono?: "marca" | "acento"; className?: string }) {
  const acotado = Math.min(100, Math.max(0, Math.round(valor)));
  return (
    <div role="progressbar" aria-valuenow={acotado} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta} className={cx("h-2 overflow-hidden rounded-full bg-hundido", className)}>
      <div className={cx("h-full rounded-full", tono === "marca" ? "bg-marca" : "bg-acento")} style={{ width: `${acotado > 0 ? Math.max(acotado, 2) : 0}%` }} />
    </div>
  );
}
