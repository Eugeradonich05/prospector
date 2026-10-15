"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Boton, Aviso } from "@/components/ui";
import { leerMensajeSignup, EVENTOS_EXITO } from "@/lib/whatsapp/conexion";
import { completarConexion, type ResultadoConexion } from "./acciones";

declare global {
  interface Window {
    FB?: {
      init(o: Record<string, unknown>): void;
      login(cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>): void;
    };
    fbAsyncInit?: () => void;
  }
}

export function Conector({ appId, configId, version }: { appId: string; configId: string; version: string }) {
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"inicio" | "asistente" | "conectando" | "fin">("inicio");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoConexion, { ok: true }> | null>(null);
  const sesion = useRef<{ wabaId: string | null; phoneNumberId: string | null; code: string | null }>({ wabaId: null, phoneNumberId: null, code: null });

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      setListo(true);
    };
    if (window.FB) window.fbAsyncInit();

    const escuchar = (ev: MessageEvent) => {
      const d = leerMensajeSignup(ev.origin, ev.data);
      if (!d) return;
      if (d.error) {
        setError(d.error);
        setEstado("inicio");
        return;
      }
      if (d.evento && EVENTOS_EXITO.includes(d.evento)) {
        sesion.current.wabaId = d.wabaId ?? sesion.current.wabaId;
        sesion.current.phoneNumberId = d.phoneNumberId ?? sesion.current.phoneNumberId;
        void intentarCompletar();
      }
    };
    window.addEventListener("message", escuchar);
    return () => window.removeEventListener("message", escuchar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, version]);

  // El code (de FB.login) y el waba_id (del postMessage) llegan por caminos distintos: se completa cuando están los dos.
  async function intentarCompletar() {
    const { code, wabaId, phoneNumberId } = sesion.current;
    if (!code || !wabaId) return;
    sesion.current.code = null; // el code es de un solo uso
    setEstado("conectando");
    const r = await completarConexion({ code, wabaId, phoneNumberId });
    if (r.ok) {
      setResultado(r);
      setEstado("fin");
    } else {
      setError(r.error);
      setEstado("inicio");
    }
  }

  function iniciar() {
    setError(null);
    setEstado("asistente");
    window.FB?.login(
      (r) => {
        if (!r.authResponse?.code) {
          setEstado("inicio");
          setError("No se completó el asistente de Meta.");
          return;
        }
        sesion.current.code = r.authResponse.code;
        void intentarCompletar();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Script src="https://connect.facebook.net/es_LA/sdk.js" strategy="afterInteractive" crossOrigin="anonymous" />
      {error ? <Aviso tono="debe">{error}</Aviso> : null}

      {estado !== "fin" ? (
        <Boton onClick={iniciar} disabled={!listo || estado !== "inicio"} className="self-start">
          {estado === "asistente" ? "Seguí los pasos en la ventana de Meta…" : estado === "conectando" ? "Conectando…" : "Conectar mi WhatsApp Business"}
        </Boton>
      ) : null}

      {resultado ? (
        <div className="flex flex-col gap-3">
          <Aviso tono="ok">
            Listo: {resultado.numero ?? "tu número"} quedó conectado a la API sin dejar de funcionar en tu celular.
          </Aviso>
          <p className="text-sm">Copiá estos valores a las variables de entorno (Vercel → Settings → Environment Variables) y volvé a publicar:</p>
          <pre className="overflow-x-auto rounded-md bg-hundido p-3 font-mono text-xs">
            {`WHATSAPP_PHONE_NUMBER_ID=${resultado.phoneNumberId}\nWHATSAPP_TOKEN=${resultado.token}`}
          </pre>
          <p className="text-xs text-tenue">
            Este token no se guarda en ningún lado: si cerrás la página sin copiarlo, repetí la conexión. Cuenta de WhatsApp (WABA): {resultado.wabaId}.
          </p>
          <p className="text-xs text-tenue">
            Recomendado: este token puede vencer. Para uno que no vence, en Meta Business → Configuración → Usuarios del sistema, creá un usuario admin,
            asignale la app y la cuenta de WhatsApp, y generá un token con los permisos whatsapp_business_messaging y whatsapp_business_management, caducidad «Nunca».
          </p>
        </div>
      ) : null}
    </div>
  );
}
