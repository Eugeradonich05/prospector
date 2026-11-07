import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

/**
 * Las Server Actions son endpoints públicos: el proxy protege las páginas, pero cada acción del panel
 * vuelve a verificar la sesión antes de hacer nada (mandar WhatsApp, gastar Google o Claude, escribir la base).
 */
export async function exigirSesion(): Promise<void> {
  const valor = (await cookies()).get(COOKIE_SESION)?.value;
  if (!sesionValida(valor, env().SESION_SECRETO)) throw new Error("Sesión vencida. Volvé a ingresar.");
}
