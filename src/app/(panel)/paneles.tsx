import Link from "next/link";
import type { CoberturaProvincia, EtapaEmbudo, PasoHoy } from "@/lib/dominio/metricas";
import { Tarjeta, TituloSeccion, cx } from "@/components/ui";
import { Barra } from "@/components/visual";

const BORDE: Record<PasoHoy["tono"], string> = { debe: "border-debe", marca: "border-acento", neutro: "border-linea" };

/** Lo primero que se ve: qué hacer ahora y cómo viene el día. */
export function PanelFoco({
  pasos,
  enviadosHoy,
  limite,
  respuestasHoy,
  sinContactar,
}: {
  pasos: PasoHoy[];
  enviadosHoy: number;
  limite: number;
  respuestasHoy: number;
  sinContactar: number;
}) {
  const [principal, ...resto] = pasos;
  return (
    <Tarjeta className="grid gap-5 p-5 md:grid-cols-[1fr_16rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-acento-tinta">Ahora</p>
        {principal ? (
          <Link href={principal.href} className={cx("group border-l-4 pl-4", BORDE[principal.tono])}>
            <span className="font-display block text-2xl font-extrabold group-hover:underline sm:text-3xl">{principal.titulo}</span>
            <span className="text-tenue">{principal.detalle}</span>
          </Link>
        ) : (
          <div className="border-l-4 border-ok pl-4">
            <p className="font-display text-2xl font-extrabold sm:text-3xl">Todo al día por hoy</p>
            <p className="text-tenue">No hay nada pendiente. Podés buscar complejos de otra zona.</p>
          </div>
        )}
        {resto.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {resto.map((p) => (
              <li key={p.href + p.titulo}>
                <Link href={p.href} className="font-semibold text-tenue hover:text-tinta">
                  Después: {p.titulo} →
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <dl className="flex flex-col gap-3 border-linea md:border-l md:pl-5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-sm text-tenue">Enviados hoy</dt>
            <dd className="num font-semibold">
              {enviadosHoy} / {limite}
            </dd>
          </div>
          <Barra valor={(enviadosHoy / limite) * 100} etiqueta="Mensajes enviados hoy sobre el límite diario" tono="acento" className="mt-1.5" />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-sm text-tenue">Respuestas hoy</dt>
          <dd className="num font-semibold">{respuestasHoy}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-sm text-tenue">Por contactar</dt>
          <dd className="num font-semibold">{sinContactar}</dd>
        </div>
      </dl>
    </Tarjeta>
  );
}

/** De cada etapa a la siguiente: dónde se caen los complejos. */
export function PanelEmbudo({ etapas }: { etapas: EtapaEmbudo[] }) {
  const hayDatos = etapas[0]!.cantidad > 0;
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <TituloSeccion titulo="Embudo" detalle="De todos los que contactaste, hasta dónde llegó cada uno." />
      {hayDatos ? (
        <ol className="flex flex-col gap-3">
          {etapas.map((e) => (
            <li key={e.etiqueta}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{e.etiqueta}</span>
                <span>
                  <span className="num font-semibold">{e.cantidad}</span>
                  {e.conversion !== null ? <span className="text-tenue"> · {e.conversion}% de la etapa anterior</span> : null}
                </span>
              </div>
              <Barra valor={e.ancho} etiqueta={`${e.etiqueta}: ${e.cantidad}`} className="mt-1" />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-tenue">Cuando mandes los primeros mensajes, acá vas a ver cuántos responden y cuántos se interesan.</p>
      )}
    </Tarjeta>
  );
}

/** Cuánto se barrió de cada provincia. Cada fila lleva a sus complejos. */
export function PanelCobertura({ provincias }: { provincias: CoberturaProvincia[] }) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <TituloSeccion titulo="Cobertura por provincia" detalle="Dónde queda más por contactar." />
      <ul className="flex flex-col gap-3">
        {provincias.map((p) => (
          <li key={p.provincia}>
            <Link href={`/complejos?provincia=${encodeURIComponent(p.provincia)}`} className="group block">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold group-hover:underline">{p.provincia}</span>
                <span className="text-tenue">
                  <span className="num font-semibold text-tinta">{p.sinContactar}</span> por contactar · {p.contactados} de {p.total} contactados
                </span>
              </div>
              <Barra valor={p.porcentaje} etiqueta={`${p.provincia}: ${p.porcentaje}% contactado`} className="mt-1" />
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
