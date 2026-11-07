# Prospector · Modo Cancha · Guía para Claude Code

Herramienta de un solo dueño (Eugenio) para venderle Modo Cancha (modocanchas.com, reservas de canchas online) a complejos deportivos de toda Argentina por WhatsApp. Todo en español rioplatense, con voseo. No hay otros productos: nada de Cauce.

## Reglas que no se rompen

- **El primer mensaje y el único seguimiento (a los 3 días) los manda una persona desde su app de WhatsApp**, con «Abrir WhatsApp». No agregar envío automático ni masivo de primeros mensajes, ni plantillas pagas: viola la política de WhatsApp Business y pone en riesgo el número.
- El bot solo responde dentro de la ventana de 24 h (`ventanaAbierta()`) y solo a números que están en `prospectos`. Cualquier otro chat se ignora.
- Los pedidos de baja se detectan con `esPedidoDeBaja()` antes del modelo y marcan `no_contactar` para siempre.
- La salida del modelo pasa siempre por `normalizarDecision()`.
- Ninguna clave en el código: todo por variables de entorno (`src/lib/env.ts`). `GOOGLE_MAPS_API_KEY` es solo servidor.
- Solo entran rubros de canchas (`esRubroDeCanchas()` en `src/lib/dominio/lineas.ts`); el resto se rechaza al cargar.
- Lo que sabe el bot está solo en `src/lib/bot/conocimiento.ts`. No inventa funciones; los precios están en `PRECIOS_PLANES` (revisar antes de publicar).
- No editar migraciones ya aplicadas: agregar una nueva en `supabase/migrations/`.

## Estructura

- `src/lib/dominio/`: reglas puras y testeadas. `tandas.ts` (elegir tanda por zona, seguimiento, copiar lista), `complejos.ts` (deportes, rubro, prioridad por reseñas, sistema actual, deduplicado), `datos-complejo.ts` (validación de la ficha), `importar.ts` (planillas), `telefono.ts`, `ventana.ts`.
- `src/lib/google/`: Places API (New). `places.ts` (cliente con `fetch` inyectable) y `complejos-google.ts` (normalización y filtro de «no es complejo»).
- `src/lib/bot/`: `manejar.ts` (orquestación), `claude.ts` (llamadas), `primer-mensaje.ts` (pedido del primer mensaje según deportes y sistema actual, puro), `cerebro.ts`, `conocimiento.ts`.
- `src/lib/tanda-servidor.ts`: arma la tanda de hoy (límite, zona, solo ciertos ids) y redacta los mensajes.
- `src/lib/datos/leer-todo.ts`: Supabase devuelve como mucho 1000 filas: usarlo para leer la base entera.
- `src/app/(panel)/`: Hoy (`page.tsx` + `tanda.tsx`), Buscar complejos (`buscar/`), Complejos (`complejos/`: lista con filtros, ficha, agregar a mano, importar), Conversaciones, Conectar WhatsApp. Acciones de tanda y conversación en `src/app/acciones.ts`.

## Tests

`tests/` usa vitest. Google se prueba con respuestas de ejemplo en `tests/fixtures/` (nunca llamar a Google en tests). `scripts/test-db.ts` aplica las migraciones y el seed en Postgres embebido.

## Comandos

`npm run check` antes de dar algo por terminado.
