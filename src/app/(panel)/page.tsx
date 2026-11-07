import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { hoyAR } from "@/lib/dominio/fechas";
import { opcionesDeZona, seguimientosPendientes } from "@/lib/dominio/tandas";
import { leerTodo } from "@/lib/datos/leer-todo";
import type { EstadoProspecto, Prospecto } from "@/lib/dominio/tipos";
import { Aviso, Encabezado, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { SeccionSeguimientos, SeccionTanda } from "./tanda";
import { cargarComplejos } from "../acciones";

export const metadata = { title: "Hoy" };
// Armar la tanda redacta hasta TANDA_LIMITE mensajes con Claude.
export const maxDuration = 120;

type ParaSeguimiento = Pick<Prospecto, "id" | "estado" | "contactado_el" | "seguimiento_el" | "ultimo_entrante_el" | "nombre" | "rubro" | "ciudad" | "telefono_wa">;

const RESPONDIERON: EstadoProspecto[] = ["respondio", "interesado", "demo", "cliente"];
const INTERESADOS: EstadoProspecto[] = ["interesado", "demo", "cliente"];

/** Cuenta filas con un filtro, sin traerlas (no depende del tope de 1000 filas de Supabase). */
async function contar(filtrar: (q: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<number> {
  const { count } = await filtrar(base());
  return count ?? 0;
}
const base = () => db().from("prospectos").select("id", { count: "exact", head: true });

export default async function Hoy() {
  const hoy = hoyAR();
  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const linkPrueba = env().LINK_PRUEBA_GRATIS;
  const [{ data: tanda }, { data: urgentes }, contactados, total, sinContactar, totalContactados, respondieron, interesados, respuestasHoy, lugares] =
    await Promise.all([
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
      contar((q) => q),
      contar((q) => q.eq("estado", "sin_contactar").not("telefono_wa", "is", null)),
      contar((q) => q.not("contactado_el", "is", null)),
      contar((q) => q.or(`ultimo_entrante_el.not.is.null,estado.in.(${RESPONDIERON.join(",")})`)),
      contar((q) => q.in("estado", INTERESADOS)),
      contar((q) => q.gte("ultimo_entrante_el", inicioDia)),
      // Para el selector de zona: dónde quedan complejos sin contactar con WhatsApp.
      leerTodo<{ provincia: string | null; ciudad: string | null }>((desde, hasta) =>
        db().from("prospectos").select("provincia, ciudad").eq("estado", "sin_contactar").not("telefono_wa", "is", null).order("id").range(desde, hasta),
      ),
    ]);

  const lista = (tanda ?? []) as Prospecto[];
  const seguimientoIds = new Set(seguimientosPendientes(contactados, new Date()));
  const seguimientos = contactados.filter((p) => seguimientoIds.has(p.id) && p.telefono_wa);

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
      <Encabezado titulo="Hoy" detalle={`Límite diario: ${env().TANDA_LIMITE} primeros contactos. Mandalos espaciados durante el día.`} />
      {!env().WHATSAPP_TOKEN ? (
        <Aviso>
          Modo manual: el bot todavía no está conectado. Mandá cada mensaje con «Abrir WhatsApp», tocá «Marcar como enviado» y, cuando te respondan, contestá
          desde el celular y cambiá el estado en Complejos.{" "}
          <Link href="/conectar" className="font-semibold underline">
            Conectar WhatsApp
          </Link>
        </Aviso>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Sin contactar", sinContactar],
            ["Contactados", totalContactados],
            ["Respondieron", respondieron],
            ["Interesados", interesados],
            ["Respuestas hoy", respuestasHoy],
          ] as const
        ).map(([t, v]) => (
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

      <SeccionTanda lista={lista} titulo="Tanda de hoy" zonas={opcionesDeZona(lugares)} />
      <p className="-mt-2 text-sm text-tenue">
        Los que figuran como celular salen primero. El resto puede ser fijo: si WhatsApp te dice que el número no existe, tocá «No tiene WhatsApp» y entra otro.
        Si alguno quiere probar solo, el link es{" "}
        <a href={linkPrueba} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
          {linkPrueba.replace(/^https?:\/\//, "")}
        </a>
        .
      </p>

      <SeccionSeguimientos seguimientos={seguimientos as Prospecto[]} linkPrueba={linkPrueba} />
    </>
  );
}
