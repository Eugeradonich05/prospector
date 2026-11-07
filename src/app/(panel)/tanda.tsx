import { mensajeSeguimiento, textoListaTanda, zonaATexto, type OpcionesZona } from "@/lib/dominio/tandas";
import { guionLlamada } from "@/lib/dominio/lineas";
import { enlaceSeguro } from "@/lib/dominio/datos-complejo";
import { chanceWhatsApp } from "@/lib/dominio/telefono";
import type { Prospecto } from "@/lib/dominio/tipos";
import { AreaTexto, Aviso, Etiqueta, Selector, Tarjeta, TituloSeccion } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { AbrirWhatsApp } from "@/components/abrir-whatsapp";
import { Copiar } from "@/components/copiar";
import { armarTanda, contactadoPorOtroMedio, guardarMensajeInicial, marcarEnviado, nuevaTanda, rehacerMensajes, sacarDeTanda, sinWhatsApp } from "../acciones";

const EXPLICACION =
  "Elige complejos sin contactar (primero los que figuran como celular, después prioridad y reseñas, repartidos entre ciudades) y Claude redacta un mensaje distinto para cada uno, presentándose como Modo Cancha. Tarda uno o dos minutos.";

/** Elegir de dónde sale la tanda: toda la base, una provincia o una ciudad (con cuántos quedan por contactar). */
function SelectorZona({ zonas, id }: { zonas: OpcionesZona; id: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">
      Zona
      <Selector id={id} name="zona" defaultValue="todo" className="sm:max-w-sm">
        <option value="todo">Toda la base</option>
        {zonas.provincias.length ? (
          <optgroup label="Provincia">
            {zonas.provincias.map((z) => (
              <option key={z.provincia} value={zonaATexto({ tipo: "provincia", provincia: z.provincia })}>
                {z.provincia} ({z.cantidad})
              </option>
            ))}
          </optgroup>
        ) : null}
        {zonas.ciudades.length ? (
          <optgroup label="Ciudad">
            {zonas.ciudades.map((z) => (
              <option key={`${z.provincia}|${z.ciudad}`} value={zonaATexto({ tipo: "ciudad", provincia: z.provincia, ciudad: z.ciudad })}>
                {z.ciudad}
                {z.provincia ? `, ${z.provincia}` : ""} ({z.cantidad})
              </option>
            ))}
          </optgroup>
        ) : null}
      </Selector>
    </label>
  );
}

/** Tarjeta con la tanda del día: armarla, cambiarla y mandar cada mensaje. */
export function SeccionTanda({ lista, titulo, zonas }: { lista: Prospecto[]; titulo: string; zonas: OpcionesZona }) {
  const pendientes = lista.filter((p) => p.estado === "en_tanda");
  const enviadosHoy = lista.filter((p) => p.estado !== "en_tanda" && p.estado !== "sin_contactar" && p.estado !== "no_contactar").length;

  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <TituloSeccion titulo={titulo} detalle={lista.length ? `${enviadosHoy} enviados · ${pendientes.length} por enviar` : "Todavía no armaste la tanda de hoy."} />
      {!lista.length ? (
        <Formulario accion={armarTanda}>
          <SelectorZona zonas={zonas} id="zona-armar" />
          <p className="text-sm text-tenue">{EXPLICACION}</p>
          <Enviar className="self-start">Armar tanda de hoy</Enviar>
        </Formulario>
      ) : !pendientes.length ? (
        <>
          <Aviso tono="ok">Tanda de hoy completa. Las respuestas las va contestando el bot.</Aviso>
          <Formulario accion={nuevaTanda}>
            <SelectorZona zonas={zonas} id="zona-otra" />
            <p className="text-sm text-tenue">Si todavía te queda margen en el límite diario, podés sumar otra tanda.</p>
            <Enviar variante="secundario" className="self-start">
              Generar nueva tanda
            </Enviar>
          </Formulario>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Formulario accion={nuevaTanda} className="gap-3">
              <SelectorZona zonas={zonas} id="zona-nueva" />
              <Enviar className="self-start">Generar nueva tanda</Enviar>
            </Formulario>
            <Formulario accion={rehacerMensajes}>
              <Enviar variante="secundario">Rehacer los {pendientes.length} mensajes</Enviar>
            </Formulario>
            <Copiar texto={textoListaTanda(pendientes)} className="py-2">
              Copiar lista
            </Copiar>
          </div>
          <p className="text-sm text-tenue">
            «Generar nueva tanda» devuelve a la lista los {pendientes.length} que no mandaste y elige otros, con mensajes nuevos. «Rehacer» deja los mismos complejos y solo
            vuelve a escribir los mensajes. Los dos pisan lo que hayas editado. Lo que ya mandaste hoy sigue contando para el límite diario. «Copiar lista» copia nombre, teléfono y mensaje de cada uno, por si
            los mandás desde otro celular.
          </p>
          <ul className="flex flex-col gap-4">
            {pendientes.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-linea p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-sm text-tenue">
                      {p.rubro} · {p.ciudad} · {p.resenas ?? 0} reseñas{" "}
                      {enlaceSeguro(p.maps_url) ? (
                        <a href={enlaceSeguro(p.maps_url)!} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                          ver en Maps
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">
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
                <OtrosMedios p={p} abierto={chanceWhatsApp(p.telefono, p.telefono_wa) === "baja"} />
              </li>
            ))}
          </ul>
        </>
      )}
      {lista.length ? <p className="text-xs text-tenue">Si guardás cambios en un mensaje, el botón «Abrir WhatsApp» usa el texto nuevo después de guardar.</p> : null}
    </Tarjeta>
  );
}

/** Para cuando el número no tiene WhatsApp: llamar, buscar su Instagram o copiar el mensaje para otro canal. */
function OtrosMedios({ p, abierto }: { p: Prospecto; abierto: boolean }) {
  const digitos = (p.telefono ?? "").replace(/\D/g, "");
  const tel = digitos ? `tel:${p.telefono!.trim().startsWith("+") ? "+" : ""}${digitos}` : null;
  const busqueda = `https://www.google.com/search?q=${encodeURIComponent(`${p.nombre} ${p.ciudad ?? ""} instagram`)}`;
  const guion = guionLlamada(p.nombre);
  const boton = "inline-flex items-center rounded-md border border-linea px-3 py-1.5 text-sm font-semibold text-tinta hover:bg-hundido";
  return (
    <details open={abierto} className="rounded-md bg-hundido/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold text-tenue">
        Otros medios {abierto ? "· este número parece fijo" : "· si no tiene WhatsApp"}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {tel ? (
            <a href={tel} className={boton}>
              Llamar {p.telefono}
            </a>
          ) : null}
          <a href={busqueda} target="_blank" rel="noopener noreferrer" className={boton}>
            Buscar su Instagram
          </a>
          <Copiar texto={p.mensaje_inicial ?? ""}>Copiar mensaje</Copiar>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tenue">Si llamás</p>
          <p className="text-tinta">{guion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-tenue">Ya lo contacté:</span>
          {(
            [
              ["llamada", "por teléfono"],
              ["instagram", "por Instagram"],
              ["email", "por mail"],
            ] as const
          ).map(([medio, texto]) => (
            <form key={medio} action={contactadoPorOtroMedio}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="medio" value={medio} />
              <button className="font-semibold text-marca hover:underline">{texto}</button>
            </form>
          ))}
        </div>
        <p className="text-xs text-tenue">
          Queda como contactado y sin seguimiento por WhatsApp. Si responde, seguí la charla por ese medio y cambiá el estado en Complejos.
        </p>
      </div>
    </details>
  );
}

/** Único recordatorio para los contactados que no respondieron. */
export function SeccionSeguimientos({ seguimientos, linkPrueba }: { seguimientos: Prospecto[]; linkPrueba: string }) {
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
                <AbrirWhatsApp telefono={p.telefono_wa!} mensaje={mensajeSeguimiento(p.nombre, linkPrueba)} />
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
