import { Formulario, Enviar } from "@/components/formulario";
import { Campo, Entrada } from "@/components/ui";
import { ingresar } from "../acciones";

export const metadata = { title: "Ingresar" };

export default function Ingresar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div className="border-l-4 border-acento pl-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-acento-tinta">Modo Cancha</p>
        <h1 className="text-3xl font-extrabold">Prospector · Modo Cancha</h1>
        <p className="mt-1 text-sm text-tenue">Prospección de complejos deportivos por WhatsApp.</p>
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
