/** Tipos del dominio. Escritos a mano a partir de supabase/migrations. Usar `type`, no `interface`. */
import type { Origen, SistemaActual } from "./complejos";

export type EstadoProspecto =
  | "sin_contactar"
  | "en_tanda"
  | "contactado"
  | "respondio"
  | "interesado"
  | "demo"
  | "cliente"
  | "descartado"
  | "no_contactar";

export type Prospecto = {
  id: string;
  nombre: string;
  rubro: string | null;
  ciudad: string | null;
  provincia: string | null;
  direccion: string | null;
  telefono: string | null;
  telefono_wa: string | null;
  prioridad: "A" | "B" | "C";
  resenas: number | null;
  calificacion: number | null;
  maps_url: string | null;
  estado: EstadoProspecto;
  tanda_fecha: string | null;
  mensaje_inicial: string | null;
  contactado_el: string | null;
  seguimiento_el: string | null;
  ultimo_entrante_el: string | null;
  bot_activo: boolean;
  humano_hasta: string | null;
  necesita_humano: boolean;
  motivo_humano: string | null;
  datos: Record<string, unknown>;
  notas: string | null;
  creado: string;
  place_id: string | null;
  deportes: string[];
  canchas_cantidad: number | null;
  instagram: string | null;
  web: string | null;
  sistema_actual: SistemaActual | null;
  lat: number | null;
  lng: number | null;
  origen: Origen;
};

export type Busqueda = {
  id: string;
  zona: string;
  radio_km: number;
  deportes: string[];
  encontrados: number;
  nuevos: number;
  llamadas: number;
  resultados: unknown;
  creado: string;
};

export type Direccion = "entrante" | "bot" | "humano";

export type Mensaje = {
  id: number;
  prospecto_id: string;
  direccion: Direccion;
  tipo: string;
  texto: string | null;
  wa_id: string | null;
  creado: string;
};

export const ETIQUETA_ESTADO: Record<EstadoProspecto, string> = {
  sin_contactar: "Sin contactar",
  en_tanda: "En la tanda de hoy",
  contactado: "Contactado",
  respondio: "Respondió",
  interesado: "Interesado",
  demo: "Demo acordada",
  cliente: "Cliente",
  descartado: "Descartado",
  no_contactar: "No contactar",
};

/** Estados a partir de los cuales el bot puede conversar (el negocio ya recibió tu mensaje). */
export const ESTADOS_CONVERSABLES: EstadoProspecto[] = ["contactado", "respondio", "interesado", "demo"];

type Opcional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Esquema para supabase-js (equivale a `supabase gen types`). */
export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      prospectos: {
        Row: Prospecto;
        Insert: Opcional<Prospecto, Exclude<keyof Prospecto, "nombre">>;
        Update: Partial<Prospecto>;
        Relationships: [];
      };
      busquedas: {
        Row: Busqueda;
        Insert: Opcional<Busqueda, "id" | "creado" | "deportes" | "encontrados" | "nuevos" | "llamadas" | "resultados">;
        Update: Partial<Busqueda>;
        Relationships: [];
      };
      mensajes: {
        Row: Mensaje;
        Insert: Opcional<Mensaje, "id" | "creado" | "tipo">;
        Update: Partial<Mensaje>;
        Relationships: [
          { foreignKeyName: "mensajes_prospecto_id_fkey"; columns: ["prospecto_id"]; isOneToOne: false; referencedRelation: "prospectos"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: { hoy_ar: { Args: Record<string, never>; Returns: string } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
