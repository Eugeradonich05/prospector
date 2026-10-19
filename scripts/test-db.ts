/** Aplica la migración y el seed en un Postgres embebido y revisa lo básico. Uso: npm run test:db */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin;`);
const raiz = join(import.meta.dirname, "..", "supabase");
for (const f of readdirSync(join(raiz, "migrations")).sort()) await db.exec(readFileSync(join(raiz, "migrations", f), "utf8"));
await db.exec(readFileSync(join(raiz, "seed.sql"), "utf8"));
await db.exec(readFileSync(join(raiz, "seed.sql"), "utf8")); // segunda vez: no duplica
const enSeed = Number((await db.query<{ n: number }>("select count(*) n from prospectos")).rows[0]!.n);
await db.exec(readFileSync(join(raiz, "seed-cauce.sql"), "utf8"));
await db.exec(readFileSync(join(raiz, "seed-cauce.sql"), "utf8")); // segunda vez: no duplica

let fallas = 0;
const ok = (c: unknown, n: string) => { console.log(`${c ? "✓" : "✗"} ${n}`); if (!c) fallas++; };
const uno = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows[0]!;

const total = Number((await uno("select count(*) n from prospectos")).n);
const conWa = Number((await uno("select count(telefono_wa) n from prospectos")).n);
ok(enSeed === 145, `seed.sql cargó ${enSeed} prospectos de Cuotas al día y no duplica al correrlo dos veces`);
ok(total === 145 + 524, `seed-cauce.sql sumó ${total - enSeed} prospectos de otros rubros sin duplicar`);
ok(Number((await uno("select count(*) n from prospectos where rubro ~* 'cancha|p[aá]del|f[uú]tbol'")).n) === 0, "no hay complejos de canchas (Modo Cancha va aparte)");
ok(conWa > 0 && conWa <= total, `${conWa} con WhatsApp válido`);
ok(Number((await uno("select count(*) n from prospectos where estado <> 'sin_contactar'")).n) === 0, "todos arrancan sin contactar");
const p = (await uno("select id from prospectos where telefono_wa is not null limit 1")).id;
await db.query("insert into mensajes (prospecto_id, direccion, texto, wa_id) values ($1, 'entrante', 'hola', 'wamid.1')", [p]);
try { await db.query("insert into mensajes (prospecto_id, direccion, texto, wa_id) values ($1, 'entrante', 'hola', 'wamid.1')", [p]); ok(false, "wa_id único"); }
catch { ok(true, "un mismo mensaje de WhatsApp no se guarda dos veces"); }
try { await db.query("update prospectos set telefono_wa = '12345' where id = $1", [p]); ok(false, "formato de teléfono"); }
catch { ok(true, "rechaza teléfonos con formato inválido"); }
await db.exec("set role anon");
try { await db.query("select * from prospectos"); ok(false, "anon bloqueado"); } catch { ok(true, "la clave pública no puede leer prospectos"); }
await db.exec("reset role");
console.log(fallas ? `${fallas} fallaron` : "todo bien");
process.exit(fallas ? 1 : 0);
