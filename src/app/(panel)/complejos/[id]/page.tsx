import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/datos/supabase";
import { ETIQUETA_SISTEMA } from "@/lib/dominio/complejos";
import { enlaceSeguro, linkInstagram } from "@/lib/dominio/datos-complejo";
import { chanceWhatsApp } from "@/lib/dominio/telefono";
import { ETIQUETA_ESTADO, type Prospecto } from "@/lib/dominio/tipos";
import { Campo, Encabezado, Etiqueta, Selector, Tarjeta, TituloSeccion } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { CamposComplejo } from "../campos";
import { editarComplejo } from "../acciones";

export const metadata = { title: "Complejo" };

const ORIGEN = { seed: "Base inicial", google: "Buscar complejos (Google Maps)", importado: "Planilla importada", manual: "Cargado a mano" } as const;

export default async function FichaComplejo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await db().from("prospectos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Prospecto;
  const wa = p.telefono_wa ? chanceWhatsApp(p.telefono, p.telefono_wa) : null;
  const maps = enlaceSeguro(p.maps_url);
  const web = enlaceSeguro(p.web);

  return (
    <>
      <Encabezado
        titulo={p.nombre}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/complejos" className="hover:underline">
              ← Complejos
            </Link>
            <Etiqueta tono="marca">{ETIQUETA_ESTADO[p.estado]}</Etiqueta>
            <Etiqueta>Prioridad {p.prioridad}</Etiqueta>
            {wa === "alta" ? <Etiqueta tono="marca">Celular</Etiqueta> : wa ? <Etiqueta>WhatsApp sin confirmar</Etiqueta> : <Etiqueta tono="aviso">Sin WhatsApp</Etiqueta>}
            {p.sistema_actual ? <Etiqueta>{ETIQUETA_SISTEMA[p.sistema_actual]}</Etiqueta> : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="p-5 lg:col-span-2">
          <Formulario accion={editarComplejo}>
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
            <CamposComplejo valores={p} />
            <Enviar className="self-start">Guardar</Enviar>
          </Formulario>
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-3 p-5 text-sm">
          <TituloSeccion titulo="Datos" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-tenue">Reseñas</dt>
            <dd className="num">
              {p.resenas ?? 0}
              {p.calificacion ? ` · ${p.calificacion}★` : ""}
            </dd>
            <dt className="text-tenue">Origen</dt>
            <dd>{ORIGEN[p.origen]}</dd>
            <dt className="text-tenue">WhatsApp</dt>
            <dd className="num">{p.telefono_wa ?? "—"}</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            {maps ? (
              <a href={maps} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
                Ver en Maps
              </a>
            ) : null}
            {p.instagram ? (
              <a href={linkInstagram(p.instagram)} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
                Instagram
              </a>
            ) : null}
            {web ? (
              <a href={web} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline">
                Web
              </a>
            ) : null}
            {p.ultimo_entrante_el ? (
              <Link href={`/conversaciones/${p.id}`} className="font-semibold text-marca underline">
                Conversación
              </Link>
            ) : null}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
