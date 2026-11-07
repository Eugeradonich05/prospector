import { DEPORTES, ETIQUETA_SISTEMA, SISTEMAS } from "@/lib/dominio/complejos";
import { RUBROS_CANCHAS } from "@/lib/dominio/lineas";
import type { Prospecto } from "@/lib/dominio/tipos";
import { AreaTexto, Campo, Entrada, Selector } from "@/components/ui";

type Valores = Partial<Pick<Prospecto, "nombre" | "rubro" | "ciudad" | "provincia" | "direccion" | "telefono" | "instagram" | "web" | "deportes" | "canchas_cantidad" | "sistema_actual" | "notas">>;

/** Campos editables de un complejo. Van adentro de un <Formulario>. */
export function CamposComplejo({ valores = {} }: { valores?: Valores }) {
  const rubros = valores.rubro && !(RUBROS_CANCHAS as readonly string[]).includes(valores.rubro) ? [valores.rubro, ...RUBROS_CANCHAS] : RUBROS_CANCHAS;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre" htmlFor="nombre">
        <Entrada id="nombre" name="nombre" required maxLength={200} defaultValue={valores.nombre ?? ""} />
      </Campo>
      <Campo etiqueta="Rubro" htmlFor="rubro">
        <Selector id="rubro" name="rubro" defaultValue={valores.rubro ?? "Complejo de fútbol"}>
          {rubros.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Ciudad" htmlFor="ciudad">
        <Entrada id="ciudad" name="ciudad" maxLength={120} defaultValue={valores.ciudad ?? ""} />
      </Campo>
      <Campo etiqueta="Provincia" htmlFor="provincia">
        <Entrada id="provincia" name="provincia" maxLength={120} defaultValue={valores.provincia ?? ""} placeholder="Buenos Aires, Santa Fe, CABA…" />
      </Campo>
      <Campo etiqueta="Dirección" htmlFor="direccion">
        <Entrada id="direccion" name="direccion" maxLength={300} defaultValue={valores.direccion ?? ""} />
      </Campo>
      <Campo etiqueta="Teléfono" htmlFor="telefono" ayuda="Si es un celular argentino, queda listo para WhatsApp.">
        <Entrada id="telefono" name="telefono" type="tel" maxLength={40} defaultValue={valores.telefono ?? ""} placeholder="+54 9 336 412-3456" />
      </Campo>
      <Campo etiqueta="Instagram" htmlFor="instagram">
        <Entrada id="instagram" name="instagram" maxLength={200} defaultValue={valores.instagram ? `@${valores.instagram}` : ""} placeholder="@complejo" />
      </Campo>
      <Campo etiqueta="Web" htmlFor="web">
        <Entrada id="web" name="web" maxLength={300} defaultValue={valores.web ?? ""} placeholder="complejo.com.ar" />
      </Campo>
      <Campo etiqueta="Cantidad de canchas" htmlFor="canchas_cantidad">
        <Entrada id="canchas_cantidad" name="canchas_cantidad" type="number" min={1} max={200} defaultValue={valores.canchas_cantidad ?? ""} />
      </Campo>
      <Campo etiqueta="Sistema actual de reservas" htmlFor="sistema_actual">
        <Selector id="sistema_actual" name="sistema_actual" defaultValue={valores.sistema_actual ?? ""}>
          <option value="">No se sabe</option>
          {SISTEMAS.map((s) => (
            <option key={s} value={s}>
              {ETIQUETA_SISTEMA[s]}
            </option>
          ))}
        </Selector>
      </Campo>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-semibold">Deportes</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {DEPORTES.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="deportes" value={d} defaultChecked={valores.deportes?.includes(d)} className="size-4 accent-[var(--marca)]" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <Campo etiqueta="Notas" htmlFor="notas">
          <AreaTexto id="notas" name="notas" maxLength={2000} defaultValue={valores.notas ?? ""} className="min-h-16" />
        </Campo>
      </div>
    </div>
  );
}
