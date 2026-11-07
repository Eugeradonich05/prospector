"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ESTADO_INICIAL } from "@/lib/acciones";
import { ETIQUETA_SISTEMA } from "@/lib/dominio/complejos";
import { MAX_FILAS_IMPORTAR, type ResultadoFila } from "@/lib/dominio/importar";
import { Aviso, Boton, Etiqueta, Tabla, Tarjeta, TituloSeccion, cx } from "@/components/ui";
import { importarPlanilla, type EstadoImportacion } from "../acciones";

type Celda = string | number | boolean | null;

/** Lee un .csv o .xlsx en el navegador y lo deja como tabla de textos. El archivo no se sube: se manda solo la tabla. */
async function leerArchivo(archivo: File): Promise<Celda[][]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const filas = await readSheet(archivo);
    return filas.map((f) => f.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : (c as Celda))));
  }
  if (nombre.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const texto = await archivo.text();
    const r = Papa.parse<string[]>(texto, { skipEmptyLines: "greedy" });
    return r.data;
  }
  throw new Error("Subí un archivo .csv o .xlsx.");
}

const ETIQUETAS: Record<ResultadoFila["tipo"], { texto: string; tono: "marca" | "neutro" | "aviso" | "debe" }> = {
  nuevo: { texto: "Nuevo", tono: "marca" },
  sin_telefono: { texto: "Sin teléfono", tono: "aviso" },
  ya_estaba: { texto: "Ya estaba", tono: "neutro" },
  rechazado: { texto: "Rechazado", tono: "debe" },
};

function BotonEnviar({ children, variante }: { children: React.ReactNode; variante?: "primario" | "secundario" }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" variante={variante} disabled={pending}>
      {pending ? "Un momento…" : children}
    </Boton>
  );
}

export function Importador() {
  const [tabla, setTabla] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  // Respuesta que había cuando se eligió el archivo: queda vieja y no se muestra.
  const [marcaVieja, setMarcaVieja] = useState<number | undefined>(undefined);
  const [estadoAccion, despachar] = useActionState<EstadoImportacion, FormData>(importarPlanilla, ESTADO_INICIAL);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setTabla(null);
    setErrorArchivo(null);
    setMarcaVieja(estadoAccion.marca);
    if (!f) return;
    try {
      const filas = await leerArchivo(f);
      if (filas.length > MAX_FILAS_IMPORTAR + 1) throw new Error(`La planilla tiene ${filas.length - 1} filas: como mucho ${MAX_FILAS_IMPORTAR} por vez.`);
      setTabla(JSON.stringify(filas));
      setArchivo(f.name);
    } catch (err) {
      setErrorArchivo(err instanceof Error ? err.message : "No pude leer el archivo.");
    }
  }

  // El resultado de la acción vale solo para el archivo con el que se pidió.
  const estado: EstadoImportacion = estadoAccion.marca !== marcaVieja ? estadoAccion : ESTADO_INICIAL;
  const resultados = estado.clasificacion?.resultados ?? [];
  const cuantos = (t: ResultadoFila["tipo"]) => resultados.filter((r) => r.tipo === t).length;
  const aGuardar = cuantos("nuevo") + cuantos("sin_telefono");

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-col gap-4 p-5">
        <form action={despachar} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Archivo (.csv o .xlsx)
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={alElegir}
              className="text-sm font-normal file:mr-3 file:rounded-md file:border file:border-linea file:bg-superficie file:px-3 file:py-1.5 file:font-semibold"
            />
          </label>
          <p className="text-xs text-tenue">
            La primera fila tiene que tener los títulos. Columnas que reconoce: nombre, ciudad, provincia, dirección, teléfono, instagram, sistema actual y notas
            (también rubro, deportes, canchas y web). La única obligatoria es nombre. El archivo se lee en tu navegador.
          </p>
          {errorArchivo ? <Aviso tono="debe">{errorArchivo}</Aviso> : null}
          {tabla ? <input type="hidden" name="tabla" value={tabla} /> : null}
          {tabla && !estado.importado ? <BotonEnviar variante="secundario">Ver vista previa de {archivo}</BotonEnviar> : null}
        </form>
        {estado.error ? (
          <p role="status" className="rounded-md bg-debe-suave px-3 py-2 text-sm text-debe">
            {estado.error}
          </p>
        ) : estado.ok ? (
          <p role="status" className={cx("rounded-md px-3 py-2 text-sm", estado.importado ? "bg-ok-suave text-ok" : "bg-marca-suave text-marca")}>
            {estado.ok}
          </p>
        ) : null}
        {estado.clasificacion?.ignoradas.length ? <p className="text-xs text-tenue">Columnas que no usé: {estado.clasificacion.ignoradas.join(", ")}.</p> : null}
      </Tarjeta>

      {resultados.length && !estado.importado && tabla ? (
        <form action={despachar} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="tabla" value={tabla} />
          <input type="hidden" name="confirmar" value="1" />
          <BotonEnviar>{aGuardar ? `Importar ${aGuardar} complejos` : "No hay nada nuevo para importar"}</BotonEnviar>
          <span className="text-sm text-tenue">Los «sin teléfono» se cargan igual (para contactarlos por Instagram o por llamada), pero no entran en las tandas.</span>
        </form>
      ) : null}

      {resultados.length ? (
        <Tarjeta className="flex flex-col gap-3 p-5">
          <TituloSeccion titulo={estado.importado ? "Resultado" : "Vista previa"} detalle={`${resultados.length} filas`} />
          <Tabla>
            <thead>
              <tr>
                <th>Complejo</th>
                <th>Ciudad</th>
                <th>Teléfono</th>
                <th>Sistema</th>
                <th>Qué pasa</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, i) => (
                <tr key={i}>
                  <td className="font-semibold">{r.tipo === "rechazado" ? r.nombre : r.fila.nombre}</td>
                  <td className="text-tenue">{r.tipo === "rechazado" ? "" : [r.fila.ciudad, r.fila.provincia].filter(Boolean).join(", ")}</td>
                  <td className="num text-tenue">{r.tipo === "rechazado" ? "" : (r.fila.telefono ?? "—")}</td>
                  <td className="text-tenue">{r.tipo !== "rechazado" && r.fila.sistema_actual ? ETIQUETA_SISTEMA[r.fila.sistema_actual] : "—"}</td>
                  <td>
                    <Etiqueta tono={ETIQUETAS[r.tipo].tono}>{ETIQUETAS[r.tipo].texto}</Etiqueta>
                    {r.tipo === "ya_estaba" ? <span className="block text-xs text-tenue">igual a {r.con}</span> : null}
                    {r.tipo === "rechazado" ? <span className="block text-xs text-tenue">{r.motivo}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : null}
    </div>
  );
}
