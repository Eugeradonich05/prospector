import { Formulario, Enviar } from "@/components/formulario";
import { Campo, Entrada } from "@/components/ui";
import { ingresar } from "../acciones";

export const metadata = { title: "Ingresar" };

export default function Ingresar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-tenue">Cauce</p>
        <h1 className="text-3xl font-extrabold">Prospector</h1>
      </div>
      <Formulario accion={ingresar}>
        <Campo etiqueta="Clave" htmlFor="clave">
          <Entrada id="clave" name="clave" type="password" autoComplete="current-password" required autoFocus />
        </Campo>
        <Enviar>Entrar</Enviar>
      </Formulario>
    </main>
  );
}
