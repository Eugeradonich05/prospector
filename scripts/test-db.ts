/** Aplica las migraciones y el seed en un Postgres embebido y revisa lo básico. Uso: npm run test:db */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;`);
const raiz = join(import.meta.dirname, "..", "supabase");
for (const f of readdirSync(join(raiz, "migrations")).sort()) await db.exec(readFileSync(join(raiz, "migrations", f), "utf8"));
await db.exec(readFileSync(join(raiz, "seed-canchas.sql"), "utf8"));
await db.exec(readFileSync(join(raiz, "seed-canchas.sql"), "utf8")); // segunda vez: no duplica

let fallas = 0;
const ok = (c: unknown, n: string) => { console.log(`${c ? "✓" : "✗"} ${n}`); if (!c) fallas++; };
const uno = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows[0]!;

const total = Number((await uno("select count(*) n from prospectos")).n);
const conWa = Number((await uno("select count(telefono_wa) n from prospectos")).n);
ok(total === 455, `seed-canchas.sql cargó ${total} complejos y no duplica al correrlo dos veces`);
const canchas = Number((await uno("select count(*) n from prospectos where rubro ~* 'cancha|p[aá]del|f[uú]tbol|tenis|complejo deportivo'")).n);
ok(canchas === total, "todos los rubros son de canchas");
ok(conWa > 0 && conWa <= total, `${conWa} con WhatsApp válido`);
const conPlace = Number((await uno("select count(distinct place_id) n from prospectos where origen = 'seed'")).n);
ok(conPlace === total, `los ${conPlace} del seed tienen place_id (de Google Maps) y origen seed`);
ok(Number((await uno("select count(*) n from prospectos where 'pádel' = any(deportes)")).n) > 100, "los deportes se completaron desde el nombre y el rubro");
try { await db.query("update prospectos set sistema_actual = 'excel' where id = (select id from prospectos limit 1)"); ok(false, "sistema_actual"); }
catch { ok(true, "sistema_actual solo acepta ninguno, whatsapp_manual, atc, clubo u otro"); }
try { await db.query("insert into prospectos (nombre, place_id) select 'Copia', place_id from prospectos limit 1"); ok(false, "place_id único"); }
catch { ok(true, "no se puede cargar dos veces el mismo place_id"); }
await db.query("insert into busquedas (zona, radio_km, deportes, encontrados, nuevos, llamadas) values ('San Nicolás', 15, '{fútbol,pádel}', 40, 12, 7)");
ok(Number((await uno("select count(*) n from busquedas")).n) === 1, "guarda las búsquedas");
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
