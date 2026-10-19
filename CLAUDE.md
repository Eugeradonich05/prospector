# Prospector · Guía para Claude Code

Bot de prospección por WhatsApp de un solo dueño (Eugenio) para vender los servicios de Cauce: Cuotas al día, bot de turnos, buscador en documentos y automatización a medida. Modo Cancha queda afuera (producto aparte). Todo en español rioplatense.

## Reglas que no se rompen

- **El bot nunca inicia conversaciones.** Solo responde dentro de la ventana de 24 h. El primer mensaje y el único seguimiento los manda Eugenio desde su app (tandas asistidas). No agregar envío masivo ni automático de primeros mensajes: viola la política de WhatsApp Business y pone en riesgo el número.
- El bot solo habla con números que están en `prospectos`. Cualquier otro chat del número se ignora.
- Los pedidos de baja se detectan con `esPedidoDeBaja()` antes del modelo y marcan `no_contactar` para siempre.
- Lo que sabe el bot está solo en `src/lib/bot/conocimiento.ts`, separado por servicio. No inventa precios ni funciones; solo Cuotas al día tiene precios.
- El servicio de cada prospecto sale de su rubro con `lineaDeRubro()` (`src/lib/dominio/lineas.ts`). Los complejos de canchas devuelven `null`: no entran en tandas (Modo Cancha va aparte). Si sumás un rubro, agregalo ahí y a `tests/lineas.test.ts`.
- La salida del modelo pasa siempre por `normalizarDecision()`.

## Estructura

- `src/lib/bot/manejar.ts`: orquestación (testeada en `tests/bot.test.ts` con almacén en memoria y cerebro falso).
- `src/lib/bot/claude.ts`: llamadas a Claude (respuesta con tool forzada y redacción del primer mensaje).
- `src/lib/whatsapp/`: lectura del webhook (mensajes y ecos), firma de Meta y envío (Meta o 360dialog).
- `src/app/(panel)/`: Hoy (tanda y seguimientos), Conversaciones, Prospectos. Acciones en `src/app/acciones.ts`.

## Comandos

`npm run check` antes de dar algo por terminado.
