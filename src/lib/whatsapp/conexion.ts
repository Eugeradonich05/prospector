/**
 * Conexión del número con coexistencia usando TU propia app de Meta (Embedded Signup).
 * Es lo mismo que hacen los proveedores pagos, sin intermediario.
 *
 * Flujo:
 *  1. En el navegador, FB.login con featureType "whatsapp_business_app_onboarding" abre el asistente de Meta.
 *     Elegís "conectar tu app de WhatsApp Business", escaneás un QR con el celular y confirmás.
 *  2. Meta devuelve un `code` (en la respuesta de FB.login) y, por postMessage, el `waba_id` y a veces el `phone_number_id`.
 *  3. El servidor canjea el code por un token, suscribe tu app a la cuenta (para recibir el webhook)
 *     y busca el phone_number_id si no vino.
 */

export type DatosSignup = { wabaId: string | null; phoneNumberId: string | null; evento: string | null; error: string | null };

/** Lee el mensaje que manda la ventana de Meta. Ignora todo lo que no sea del asistente de WhatsApp. */
export function leerMensajeSignup(origen: string, datos: unknown): DatosSignup | null {
  if (!/^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(origen)) return null;
  let d: unknown = datos;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  const m = d as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; error_message?: string } };
  if (m?.type !== "WA_EMBEDDED_SIGNUP") return null;
  return {
    wabaId: m.data?.waba_id ?? null,
    phoneNumberId: m.data?.phone_number_id ?? null,
    evento: m.event ?? null,
    error: m.event === "CANCEL" || m.event === "ERROR" ? (m.data?.error_message ?? "Se canceló el asistente.") : null,
  };
}

export const EVENTOS_EXITO = ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "FINISH_ONLY_WABA"];
