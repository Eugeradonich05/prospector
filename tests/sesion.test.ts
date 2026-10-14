import { describe, expect, it } from "vitest";
import { crearSesion, sesionValida, claveCorrecta } from "@/lib/sesion";

describe("sesión del panel", () => {
  const S = "x".repeat(40);
  it("acepta una sesión propia vigente", () => {
    expect(sesionValida(crearSesion(S), S)).toBe(true);
  });
  it("rechaza sesiones vencidas, ajenas o manipuladas", () => {
    const s = crearSesion(S, 0);
    expect(sesionValida(s, S, 31 * 86_400_000)).toBe(false);
    expect(sesionValida(crearSesion(S), "y".repeat(40))).toBe(false);
    const [v, f] = crearSesion(S).split(".");
    expect(sesionValida(`${Number(v) + 1}.${f}`, S)).toBe(false);
    expect(sesionValida(undefined, S)).toBe(false);
  });
  it("compara la clave", () => {
    expect(claveCorrecta("clave-larga-1", "clave-larga-1")).toBe(true);
    expect(claveCorrecta("clave-larga-2", "clave-larga-1")).toBe(false);
  });
});
