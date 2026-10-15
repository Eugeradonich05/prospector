import { env } from "@/lib/env";
import { Aviso, Encabezado, Etiqueta, Tarjeta, TituloSeccion } from "@/components/ui";
import { Conector } from "./conector";

export const metadata = { title: "Conectar WhatsApp" };

export default function Conectar() {
  const e = env();
  const conectado = Boolean(e.WHATSAPP_TOKEN && (e.WHATSAPP_PHONE_NUMBER_ID || e.WHATSAPP_API_URL));
  const faltan = [!e.META_APP_ID && "META_APP_ID", !e.META_CONFIG_ID && "META_CONFIG_ID", !e.WHATSAPP_APP_SECRET && "WHATSAPP_APP_SECRET"].filter(Boolean);

  return (
    <>
      <Encabezado
        titulo="Conectar WhatsApp"
        detalle="Conectá tu número de WhatsApp Business a la API sin sacarlo del celular (coexistencia), con tu propia app de Meta y sin pagar un proveedor."
      />
      <Tarjeta className="flex flex-col gap-4 p-5">
        <TituloSeccion titulo="Estado" accion={conectado ? <Etiqueta tono="ok">Conectado</Etiqueta> : <Etiqueta tono="aviso">Sin conectar</Etiqueta>} />
        {faltan.length ? (
          <Aviso>
            Para usar el asistente faltan estas variables: <strong>{faltan.join(", ")}</strong>. Los pasos para obtenerlas están en el README («Opción A (gratis): con tu propia app de Meta»).
          </Aviso>
        ) : (
          <Conector appId={e.META_APP_ID!} configId={e.META_CONFIG_ID!} version={e.WHATSAPP_GRAPH_VERSION} />
        )}
      </Tarjeta>
      <Tarjeta className="flex flex-col gap-2 p-5 text-sm">
        <TituloSeccion titulo="Qué va a pasar" />
        <ol className="list-decimal space-y-1 pl-5">
          <li>Se abre una ventana de Meta. Elegí tu portfolio de negocio y la opción de conectar tu app de WhatsApp Business existente.</li>
          <li>Ingresá tu número. WhatsApp Business te muestra un aviso en el celular: aceptalo y escaneá el QR.</li>
          <li>Elegí si compartir el historial de chats (no hace falta para el bot).</li>
          <li>Volvés acá con el token y el ID del número para pegar en las variables de entorno.</li>
        </ol>
        <p className="text-tenue">Necesitás WhatsApp Business actualizado en el celular. Usá el celular al menos cada dos semanas: si el teléfono queda inactivo mucho tiempo, Meta corta la conexión.</p>
      </Tarjeta>
    </>
  );
}
