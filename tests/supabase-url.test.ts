import { describe, expect, it } from "vitest";
import { urlBaseSupabase } from "@/lib/datos/supabase";

describe("URL de Supabase", () => {
  it.each([
    ["https://abc.supabase.co", "https://abc.supabase.co"],
    ["https://abc.supabase.co/", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1", "https://abc.supabase.co"],
    ["https://abc.supabase.co/rest/v1/", "https://abc.supabase.co"],
    ["  https://abc.supabase.co/rest/v1/  ", "https://abc.supabase.co"],
  ])("%s → %s", (entrada, salida) => {
    expect(urlBaseSupabase(entrada)).toBe(salida);
  });
});
