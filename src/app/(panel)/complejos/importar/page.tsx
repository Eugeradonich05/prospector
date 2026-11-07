import Link from "next/link";
import { Encabezado } from "@/components/ui";
import { Importador } from "./importador";

export const metadata = { title: "Importar planilla" };

export default function Importar() {
  return (
    <>
      <Encabezado
        titulo="Importar planilla"
        detalle={
          <span>
            <Link href="/complejos" className="hover:underline">
              ← Complejos
            </Link>{" "}
            · Primero ves la vista previa; no se guarda nada hasta que confirmás. Los que ya están (mismo lugar de Maps, mismo WhatsApp o mismo nombre y ciudad) se saltean.
          </span>
        }
      />
      <Importador />
    </>
  );
}
