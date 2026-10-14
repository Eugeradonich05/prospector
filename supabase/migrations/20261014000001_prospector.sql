-- Prospector · bot de prospección por WhatsApp
-- Herramienta de un solo dueño: la app usa la clave secreta desde el servidor.
-- RLS activado sin políticas: nadie con la clave pública puede leer ni escribir.

create or replace function public.hoy_ar()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

create table public.prospectos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  rubro               text,
  ciudad              text,
  provincia           text,
  direccion           text,
  telefono            text,
  telefono_wa         text unique check (telefono_wa is null or telefono_wa ~ '^549[0-9]{10}$'),
  prioridad           text not null default 'B' check (prioridad in ('A', 'B', 'C')),
  resenas             integer,
  calificacion        numeric(2,1),
  maps_url            text,

  estado              text not null default 'sin_contactar' check (estado in (
                        'sin_contactar',  -- todavía no se le escribió
                        'en_tanda',       -- elegido para hoy, esperando que lo envíes
                        'contactado',     -- primer mensaje enviado
                        'respondio',      -- contestó
                        'interesado',     -- mostró interés concreto
                        'demo',           -- llamada o demo acordada
                        'cliente',
                        'descartado',     -- no es cliente (no aplica, ya tiene sistema, etc.)
                        'no_contactar'    -- pidió que no le escriban: nunca más
                      )),
  tanda_fecha         date,
  mensaje_inicial     text,
  contactado_el       timestamptz,
  seguimiento_el      timestamptz,
  ultimo_entrante_el  timestamptz,

  bot_activo          boolean not null default true,
  humano_hasta        timestamptz,          -- el bot no responde hasta esta hora (tomaste la conversación)
  necesita_humano     boolean not null default false,
  motivo_humano       text,
  datos               jsonb not null default '{}'::jsonb, -- lo que el bot fue averiguando (alumnos, cómo cobran, etc.)
  notas               text,
  creado              timestamptz not null default now(),
  unique (nombre, direccion)
);

create index prospectos_estado_idx on public.prospectos (estado, prioridad);
create index prospectos_tanda_idx on public.prospectos (tanda_fecha);

create table public.mensajes (
  id            bigint generated always as identity primary key,
  prospecto_id  uuid not null references public.prospectos(id) on delete cascade,
  direccion     text not null check (direccion in ('entrante', 'bot', 'humano')),
  tipo          text not null default 'text',
  texto         text,
  wa_id         text unique,     -- id de WhatsApp: evita procesar dos veces el mismo mensaje
  creado        timestamptz not null default now()
);

create index mensajes_prospecto_idx on public.mensajes (prospecto_id, creado);

alter table public.prospectos enable row level security;
alter table public.mensajes enable row level security;
revoke all on public.prospectos, public.mensajes from anon, authenticated;
