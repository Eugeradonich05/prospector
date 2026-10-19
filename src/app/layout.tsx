import type { Metadata } from "next";
import "@fontsource-variable/onest";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Prospector", template: "%s · Prospector" },
  description: "Tandas de contacto y respuestas automáticas por WhatsApp para los servicios de Cauce.",
  robots: { index: false, follow: false },
};

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh bg-papel text-tinta">{children}</body>
    </html>
  );
}
