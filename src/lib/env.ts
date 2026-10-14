import "server-only";
import { z } from "zod";

const esquema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(20),

  // Acceso al panel (sos el único usuario)
  ADMIN_CLAVE: z.string().min(10, "ADMIN_CLAVE debe tener al menos 10 caracteres"),
  SESION_SECRETO: z.string().min(32),

  // Claude
  ANTHROPIC_API_KEY: z.string().min(20),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),

  // WhatsApp
  WHATSAPP_VERIFY_TOKEN: z.string().min(8), // lo inventás vos y lo pegás en Meta al configurar el webhook
  WHATSAPP_APP_SECRET: z.string().optional(), // App Secret de Meta: valida que el webhook venga de Meta
  WHATSAPP_TOKEN: z.string().min(10),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default("v23.0"),
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_AUTH_HEADER: z.string().default("Authorization"),

  // Cómo se comporta el bot
  TANDA_LIMITE: z.coerce.number().int().min(1).max(40).default(15),
  TANDA_MAX_POR_CIUDAD: z.coerce.number().int().min(1).max(40).default(6),
  BOT_MAX_RESPUESTAS: z.coerce.number().int().min(1).max(30).default(10),
  LINK_PRUEBA: z.string().url().optional(), // link de registro de Cuotas al día, cuando esté publicado

  // Aviso por email cuando una conversación necesita que intervengas (opcional, con Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_AVISOS: z.string().email().optional(),
  EMAIL_REMITENTE: z.string().optional(),
});

export type Env = z.infer<typeof esquema>;
let cache: Env | null = null;

export function env(): Env {
  if (cache) return cache;
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    throw new Error(`Configuración incompleta. Revisá: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  if (!r.data.WHATSAPP_API_URL && !r.data.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("Configuración incompleta. Falta WHATSAPP_PHONE_NUMBER_ID (o WHATSAPP_API_URL si usás un proveedor).");
  }
  cache = r.data;
  return cache;
}
