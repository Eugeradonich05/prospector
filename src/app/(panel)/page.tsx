import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { hoyAR } from "@/lib/dominio/fechas";
import { opcionesDeZona, seguimientosPendientes } from "@/lib/dominio/tandas";
import { leerTodo } from "@/lib/datos/leer-todo";
import { problemaDeBase } from "@/lib/datos/diagnostico";
import { calcularEmbudo, coberturaPorProvincia, proximosPasos, resumirBase, type FilaMetricas } from "@/lib/dominio/metricas";
import type { Prospecto } from "@/lib/dominio/tipos";
import { Aviso, Encabezado, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { SeccionSeguimientos, SeccionTanda } from "./tanda";
import { PanelCobertura, PanelEmbudo, PanelFoco } from "./paneles";
import { cargarComplejos } from "../acciones";

export const metadata = { title: "Hoy" };
// Armar la tanda redacta hasta TANDA_LIMITE mensajes con Claude.
export const maxDuration = 120;

type ParaSeguimiento = Pick<Prospecto, "id" | "estado" | "contactado_el" | "seguimiento_el" | "ultimo_entrante_el" | "nombre" | "rubro" | "ciudad" | "telefono_wa">;

type FilaBase = FilaMetricas & Pick<Prospecto, "ciudad">;

export default async function Hoy() {
  const problema = await problemaDeBase();
  if (problema) {
    return (
      <>
        <Encabezado titulo="Hoy" detalle="La base todavía no está lista" />
        <Aviso tono="debe">{problema}</Aviso>
      </>
    );
  }
  const hoy = hoyAR();
  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const linkPrueba = env().LINK_PRUEBA_GRATIS;
  const [{ data: tanda }, { data: urgentes }, contactados, filas] = await Promise.all([
    // La tanda de hoy más lo que quedó sin mandar de días anteriores (si no, quedaría trabado en "en_tanda").
    db().from("prospectos").select("*").or(`tanda_fecha.eq.${hoy},estado.eq.en_tanda`).order("prioridad"),
    db().from("prospectos").select("id, nombre, ciudad, motivo_humano, estado").eq("necesita_humano", true).order("ultimo_entrante_el", { ascending: false }),
    // Solo los candidatos a seguimiento (contactados, sin respuesta ni seguimiento), sin el tope de 1000 filas.
    leerTodo<ParaSeguimiento>((desde, hasta) =>
      db()
        .from("prospectos")
        .select("id, estado, contactado_el, seguimiento_el, ultimo_entrante_el, nombre, rubro, ciudad, telefono_wa")
        .eq("estado", "contactado")
        .is("seguimiento_el", null)
        .is("ultimo_entrante_el", null)
        .order("id")
        .range(desde, hasta),
    ),
    // Una sola lectura liviana alcanza para el embudo, la cobertura y el selector de zona.
    leerTodo<FilaBase>((desde, hasta) => db().from("prospectos").select("estado, contactado_el, ultimo_entrante_el, provincia, ciudad, telefono_wa").order("id").range(desde, hasta)),
  ]);

  const lista = (tanda ?? []) as Prospecto[];
  const seguimientoIds = new Set(seguimientosPendientes(contactados, new Date()));
  const seguimientos = contactados.filter((p) => seguimientoIds.has(p.id) && p.telefono_wa);
  const resumen = resumirBase(filas, inicioDia);
  const { total, sinContactar, respuestasHoy } = resumen;
  const zonas = opcionesDeZona(filas.filter((f) => f.estado === "sin_contactar" && f.telefono_wa));
  const limite = env().TANDA_LIMITE;
  const porEnviar = lista.filter((p) => p.estado === "en_tanda").length;
  const enviadosHoy = lista.filter((p) => p.estado !== "en_tanda" && p.estado !== "sin_contactar" && p.estado !== "no_contactar").length;
  const pasos = proximosPasos({
    urgentes: urgentes?.length ?? 0,
    porEnviar,
    seguimientos: seguimientos.length,
    tandaArmada: lista.length > 0,
    cupoRestante: limite - lista.filter((p) => p.tanda_fecha === hoy).length,
    sinContactar,
  });

  if (!total) {
    return (
      <>
        <Encabezado titulo="Hoy" detalle="Prospección de complejos para Modo Cancha" />
        <Vacio titulo="Todavía no hay complejos en la base">
          <div className="flex flex-col gap-3">
            <Formulario accion={cargarComplejos}>
              <p>Hay 455 complejos de fútbol, pádel y deportivos de 21 provincias listos para cargar. Tarda unos segundos.</p>
              <Enviar className="self-start">Cargar los complejos</Enviar>
            </Formulario>
            <p>
              O buscá complejos nuevos de una zona en{" "}
              <Link href="/buscar" className="font-semibold text-marca underline">
                Buscar complejos
              </Link>
              .
            </p>
          </div>
        </Vacio>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Hoy" detalle="Mandá los mensajes espaciados durante el día, en horario comercial." />
      {!env().WHATSAPP_TOKEN ? (
        <Aviso>
          Modo manual: el bot todavía no está conectado. Mandá cada mensaje con «Abrir WhatsApp», tocá «Marcar como enviado» y, cuando te respondan, contestá
          desde el celular y cambiá el estado en Complejos.{" "}
          <Link href="/conectar" className="font-semibold underline">
            Conectar WhatsApp
          </Link>
        </Aviso>
      ) : null}

      <PanelFoco pasos={pasos} enviadosHoy={enviadosHoy} limite={limite} respuestasHoy={respuestasHoy} sinContactar={sinContactar} />

      {resumen.alertaBajas ? (
        <Aviso tono="debe">
          Ojo con el número: {resumen.bajas} de {resumen.contactados} complejos contactados pidieron que no les escriban. Conviene frenar unos días y cambiar el mensaje.
        </Aviso>
      ) : null}

      {urgentes?.length ? (
        <Tarjeta id="te-necesitan" className="flex scroll-mt-4 flex-col gap-3 border-debe/40 p-5">
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

      <SeccionTanda lista={lista} titulo="Tanda de hoy" zonas={zonas} />
      <p className="-mt-2 text-sm text-tenue">
        Los que figuran como celular salen primero. El resto puede ser fijo: si WhatsApp te dice que el número no existe, tocá «No tiene WhatsApp» y entra otro.
        Si alguno quiere probar solo, el link es{" "}
        <a href={linkPrueba} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
          {linkPrueba.replace(/^https?:\/\//, "")}
        </a>
        .
      </p>

      <SeccionSeguimientos seguimientos={seguimientos as Prospecto[]} linkPrueba={linkPrueba} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelEmbudo etapas={calcularEmbudo(filas)} />
        <PanelCobertura provincias={coberturaPorProvincia(filas)} />
      </div>
    </>
  );
}
