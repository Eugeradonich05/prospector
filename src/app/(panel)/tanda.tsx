import { mensajeSeguimiento } from "@/lib/dominio/tandas";
import { LINEAS, lineaDeRubro } from "@/lib/dominio/lineas";
import { chanceWhatsApp } from "@/lib/dominio/telefono";
import type { Prospecto } from "@/lib/dominio/tipos";
import { AreaTexto, Aviso, Etiqueta, Tarjeta, TituloSeccion } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { AbrirWhatsApp } from "@/components/abrir-whatsapp";
import { armarTanda, guardarMensajeInicial, marcarEnviado, nuevaTanda, rehacerMensajes, sacarDeTanda, sinWhatsApp } from "../acciones";

/** Las dos tandas del panel: la de Cauce (Hoy) y la de Modo Cancha (su pestaña). */
export type Grupo = "cauce" | "canchas";

export function grupoDe(rubro: string | null | undefined): Grupo {
  return lineaDeRubro(rubro) === "canchas" ? "canchas" : "cauce";
}

const TEXTOS: Record<Grupo, { armar: string; explicacion: string }> = {
  cauce: {
    armar: "Armar tanda de hoy",
    explicacion:
      "Elige los mejores prospectos sin contactar (primero prioridad A, repartidos entre ciudades y entre rubros) y Claude redacta un mensaje distinto para cada uno, según lo que le sirve a ese rubro. Tarda uno o dos minutos.",
  },
  canchas: {
    armar: "Armar tanda de Modo Cancha",
    explicacion:
      "Elige complejos de canchas sin contactar (primero los que figuran como celular y los de más reseñas, repartidos entre ciudades) y Claude redacta un mensaje distinto para cada uno, presentándose como Modo Cancha. Tarda uno o dos minutos.",
  },
};

/** Tarjeta con la tanda del día de un grupo: armarla, cambiarla y mandar cada mensaje. */
export function SeccionTanda({ grupo, lista, titulo }: { grupo: Grupo; lista: Prospecto[]; titulo: string }) {
  const pendientes = lista.filter((p) => p.estado === "en_tanda");
  const enviadosHoy = lista.filter((p) => p.estado !== "en_tanda" && p.estado !== "sin_contactar" && p.estado !== "no_contactar").length;
  const campoGrupo = <input type="hidden" name="grupo" value={grupo} />;

  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <TituloSeccion titulo={titulo} detalle={lista.length ? `${enviadosHoy} enviados · ${pendientes.length} por enviar` : "Todavía no armaste la tanda de hoy."} />
      {!lista.length ? (
        <Formulario accion={armarTanda}>
          {campoGrupo}
          <p className="text-sm text-tenue">{TEXTOS[grupo].explicacion}</p>
          <Enviar className="self-start">{TEXTOS[grupo].armar}</Enviar>
        </Formulario>
      ) : !pendientes.length ? (
        <>
          <Aviso tono="ok">Tanda de hoy completa. Las respuestas las va contestando el bot.</Aviso>
          <Formulario accion={nuevaTanda}>
            {campoGrupo}
            <p className="text-sm text-tenue">Si todavía te queda margen en el límite diario, podés sumar otra tanda.</p>
            <Enviar variante="secundario" className="self-start">
              Generar nueva tanda
            </Enviar>
          </Formulario>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <Formulario accion={nuevaTanda}>
              {campoGrupo}
              <Enviar>Generar nueva tanda</Enviar>
            </Formulario>
            <Formulario accion={rehacerMensajes}>
              {campoGrupo}
              <Enviar variante="secundario">Rehacer los {pendientes.length} mensajes</Enviar>
            </Formulario>
          </div>
          <p className="text-sm text-tenue">
            «Generar nueva tanda» devuelve a la lista los {pendientes.length} que no mandaste y elige otros, con mensajes nuevos. «Rehacer» deja los mismos negocios y solo
            vuelve a escribir los mensajes. Los dos pisan lo que hayas editado. Lo que ya mandaste hoy sigue contando para el límite diario.
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
                    <Etiqueta tono="neutro">{LINEAS[lineaDeRubro(p.rubro)].etiqueta}</Etiqueta>
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
      {lista.length ? <p className="text-xs text-tenue">Si guardás cambios en un mensaje, el botón «Abrir WhatsApp» usa el texto nuevo después de guardar.</p> : null}
    </Tarjeta>
  );
}

/** Único recordatorio para los contactados que no respondieron. */
export function SeccionSeguimientos({ seguimientos }: { seguimientos: Prospecto[] }) {
  return (
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
  );
}
