import type { EstadoProspecto, Prospecto } from "./tipos";

/** Cálculos para los paneles de Hoy. Puros: reciben las filas ya leídas de la base. */
export type FilaMetricas = Pick<Prospecto, "estado" | "contactado_el" | "ultimo_entrante_el" | "provincia" | "telefono_wa">;

const RESPONDIO: EstadoProspecto[] = ["respondio", "interesado", "demo", "cliente"];
const ETAPAS = ["Contactados", "Respondieron", "Interesados", "Demo", "Clientes"] as const;

/** Hasta qué etapa llegó cada complejo (0 = todavía nada). Así el embudo nunca crece de una etapa a la siguiente. */
function etapaAlcanzada(f: FilaMetricas): number {
  if (f.estado === "cliente") return 5;
  if (f.estado === "demo") return 4;
  if (f.estado === "interesado") return 3;
  if (f.ultimo_entrante_el || RESPONDIO.includes(f.estado)) return 2;
  return f.contactado_el ? 1 : 0;
}

export type EtapaEmbudo = {
  etiqueta: (typeof ETAPAS)[number];
  cantidad: number;
  /** Ancho de la barra: porcentaje respecto de la primera etapa. */
  ancho: number;
  /** Conversión desde la etapa anterior; null en la primera o si la anterior está en cero. */
  conversion: number | null;
};

export function calcularEmbudo(filas: FilaMetricas[]): EtapaEmbudo[] {
  const alcanzadas = filas.map(etapaAlcanzada);
  const cantidades = ETAPAS.map((_, i) => alcanzadas.filter((a) => a >= i + 1).length);
  return ETAPAS.map((etiqueta, i) => {
    const cantidad = cantidades[i]!;
    const anterior = i > 0 ? cantidades[i - 1]! : 0;
    return {
      etiqueta,
      cantidad,
      ancho: cantidades[0] ? Math.round((cantidad / cantidades[0]) * 100) : 0,
      conversion: anterior ? Math.round((cantidad / anterior) * 100) : null,
    };
  });
}

export type ResumenBase = { total: number; sinContactar: number; respuestasHoy: number; bajas: number; contactados: number; alertaBajas: boolean };

const MINIMO_PARA_ALERTA = 20;
const TASA_ALERTA = 0.1;

export function resumirBase(filas: FilaMetricas[], inicioDia: string): ResumenBase {
  const desde = new Date(inicioDia).getTime();
  const contactados = filas.filter((f) => f.contactado_el).length;
  const bajas = filas.filter((f) => f.estado === "no_contactar" && f.contactado_el).length;
  return {
    total: filas.length,
    sinContactar: filas.filter((f) => f.estado === "sin_contactar" && f.telefono_wa).length,
    respuestasHoy: filas.filter((f) => f.ultimo_entrante_el && new Date(f.ultimo_entrante_el).getTime() >= desde).length,
    bajas,
    contactados,
    // Con pocos contactos un par de bajas no dice nada.
    alertaBajas: contactados >= MINIMO_PARA_ALERTA && bajas / contactados >= TASA_ALERTA,
  };
}

export type CoberturaProvincia = { provincia: string; total: number; contactados: number; sinContactar: number; porcentaje: number };

/** Cuánto se barrió de cada provincia, con las que más complejos tienen por contactar primero. */
export function coberturaPorProvincia(filas: FilaMetricas[], maximo = 8): CoberturaProvincia[] {
  const mapa = new Map<string, { total: number; contactados: number; sinContactar: number }>();
  for (const f of filas) {
    if (!f.provincia) continue;
    const p = mapa.get(f.provincia) ?? { total: 0, contactados: 0, sinContactar: 0 };
    mapa.set(f.provincia, {
      total: p.total + 1,
      contactados: p.contactados + (f.contactado_el ? 1 : 0),
      sinContactar: p.sinContactar + (f.estado === "sin_contactar" && f.telefono_wa ? 1 : 0),
    });
  }
  return [...mapa]
    .map(([provincia, c]) => ({ provincia, ...c, porcentaje: Math.round((c.contactados / c.total) * 100) }))
    .sort((a, b) => b.sinContactar - a.sinContactar || a.provincia.localeCompare(b.provincia, "es"))
    .slice(0, maximo);
}

export type PasoHoy = { titulo: string; detalle: string; href: string; tono: "debe" | "marca" | "neutro" };

export type DatosPasos = { urgentes: number; porEnviar: number; seguimientos: number; tandaArmada: boolean; cupoRestante: number; sinContactar: number };

/** Qué conviene hacer ahora, de lo más urgente a lo menos. El primero es el foco del día. */
export function proximosPasos(d: DatosPasos): PasoHoy[] {
  const pasos: PasoHoy[] = [];
  if (d.urgentes) {
    const titulo = d.urgentes === 1 ? "Respondé a 1 complejo que te necesita" : `Respondé a ${d.urgentes} complejos que te necesitan`;
    pasos.push({ titulo, detalle: "El bot dejó estas charlas para vos.", href: "#te-necesitan", tono: "debe" });
  }
  if (d.porEnviar) {
    const titulo = d.porEnviar === 1 ? "Mandá 1 mensaje de la tanda" : `Mandá ${d.porEnviar} mensajes de la tanda`;
    pasos.push({ titulo, detalle: "Espaciados durante el día, desde tu WhatsApp.", href: "#tanda", tono: "marca" });
  }
  if (d.seguimientos) {
    const titulo = d.seguimientos === 1 ? "Mandá 1 seguimiento" : `Mandá ${d.seguimientos} seguimientos`;
    pasos.push({ titulo, detalle: "Contactados hace 3 días que no respondieron. Uno solo por complejo.", href: "#seguimientos", tono: "neutro" });
  }
  if (!d.tandaArmada && d.cupoRestante > 0 && d.sinContactar > 0) {
    pasos.push({ titulo: "Armá la tanda de hoy", detalle: `Quedan ${d.sinContactar} complejos por contactar.`, href: "#tanda", tono: "marca" });
  }
  if (!d.sinContactar) {
    pasos.push({ titulo: "Buscá complejos nuevos", detalle: "No quedan complejos con WhatsApp sin contactar.", href: "/buscar", tono: "neutro" });
  }
  return pasos;
}
