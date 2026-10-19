import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { ETIQUETA_ESTADO, type Mensaje, type Prospecto } from "@/lib/dominio/tipos";
import { AreaTexto, Aviso, Boton, Campo, Encabezado, Etiqueta, Selector, Tarjeta, TituloSeccion, cx } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { responderManual, actualizarProspecto, devolverAlBot } from "../../../acciones";

export const metadata = { title: "Conversación" };

const QUIEN = { entrante: "Negocio", bot: "Bot", humano: "Vos" } as const;

export default async function Conversacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: pd }, { data: md }] = await Promise.all([
    db().from("prospectos").select("*").eq("id", id).maybeSingle(),
    db().from("mensajes").select("*").eq("prospecto_id", id).order("creado"),
  ]);
  if (!pd) notFound();
  const p = pd as Prospecto;
  const mensajes = (md ?? []) as Mensaje[];
  const botConectado = Boolean(env().WHATSAPP_TOKEN);
  const pausado = !p.bot_activo || (p.humano_hasta !== null && new Date(p.humano_hasta) > new Date());
  const ultimoEntrante = p.ultimo_entrante_el ? new Date(p.ultimo_entrante_el).getTime() : 0;
  const ventanaAbierta = Date.now() - ultimoEntrante < 24 * 3_600_000;
  const hora = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <>
      <Encabezado
        titulo={p.nombre}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/conversaciones" className="hover:underline">
              ← Conversaciones
            </Link>
            <span>
              {p.rubro} · {p.ciudad}
            </span>
            <Etiqueta tono="marca">{ETIQUETA_ESTADO[p.estado]}</Etiqueta>
            {!botConectado ? <Etiqueta>Modo manual</Etiqueta> : pausado ? <Etiqueta>Bot en pausa</Etiqueta> : <Etiqueta tono="ok">Bot respondiendo</Etiqueta>}
          </span>
        }
      />

      {p.necesita_humano ? <Aviso tono="debe">Te necesita: {p.motivo_humano}</Aviso> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="flex min-w-0 flex-col gap-4 p-5 lg:col-span-2">
          <TituloSeccion titulo="Conversación" />
          <ol className="flex flex-col gap-3">
            {mensajes.map((m) => (
              <li key={m.id} className={cx("flex flex-col gap-1", m.direccion === "entrante" ? "items-start" : "items-end")}>
                <span className="text-xs text-tenue">
                  {QUIEN[m.direccion]} · {hora(m.creado)}
                </span>
                <p
                  className={cx(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.direccion === "entrante" ? "bg-hundido" : m.direccion === "bot" ? "bg-marca-suave" : "bg-aviso-suave",
                  )}
                >
                  {m.texto ?? `[${m.tipo}]`}
                </p>
              </li>
            ))}
          </ol>
          {!botConectado ? (
            <Aviso>
              Modo manual: respondé desde tu celular. Después anotá acá al costado el estado (Respondió, Interesado, Demo…) y en Notas lo
              que te contó: cuántos alumnos tiene, cómo cobra hoy y cuándo volver a hablar.
            </Aviso>
          ) : ventanaAbierta ? (
            <Formulario accion={responderManual} limpiarAlGuardar>
              <input type="hidden" name="id" value={p.id} />
              <Campo etiqueta="Responder como Cauce" htmlFor="texto" ayuda="Al enviar, el bot queda en pausa 12 horas en esta conversación. También podés responder desde tu celular.">
                <AreaTexto id="texto" name="texto" className="min-h-20" />
              </Campo>
              <Enviar className="self-start">Enviar</Enviar>
            </Formulario>
          ) : (
            <Aviso>Pasaron más de 24 horas desde su último mensaje: WhatsApp solo permite responder desde tu app del celular.</Aviso>
          )}
        </Tarjeta>

        <div className="flex flex-col gap-6">
          <Tarjeta className="flex flex-col gap-3 p-5">
            <TituloSeccion titulo="Lo que sabemos" />
            {Object.keys(p.datos ?? {}).length ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {Object.entries(p.datos).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-tenue">{k.replace(/_/g, " ")}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-tenue">Todavía nada.</p>
            )}
            <p className="text-sm text-tenue">
              {p.telefono} {p.maps_url ? <a className="text-marca underline" href={p.maps_url} target="_blank" rel="noopener noreferrer">Maps</a> : null}
            </p>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3 p-5">
            <TituloSeccion titulo="Control" />
            <Formulario accion={actualizarProspecto}>
              <input type="hidden" name="id" value={p.id} />
              <Campo etiqueta="Estado" htmlFor="estado">
                <Selector id="estado" name="estado" defaultValue={p.estado}>
                  {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="bot_activo" defaultChecked={p.bot_activo} className="size-4 accent-[var(--marca)]" />
                El bot puede responder
              </label>
              {p.necesita_humano ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="resuelto" className="size-4 accent-[var(--marca)]" />
                  Ya lo resolví
                </label>
              ) : null}
              <Campo etiqueta="Notas" htmlFor="notas">
                <AreaTexto id="notas" name="notas" defaultValue={p.notas ?? ""} className="min-h-16" />
              </Campo>
              <Enviar className="self-start">Guardar</Enviar>
            </Formulario>
            {pausado || p.necesita_humano ? (
              <form action={devolverAlBot}>
                <input type="hidden" name="id" value={p.id} />
                <Boton variante="secundario" type="submit">
                  Devolverle la conversación al bot
                </Boton>
              </form>
            ) : null}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
