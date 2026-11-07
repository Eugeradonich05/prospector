export const metadata = { title: "Política de privacidad" };

const CONTACTO = "+54 9 11 7813-2127";

/** Página pública (la pide Meta para publicar la app de WhatsApp). */
export default function Privacidad() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10 text-sm leading-relaxed">
      <div>
        <p className="font-semibold uppercase tracking-wide text-acento-tinta">Modo Cancha</p>
        <h1 className="text-3xl font-extrabold">Política de privacidad</h1>
        <p className="text-tenue">Última actualización: 7 de noviembre de 2026</p>
      </div>

      <p>
        Esta política explica cómo Eugenio Radonich (Rosario, Santa Fe, Argentina), responsable de Modo Cancha (modocanchas.com, reservas de canchas online),
        trata los datos de las conversaciones de WhatsApp con complejos deportivos que pueden estar interesados en Modo Cancha.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Qué datos usamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Datos públicos del complejo: nombre, deportes, dirección, ciudad, teléfono, web e Instagram, tal como figuran en Google Maps o en sus redes.</li>
          <li>Los mensajes que el complejo nos envía por WhatsApp y nuestras respuestas.</li>
          <li>Lo que el complejo nos cuenta en la conversación, por ejemplo cuántas canchas tiene o cómo toma hoy las reservas.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Para qué</h2>
        <p>
          Solo para responder consultas sobre Modo Cancha y, si hay interés, coordinar una prueba, una charla o una demostración. No vendemos ni cedemos
          los datos a terceros y no los usamos para publicidad.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Quién más los procesa</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Meta (WhatsApp Business Platform), para enviar y recibir los mensajes.</li>
          <li>Anthropic (Claude), para redactar respuestas automáticas a partir de la conversación.</li>
          <li>Google (Google Maps Platform), de donde salen los datos públicos de los complejos.</li>
          <li>Supabase y Vercel, donde se guardan los datos y funciona el sistema.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Cuánto tiempo los guardamos</h2>
        <p>Mientras la conversación esté activa y hasta 12 meses después del último mensaje, salvo que pidas antes que los borremos.</p>
      </section>

      <section className="flex flex-col gap-2" id="eliminacion">
        <h2 className="text-lg font-bold">Cómo pedir que no te escribamos o que borremos tus datos</h2>
        <p>
          Respondé «BAJA» en la conversación de WhatsApp y no te volvemos a escribir. Para que eliminemos tus datos, escribinos por WhatsApp al{" "}
          {CONTACTO} pidiendo la eliminación: la hacemos dentro de los 10 días hábiles y te lo confirmamos.
        </p>
        <p>
          También podés ejercer tus derechos de acceso, rectificación y supresión según la Ley 25.326 de Protección de Datos Personales. La
          Agencia de Acceso a la Información Pública es la autoridad de control.
        </p>
      </section>
    </main>
  );
}
