import Link from "next/link";
import { Encabezado, Tarjeta } from "@/components/ui";
import { Formulario, Enviar } from "@/components/formulario";
import { CamposComplejo } from "../campos";
import { crearComplejo } from "../acciones";

export const metadata = { title: "Agregar complejo" };

export default function NuevoComplejo() {
  return (
    <>
      <Encabezado
        titulo="Agregar a mano"
        detalle={
          <Link href="/complejos" className="hover:underline">
            ← Complejos
          </Link>
        }
      />
      <Tarjeta className="p-5">
        <Formulario accion={crearComplejo}>
          <CamposComplejo />
          <p className="text-sm text-tenue">Entra como «Sin contactar», con prioridad B. Si ya está en la base (mismo teléfono o mismo nombre y ciudad), te avisa.</p>
          <Enviar className="self-start">Agregar complejo</Enviar>
        </Formulario>
      </Tarjeta>
    </>
  );
}
