-- Prospector · Modo Cancha: base de complejos más rica y registro de búsquedas en Google Maps.
-- No edita la migración original: solo agrega columnas, índices y la tabla «busquedas».

alter table public.prospectos
  add column place_id          text unique,                          -- id de Google Maps: evita cargar dos veces el mismo complejo
  add column deportes          text[] not null default '{}',         -- fútbol 5, fútbol 7, pádel, tenis, básquet, vóley, etc.
  add column canchas_cantidad  integer check (canchas_cantidad is null or canchas_cantidad between 1 and 200),
  add column instagram         text,
  add column web               text,
  add column sistema_actual    text check (sistema_actual is null or sistema_actual in (
                                 'ninguno',          -- no usan nada (anotan como pueden)
                                 'whatsapp_manual',  -- reservas por WhatsApp y a mano
                                 'atc',              -- ATC (Alquila Tu Cancha)
                                 'clubo',
                                 'otro'
                               )),                                   -- null: no se sabe
  add column lat               double precision,
  add column lng               double precision,
  add column origen            text not null default 'manual' check (origen in ('seed', 'google', 'importado', 'manual'));

-- Si la base ya tenía los complejos del seed: completa place_id con el query_place_id del link de Maps.
update public.prospectos
set place_id = substring(maps_url from 'query_place_id=([^&]+)'),
    origen = 'seed'
where place_id is null
  and maps_url like '%query_place_id=%';

create index prospectos_zona_idx on public.prospectos (provincia, ciudad);
-- Por estado: prospectos_estado_idx (estado, prioridad) de la migración original ya sirve para filtrar solo por estado.
create index prospectos_deportes_idx on public.prospectos using gin (deportes);

-- Cada búsqueda de «Buscar complejos»: para saber qué zonas ya se barrieron.
-- Guarda los resultados para poder agregar los elegidos sin volver a llamar a Google.
create table public.busquedas (
  id           uuid primary key default gen_random_uuid(),
  zona         text not null,
  radio_km     integer not null check (radio_km between 1 and 50),
  deportes     text[] not null default '{}',
  encontrados  integer not null default 0,
  nuevos       integer not null default 0,
  llamadas     integer not null default 0,   -- llamadas a Google Places que hizo la búsqueda
  resultados   jsonb not null default '[]'::jsonb,
  creado       timestamptz not null default now()
);

create index busquedas_creado_idx on public.busquedas (creado desc);

alter table public.busquedas enable row level security;
revoke all on public.busquedas from anon, authenticated;
