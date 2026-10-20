import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { hoyAR } from "@/lib/dominio/fechas";
import { mensajeSeguimiento, seguimientosPendientes } from "@/lib/dominio/tandas";
import { LINEAS, lineaDeRubro } from "@/lib/dominio/lineas";
import type { Prospecto } from "@/lib/dominio/tipos";
import { AreaTexto, Aviso, Encabezado, Etiqueta, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { AbrirWhatsApp } from "@/components/abrir-whatsapp";
import { armarTanda, guardarMensajeInicial, marcarEnviado, nuevaTanda, rehacerMensajes, sacarDeTanda, sinWhatsApp } from "../acciones";
import { chanceWhatsApp } from "@/lib/dominio/telefono";

export const metadata = { title: "Hoy" };

export default async function Hoy() {
  const hoy = hoyAR();
  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const [{ data: tanda }, { data: urgentes }, { data: contactados }, { data: todos }] = await Promise.all([
    // La tanda de hoy más lo que quedó sin mandar de días anteriores (si no, quedaría trabado en "en_tanda").
    db().from("prospectos").select("*").or(`tanda_fecha.eq.${hoy},estado.eq.en_tanda`).order("prioridad"),
    db().from("prospectos").select("id, nombre, ciudad, motivo_humano, estado").eq("necesita_humano", true).order("ultimo_entrante_el", { ascending: false }),
    db().from("prospectos").select("id, estado, contactado_el, seguimiento_el, ultimo_entrante_el, nombre, rubro, ciudad, telefono_wa").eq("estado", "contactado"),
    db().from("prospectos").select("estado, contactado_el, ultimo_entrante_el"),
  ]);

  const lista = (tanda ?? []) as Prospecto[];
  const pendientes = lista.filter((p) => p.estado === "en_tanda");
  const enviadosHoy = lista.filter((p) => p.estado !== "en_tanda" && p.estado !== "sin_contactar" && p.estado !== "no_contactar").length;
  const seguimientoIds = new Set(seguimientosPendientes((contactados ?? []) as Prospecto[], new Date()));
  const seguimientos = ((contactados ?? []) as Prospecto[]).filter((p) => seguimientoIds.has(p.id) && p.telefono_wa);

  const t = (todos ?? []) as Pick<Prospecto, "estado" | "contactado_el" | "ultimo_entrante_el">[];
  const totalContactados = t.filter((p) => p.contactado_el).length;
  // Sin bot conectado, las respuestas se anotan a mano cambiando el estado.
  const respondieron = t.filter((p) => p.ultimo_entrante_el || ["respondio", "interesado", "demo", "cliente"].includes(p.estado)).length;
  const interesados = t.filter((p) => ["interesado", "demo", "cliente"].includes(p.estado)).length;
  const respuestasHoy = t.filter((p) => p.ultimo_entrante_el && p.ultimo_entrante_el >= inicioDia).length;

  return (
    <>
      <Encabezado titulo="Hoy" detalle={`Límite diario: ${env().TANDA_LIMITE} primeros contactos. Mandalos espaciados durante el día.`} />
      {!env().WHATSAPP_TOKEN ? (
        <Aviso>
          Modo manual: el bot todavía no está conectado. Mandá cada mensaje con «Abrir WhatsApp», tocá «Marcar como enviado» y, cuando
          te respondan, contestá desde el celular y cambiá el estado en Prospectos.{" "}
          <Link href="/conectar" className="font-semibold underline">Conectar WhatsApp</Link>
        </Aviso>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Contactados", totalContactados],
          ["Respondieron", respondieron],
          ["Interesados", interesados],
          ["Respuestas hoy", respuestasHoy],
        ].map(([t, v]) => (
          <Tarjeta key={t} className="p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-tenue">{t}</dt>
            <dd className="num text-2xl font-semibold">{v}</dd>
          </Tarjeta>
        ))}
      </dl>

      {urgentes?.length ? (
        <Tarjeta className="flex flex-col gap-3 border-debe/40 p-5">
          <TituloSeccion titulo={`Te necesitan (${urgentes.length})`} detalle="El bot dejó estas conversaciones para vos." />
          <ul className="flex flex-col divide-y divide-linea">
            {urgentes.map((u) => (
              <li key={u.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/conversaciones/${u.id}`} className="font-semibold hover:underline">
                    {u.nombre as string}
                  </Link>
                  <span className="text-sm text-tenue"> · {u.ciudad as string}</span>
                  <p className="text-sm text-debe">{u.motivo_humano as string}</p>
                </div>
                <Link href={`/conversaciones/${u.id}`} className="text-sm font-semibold text-marca">
                  Responder →
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      <Tarjeta className="flex flex-col gap-4 p-5">
        <TituloSeccion
          titulo="Tanda de hoy"
          detalle={lista.length ? `${enviadosHoy} enviados · ${pendientes.length} por enviar` : "Todavía no armaste la tanda de hoy."}
        />
        {!lista.length ? (
          <Formulario accion={armarTanda}>
            <p className="text-sm text-tenue">
              Elige los mejores prospectos sin contactar (primero prioridad A, repartidos entre ciudades y entre rubros) y Claude redacta un mensaje distinto para cada uno, según lo que le sirve a ese rubro. Tarda uno o dos minutos.
            </p>
            <Enviar className="self-start">Armar tanda de hoy</Enviar>
          </Formulario>
        ) : !pendientes.length ? (
          <>
            <Aviso tono="ok">Tanda de hoy completa. Las respuestas las va contestando el bot.</Aviso>
            <Formulario accion={nuevaTanda}>
              <p className="text-sm text-tenue">Si todavía te queda margen en el límite diario, podés sumar otra tanda.</p>
              <Enviar variante="secundario" className="self-start">Generar nueva tanda</Enviar>
            </Formulario>
          </>
        ) : (
          <>
          <div className="flex flex-wrap items-start gap-3">
            <Formulario accion={nuevaTanda}>
              <Enviar>Generar nueva tanda</Enviar>
            </Formulario>
            <Formulario accion={rehacerMensajes}>
              <Enviar variante="secundario">Rehacer los {pendientes.length} mensajes</Enviar>
            </Formulario>
          </div>
          <p className="text-sm text-tenue">
            «Generar nueva tanda» devuelve a la lista los {pendientes.length} que no mandaste y elige otros, con mensajes nuevos. «Rehacer» deja los mismos negocios y
            solo vuelve a escribir los mensajes. Los dos pisan lo que hayas editado. Lo que ya mandaste hoy sigue contando para el límite diario.
          </p>
          <ul className="flex flex-col gap-4">
            {pendientes.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-linea p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-sm text-tenue">
                      {p.rubro} · {p.ciudad} · {p.resenas ?? 0} reseñas{" "}
                      {p.maps_url ? (
                        <a href={p.maps_url} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                          ver en Maps
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
                    <Etiqueta tono="neutro">{LINEAS[lineaDeRubro(p.rubro) ?? "a_medida"].etiqueta}</Etiqueta>
                    {chanceWhatsApp(p.telefono, p.telefono_wa) === "alta" ? (
                      <Etiqueta tono="marca">Celular</Etiqueta>
                    ) : (
                      <Etiqueta tono="neutro">WhatsApp sin confirmar</Etiqueta>
                    )}
                    <Etiqueta tono={p.prioridad === "A" ? "marca" : "neutro"}>Prioridad {p.prioridad}</Etiqueta>
                  </span>
                </div>
                <Formulario accion={guardarMensajeInicial}>
                  <input type="hidden" name="id" value={p.id} />
                  <label htmlFor={`m-${p.id}`} className="sr-only">
                    Mensaje para {p.nombre}
                  </label>
                  <AreaTexto id={`m-${p.id}`} name="mensaje" defaultValue={p.mensaje_inicial ?? ""} className="min-h-28" />
                  <div className="flex flex-wrap items-center gap-2">
                    <AbrirWhatsApp telefono={p.telefono_wa!} mensaje={p.mensaje_inicial ?? ""} />
                    <Enviar variante="secundario">Guardar cambios</Enviar>
                  </div>
                </Formulario>
                <div className="flex flex-wrap gap-3 text-sm">
                  <form action={marcarEnviado}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="font-semibold text-tenue hover:text-tinta" title="Usalo si el envío no se detectó solo">
                      Marcar como enviado
                    </button>
                  </form>
                  <form action={sacarDeTanda}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="font-semibold text-tenue hover:text-tinta">Dejar para otro día</button>
                  </form>
                  <form action={sacarDeTanda}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="no_contactar" value="1" />
                    <button className="font-semibold text-debe">No contactar</button>
                  </form>
                  <Formulario accion={sinWhatsApp} className="gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="font-semibold text-tenue hover:text-tinta" title="Si WhatsApp te dice que el número no está en WhatsApp: lo saca y suma otro en su lugar">
                      No tiene WhatsApp
                    </button>
                  </Formulario>
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
        {lista.length ? (
          <p className="text-xs text-tenue">
            Si guardás cambios en un mensaje, el botón «Abrir WhatsApp» usa el texto nuevo después de guardar.
          </p>
        ) : null}
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-3 p-5">
        <TituloSeccion titulo="Seguimientos" detalle="Contactados hace 3 días o más que no respondieron. Se manda uno solo." />
        {!seguimientos.length ? (
          <p className="text-sm text-tenue">Nadie para seguir hoy.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-linea">
            {seguimientos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold">{p.nombre}</span> <span className="text-sm text-tenue">· {p.ciudad}</span>
                </span>
                <span className="flex items-center gap-3">
                  <AbrirWhatsApp telefono={p.telefono_wa!} mensaje={mensajeSeguimiento(p.nombre, p.rubro)} />
                  <form action={marcarEnviado}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="tipo" value="seguimiento" />
                    <button className="text-sm font-semibold text-tenue hover:text-tinta">Marcar enviado</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {!t.length ? (
        <Vacio titulo="La base está vacía">
          Cargá los prospectos con <code>supabase/seed.sql</code> (ver README).
        </Vacio>
      ) : null}
    </>
  );
}
