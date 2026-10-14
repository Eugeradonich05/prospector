import type { Direccion, Mensaje, Prospecto } from "@/lib/dominio/tipos";

/**
 * Acceso a datos que usa el bot. Hay dos implementaciones:
 * Supabase (producción, en almacen-supabase.ts) y memoria (tests).
 */
export interface Almacen {
  porTelefono(telefonoWa: string): Promise<Prospecto | null>;
  /** Devuelve false si el mensaje (wa_id) ya estaba registrado: así no se procesa dos veces. */
  registrarMensaje(m: { prospecto_id: string; direccion: Direccion; tipo: string; texto: string | null; wa_id: string | null }): Promise<boolean>;
  historial(prospectoId: string, limite: number): Promise<Mensaje[]>;
  contarRespuestasBot(prospectoId: string): Promise<number>;
  actualizar(prospectoId: string, cambios: Partial<Prospecto>): Promise<void>;
}

export function almacenEnMemoria(prospectos: Prospecto[] = []) {
  const mensajes: Mensaje[] = [];
  let seq = 0;
  const almacen: Almacen & { prospectos: Prospecto[]; mensajes: Mensaje[] } = {
    prospectos,
    mensajes,
    async porTelefono(t) {
      return prospectos.find((p) => p.telefono_wa === t) ?? null;
    },
    async registrarMensaje(m) {
      if (m.wa_id && mensajes.some((x) => x.wa_id === m.wa_id)) return false;
      mensajes.push({ ...m, id: ++seq, creado: new Date(Date.now() + seq).toISOString() });
      return true;
    },
    async historial(id, limite) {
      return mensajes.filter((m) => m.prospecto_id === id).slice(-limite);
    },
    async contarRespuestasBot(id) {
      return mensajes.filter((m) => m.prospecto_id === id && m.direccion === "bot").length;
    },
    async actualizar(id, cambios) {
      const p = prospectos.find((x) => x.id === id);
      if (p) Object.assign(p, cambios);
    },
  };
  return almacen;
}
