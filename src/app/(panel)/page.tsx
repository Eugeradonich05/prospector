import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { hoyAR } from "@/lib/dominio/fechas";
import { seguimientosPendientes } from "@/lib/dominio/tandas";
import type { Prospecto } from "@/lib/dominio/tipos";
import { Aviso, Encabezado, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { SeccionSeguimientos, SeccionTanda, grupoDe } from "./tanda";

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

  // Hoy muestra la tanda de Cauce; la de Modo Cancha tiene su pestaña.
  const lista = ((tanda ?? []) as Prospecto[]).filter((p) => grupoDe(p.rubro) === "cauce");
  const seguimientoIds = new Set(seguimientosPendientes((contactados ?? []) as Prospecto[], new Date()));
  const seguimientos = ((contactados ?? []) as Prospecto[]).filter((p) => seguimientoIds.has(p.id) && p.telefono_wa && grupoDe(p.rubro) === "cauce");

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

      <SeccionTanda grupo="cauce" lista={lista} titulo="Tanda de hoy" />
      <p className="-mt-2 text-sm text-tenue">
        Los complejos de canchas van aparte, en{" "}
        <Link href="/modo-cancha" className="font-semibold text-marca underline">
          Modo Cancha
        </Link>
        .
      </p>

      <SeccionSeguimientos seguimientos={seguimientos} />

      {!t.length ? (
        <Vacio titulo="La base está vacía">
          Cargá los prospectos con <code>supabase/seed.sql</code> (ver README).
        </Vacio>
      ) : null}
    </>
  );
}
