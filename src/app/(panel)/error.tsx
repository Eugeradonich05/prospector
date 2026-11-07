"use client";

import { Aviso, Boton, Encabezado } from "@/components/ui";

/** Si una pantalla del panel falla, muestra qué pasó en vez de «This page couldn't load». */
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <Encabezado titulo="Algo falló" />
      <Aviso tono="debe">
        <p>No se pudo cargar esta pantalla. Lo más común: la base de Supabase no está lista (faltan las migraciones) o las claves de Vercel no corresponden a ese proyecto.</p>
        <p className="mt-2">Mirá el detalle en Vercel → Deployments → Logs{error.digest ? ` (código ${error.digest})` : ""}.</p>
      </Aviso>
      <Boton variante="secundario" className="self-start" onClick={reset}>
        Probar de nuevo
      </Boton>
    </>
  );
}
