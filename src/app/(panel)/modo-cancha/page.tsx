import Link from "next/link";
import { db } from "@/lib/datos/supabase";
import { env } from "@/lib/env";
import { hoyAR } from "@/lib/dominio/fechas";
import { seguimientosPendientes } from "@/lib/dominio/tandas";
import { LINK_MODO_CANCHA } from "@/lib/dominio/lineas";
import { chanceWhatsApp } from "@/lib/dominio/telefono";
import { ETIQUETA_ESTADO, type Prospecto } from "@/lib/dominio/tipos";
import { Encabezado, Tabla, Tarjeta, TituloSeccion, Vacio } from "@/components/ui";
import { SeccionSeguimientos, SeccionTanda, grupoDe } from "../tanda";

export const metadata = { title: "Modo Cancha" };

/** Prospección de complejos de canchas para Modo Cancha: tanda, seguimientos y la base, aparte de Cauce. */
export default async function ModoCancha() {
  const hoy = hoyAR();
  const { data } = await db()
    .from("prospectos")
    .select("id, nombre, rubro, ciudad, provincia, prioridad, estado, resenas, telefono, telefono_wa, maps_url, mensaje_inicial, tanda_fecha, contactado_el, seguimiento_el, ultimo_entrante_el")
    .order("prioridad")
    .order("resenas", { ascending: false })
    .limit(3000);
  const canchas = ((data ?? []) as Prospecto[]).filter((p) => grupoDe(p.rubro) === "canchas");

  const tanda = canchas.filter((p) => p.tanda_fecha === hoy || p.estado === "en_tanda");
  const seguimientoIds = new Set(seguimientosPendientes(canchas, new Date()));
  const seguimientos = canchas.filter((p) => seguimientoIds.has(p.id) && p.telefono_wa);

  const sinContactar = canchas.filter((p) => p.estado === "sin_contactar" && p.telefono_wa);
  const celulares = sinContactar.filter((p) => chanceWhatsApp(p.telefono, p.telefono_wa) === "alta").length;
  const contactados = canchas.filter((p) => p.contactado_el).length;
  const respondieron = canchas.filter((p) => p.ultimo_entrante_el || ["respondio", "interesado", "demo", "cliente"].includes(p.estado)).length;
  const interesados = canchas.filter((p) => ["interesado", "demo", "cliente"].includes(p.estado)).length;

  const porProvincia = new Map<string, number>();
  for (const p of sinContactar) porProvincia.set(p.provincia ?? "?", (porProvincia.get(p.provincia ?? "?") ?? 0) + 1);
  const provincias = [...porProvincia].sort((a, b) => b[1] - a[1]);

  if (!canchas.length) {
    return (
      <>
        <Encabezado titulo="Modo Cancha" detalle="Prospección de complejos de canchas" />
        <Vacio titulo="Todavía no hay complejos en la base">
          Cargalos corriendo <code>supabase/seed-canchas.sql</code> en el SQL Editor de Supabase.
        </Vacio>
      </>
    );
  }

  return (
    <>
      <Encabezado
        titulo="Modo Cancha"
        detalle={`Complejos de fútbol, pádel y deportivos. Límite diario aparte: ${env().TANDA_LIMITE_CANCHAS} primeros contactos (sale del mismo número que Cauce).`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sin contactar", sinContactar.length],
          ["Contactados", contactados],
          ["Respondieron", respondieron],
          ["Interesados", interesados],
        ].map(([t, v]) => (
          <Tarjeta key={t} className="p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-tenue">{t}</dt>
            <dd className="num text-2xl font-semibold">{v}</dd>
          </Tarjeta>
        ))}
      </dl>

      <SeccionTanda grupo="canchas" lista={tanda} titulo="Tanda de Modo Cancha" />
      <p className="-mt-2 text-sm text-tenue">
        De los {sinContactar.length} sin contactar, {celulares} figuran como celular y salen primero. El resto puede ser fijo: si WhatsApp te dice que el número no
        existe, tocá «No tiene WhatsApp» y entra otro. Si alguno quiere probar solo, el link es{" "}
        <a href={LINK_MODO_CANCHA} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
          {LINK_MODO_CANCHA.replace("https://", "")}
        </a>
        .
      </p>

      <SeccionSeguimientos seguimientos={seguimientos} />

      <Tarjeta className="flex flex-col gap-3 p-5">
        <TituloSeccion titulo="Complejos en la base" detalle={`${canchas.length} en total · sin contactar por provincia: ${provincias.map(([p, n]) => `${p} ${n}`).join(", ")}`} />
        <Tabla>
          <thead>
            <tr>
              <th>Complejo</th>
              <th>Rubro</th>
              <th>Ciudad</th>
              <th>Reseñas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {canchas.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.ultimo_entrante_el ? (
                    <Link href={`/conversaciones/${p.id}`} className="font-semibold hover:underline">
                      {p.nombre}
                    </Link>
                  ) : (
                    <span className="font-semibold">{p.nombre}</span>
                  )}
                </td>
                <td className="text-tenue">{p.rubro}</td>
                <td className="text-tenue">
                  {p.ciudad}
                  <span className="block text-xs">{p.provincia}</span>
                </td>
                <td className="num">{p.resenas ?? 0}</td>
                <td>{ETIQUETA_ESTADO[p.estado]}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Tarjeta>
    </>
  );
}
