# Prospector · Modo Cancha

Herramienta de prospección por WhatsApp para vender **Modo Cancha** (modocanchas.com, reservas de canchas online) a complejos deportivos de toda Argentina.

- **Buscás complejos nuevos** de una zona en Google Maps y los sumás a la base con un clic. También podés importar una planilla o cargarlos a mano.
- **Vos mandás el primer mensaje**, en tandas diarias que arma el panel: unos 10 complejos por día, cada uno con un mensaje distinto escrito por Claude según sus deportes y cómo reservan hoy. Tocás «Abrir WhatsApp» y «Enviar».
- **El bot contesta solo** cuando el complejo responde: pregunta cómo toman las reservas, explica Modo Cancha, pasa la prueba gratis y **te pasa la conversación** cuando hay interés real, mandan un audio o algo se complica.
- **Respeta el «no»:** si alguien pide que no le escriban, se marca y no se le escribe nunca más.

## Por qué el primer mensaje no es automático

Las reglas de WhatsApp Business exigen que la persona haya aceptado recibir mensajes antes de que una empresa le escriba por la API. Si un bot les manda mensajes en automático a números sacados de Google Maps (aunque sea de a tandas), viola esas reglas, y unos pocos bloqueos o denuncias alcanzan para que Meta limite o dé de baja el número.

| Paso | Quién | Por dónde | Por qué es seguro |
|---|---|---|---|
| Primer mensaje y un único seguimiento a los 3 días | Vos, con un toque | Tu app de WhatsApp Business | Lo mandás vos, personalizado, de a pocos por día |
| Respuestas | El bot | Cloud API | Solo contesta dentro de las 24 h desde que el complejo te escribió, y solo a números que están en la base |
| Casos difíciles | Vos | App o panel | El bot se corre solo |

No hay envío masivo ni plantillas pagas: el bot nunca inicia conversaciones.

## Cómo funciona por dentro

```
Buscar complejos ── Google Places ──► base (Supabase)
Importar planilla / Agregar a mano ──┘
                                      │
Hoy ── arma la tanda (por zona) ──► Claude redacta cada mensaje
  │
  └─ «Abrir WhatsApp» ──► tu app ──► el complejo
                              │
       (coexistencia: la app y la API comparten el número)
                              │
Complejo responde ──► Meta ──► /api/whatsapp ──► bot:
   1. ¿Está en la base? Si no, lo ignora (tus otros chats quedan intactos).
   2. ¿Pidió no ser contactado? Cierra con amabilidad y lo marca para siempre.
   3. ¿Audio o imagen? Avisa que lo sigue una persona y te deriva.
   4. ¿Escribiste vos hace poco? Se calla 12 horas.
   5. Si no, Claude decide la respuesta (salida estructurada y validada), la envía,
      actualiza el estado y lo que aprendió del complejo, y deriva si hace falta.
```

Cuando el bot deriva, la conversación aparece arriba en **Hoy → Te necesitan** y, si configurás Resend, te llega un email.

## Puesta en marcha

Hacelo en este orden: Supabase, Google Maps, Claude, Vercel y, al final, WhatsApp (la conexión con Meta necesita el panel ya publicado).

### 1. Base de datos (Supabase)

Creá un proyecto nuevo (el plan gratis alcanza) y ejecutá en el SQL Editor, **en este orden**:

1. `supabase/migrations/20261014000001_prospector.sql` (tablas base).
2. `supabase/migrations/20261107000001_modo_cancha.sql` (deportes, sistema actual, Instagram, place_id de Google, búsquedas).
3. `supabase/seed-canchas.sql`: 455 complejos de fútbol, pádel y deportivos de 21 provincias, con su `place_id` de Google Maps. Se puede correr más de una vez: no duplica.

El paso 3 también se puede hacer desde el panel: con la base vacía, **Hoy** muestra el botón «Cargar los complejos».

### 2. Google Maps (para «Buscar complejos»)

1. En [Google Cloud Console](https://console.cloud.google.com/), creá un proyecto y activá la facturación.
2. En «APIs y servicios → Biblioteca», habilitá **Places API (New)**.
3. En «APIs y servicios → Credenciales», creá una clave de API y **restringila a Places API (New)**.
4. Cargala como `GOOGLE_MAPS_API_KEY` (solo servidor: nunca con `NEXT_PUBLIC_`).

Cada búsqueda hace 1 llamada para ubicar la zona y, por cada deporte, de 1 a 3 llamadas (20 resultados por página, hasta 60). Una búsqueda con los 4 deportes hace entre 5 y 13 llamadas; la pantalla muestra cuántas hizo cada una. Como se piden teléfono, web y calificación, Google las cobra como Text Search de nivel alto, con un cupo gratis por mes: revisá los precios vigentes en la consola y poné un límite de presupuesto o de cuota diaria para no llevarte sorpresas.

### 3. Claude

Creá una API key en console.anthropic.com y cargala en `ANTHROPIC_API_KEY`. El modelo por defecto es `claude-sonnet-5-5`; con `claude-haiku-5-5` sale más barato.

### 4. Publicar (Vercel)

1. Subí el proyecto a GitHub e importalo en Vercel.
2. Cargá las variables de `.env.example`. Generá las tuyas con:
   ```bash
   openssl rand -hex 24   # SESION_SECRETO
   openssl rand -hex 12   # WHATSAPP_VERIFY_TOKEN
   ```
3. Entrá al panel con `ADMIN_CLAVE`.

### 5. Tu número en la API sin perder la app (coexistencia)

La **coexistencia** de WhatsApp permite usar el mismo número en la app de WhatsApp Business del celular y en la Cloud API. Así seguís escribiendo desde el teléfono y el bot recibe las respuestas. Al activarla, **las listas de difusión de la app dejan de funcionar** y conviene usar el celular al menos cada dos semanas.

#### Opción A (gratis): con tu propia app de Meta

El panel trae la pantalla **Conectar WhatsApp** para hacerlo.

1. **Crear la app.** En [developers.facebook.com](https://developers.facebook.com/apps), creá una app con el caso de uso de WhatsApp, vinculada a tu portfolio de Meta Business.
2. **Webhook.** En WhatsApp → Configuración:
   - URL: `https://<tu-dominio>/api/whatsapp`
   - Token de verificación: el valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscribí los campos **messages** y **smb_message_echoes**.
3. **Asistente de conexión.** En Facebook Login para empresas → Configuraciones, creá una configuración con la plantilla de *WhatsApp Embedded Signup*. Copiá su ID en `META_CONFIG_ID` y agregá el dominio del panel a «Dominios permitidos para el SDK de JavaScript».
4. **Credenciales.** En Configuración → Básica, copiá el *ID de la app* en `META_APP_ID` y la *clave secreta* en `WHATSAPP_APP_SECRET`.
5. **Conectar.** Entrá a **Conectar WhatsApp** y seguí el asistente. Al final la pantalla te muestra `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` para cargar en las variables.
6. **Token que no vence (recomendado).** En Meta Business → Configuración → Usuarios del sistema, creá un usuario administrador, asignale la app y la cuenta de WhatsApp y generá un token con `whatsapp_business_messaging` y `whatsapp_business_management`, con caducidad «Nunca». Usalo como `WHATSAPP_TOKEN`.

Si Meta no te deja usar la coexistencia con tu app, puede pedirte ser *Tech Provider* (verificar el negocio y pasar la revisión de la app). No se paga, pero lleva tiempo.

#### Opción B (paga, más rápida): un proveedor

360dialog y otros proveedores hacen la conexión por vos:

```
WHATSAPP_API_URL=https://waba-v2.360dialog.io/messages
WHATSAPP_AUTH_HEADER=D360-API-KEY
WHATSAPP_TOKEN=<tu API key>
```

En este caso dejá `WHATSAPP_APP_SECRET` vacío y registrá el webhook según su documentación.

#### Sin conectar WhatsApp

Funciona igual en modo manual: después de enviar cada mensaje tocás «Marcar como enviado», y cuando te responden contestás desde el celular y cambiás el estado en la ficha del complejo.

### 6. Antes de la primera tanda

1. Mandate un mensaje a vos mismo desde otro teléfono: tu número no está en la base, así que el bot **no** debe responder.
2. Agregá a mano un complejo de prueba con el número de un amigo, armá una tanda con la zona de su ciudad, mandale el mensaje y que te conteste. Revisá cómo responde el bot.
3. Revisá `src/lib/bot/conocimiento.ts`: lo que sabe el bot de Modo Cancha y **los precios de `PRECIOS_PLANES`** (marcados «Revisar antes de publicar»).

## Uso diario

1. **Buscar complejos.** Escribí una ciudad o zona («San Nicolás de los Arroyos»), el radio y los deportes. Aparecen dos listas: **Nuevos** (marcados) y **Ya en la base** (con su estado). Lo que parece no ser un complejo de alquiler (clubes con socios, escuelas, tiendas, cerrados o fuera del radio) aparece tachado y sin marcar: marcalo si es un error.
   - **Agregar y armar tanda con estos**: los carga y te deja la tanda de hoy lista con esos complejos y sus mensajes. Es el «un clic».
   - **Agregar los N seleccionados**: solo los carga.
   - Abajo quedan las últimas 10 búsquedas, para saber qué zonas ya barriste.
2. **Hoy → Armar tanda de hoy.** Elegí la zona (toda la base, una provincia o una ciudad). Salen primero los que figuran como celular, después por prioridad y reseñas, como mucho `TANDA_MAX_POR_CIUDAD` por ciudad. Revisá los mensajes, editá si querés y mandalos espaciados durante el día.
   - Si WhatsApp te dice que el número no existe, tocá **«No tiene WhatsApp»**: sale y entra otro de la misma provincia.
   - **Otros medios** te da el guion para llamar, la búsqueda de Instagram y el mensaje para copiar.
   - **Copiar lista** copia nombre, teléfono y mensaje de todos, por si los mandás desde otro celular.
3. **Te necesitan:** respondé esas conversaciones desde el panel o desde el celular. Al escribir vos, el bot se corre 12 horas.
4. **Seguimientos:** a los 3 días sin respuesta, un único recordatorio con el link de la prueba gratis.
5. **Complejos:** filtrá por provincia, ciudad, deporte, estado y sistema actual, o buscá por nombre. En la ficha cargás lo que vas sabiendo (deportes, cantidad de canchas, sistema actual, Instagram): Claude lo usa para el mensaje. Si usan ATC o Clubo, el mensaje no critica a la competencia: pregunta cómo les va y menciona el precio fijo y que la seña va directo a su Mercado Pago.
6. **Importar planilla:** subí un `.csv` o `.xlsx` con columnas nombre, ciudad, provincia, dirección, teléfono, instagram, sistema actual y notas. Ves la vista previa y confirmás; al final te dice cuántos eran nuevos, cuántos ya estaban y cuántos no tenían teléfono.

## Reglas para cuidar el número

- Arrancá con **10 por día** (`TANDA_LIMITE=10`). Si casi nadie te bloquea durante una o dos semanas, subí de a poco.
- Mandá en horario comercial, de lunes a viernes, y espaciados: no los 10 de golpe.
- Si varios te bloquean o te contestan mal, pará y cambiá el mensaje.
- Un solo seguimiento, nunca más. «No» es no: los pedidos de baja se marcan solos y para siempre.
- No uses otra herramienta para mandar mensajes masivos desde este número.

## Comandos

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run check      # tipos + tests (bot, tanda, mensajes, Google Places con respuestas de ejemplo, importación) + test de base de datos
```

## Límites conocidos

- Si un complejo manda varios mensajes seguidos muy rápido, el bot puede contestar a más de uno. El límite de respuestas (`BOT_MAX_RESPUESTAS`) lo acota.
- No transcribe audios: los deriva a vos.
- Google Maps no dice si un número tiene WhatsApp: «Celular» es una estimación por cómo figura el número.
- El filtro de «no es complejo» mira tipos y palabras del nombre: puede equivocarse, por eso lo descartado se muestra tachado en vez de ocultarse.
