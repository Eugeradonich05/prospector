import { afterEach, describe, expect, it, vi } from "vitest";

const BASE = {
  NEXT_PUBLIC_APP_URL: "https://panel.test",
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_" + "x".repeat(20),
  ADMIN_CLAVE: "una-clave-larga",
  SESION_SECRETO: "s".repeat(48),
  ANTHROPIC_API_KEY: "sk-ant-" + "x".repeat(20),
  WHATSAPP_VERIFY_TOKEN: "verificar",
};

async function leer(extra: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, ...extra })) vi.stubEnv(k, v);
  const { env } = await import("@/lib/env");
  return env();
}

describe("variables de entorno", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa los valores por defecto de Modo Cancha", async () => {
    const e = await leer({ GOOGLE_MAPS_API_KEY: "", LINK_SITIO: "" });
    expect(e.TANDA_LIMITE).toBe(10);
    expect(e.LINK_PRUEBA_GRATIS).toBe("https://www.modocanchas.com/prueba-gratis");
    expect(e.LINK_SITIO).toBe("https://www.modocanchas.com");
    expect(e.GOOGLE_MAPS_API_KEY).toBeUndefined();
  });

  it("una clave de Google mal pegada cuenta como no cargada y no rompe el resto (el bot sigue andando)", async () => {
    const e = await leer({ GOOGLE_MAPS_API_KEY: "corta" });
    expect(e.GOOGLE_MAPS_API_KEY).toBeUndefined();
    expect(e.TANDA_LIMITE).toBe(10);
  });
});
