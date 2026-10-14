import { Navegacion } from "./navegacion";
import { salir } from "../acciones";

export const dynamic = "force-dynamic";

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linea px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-display text-lg font-extrabold">Prospector</span>
          <Navegacion />
        </div>
        <form action={salir}>
          <button className="text-sm font-semibold text-tenue hover:text-tinta">Salir</button>
        </form>
      </header>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
