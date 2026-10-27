# Prospector

Bot de prospección por WhatsApp para **Cauce**: ofrece a cada negocio la automatización que le sirve a su rubro.

| Servicio | Rubros | Qué se le ofrece en el primer mensaje |
|---|---|---|
| Cuotas al día | Gimnasios, pilates, funcional, danza, artes marciales, academias | Avisos de cuota por WhatsApp con link de Mercado Pago |
| Turnos por WhatsApp | Peluquerías, barberías, estética, odontología, kinesiología, veterinarias | Asistente que contesta, agenda en el calendario y recuerda el turno |
| Documentos y avisos | Estudios jurídicos y contables, escribanías | Buscador con la cita exacta (documento y página) y avisos de vencimientos |
| Automatización a medida | Inmobiliarias, talleres y otros | Respuestas automáticas, avisos («ya está listo», vencimientos) y reportes |

**Modo Cancha va en su pestaña:** los complejos de canchas (fútbol, pádel, deportivos) tienen su propia tanda en `/modo-cancha`, con mensajes que se presentan como Modo Cancha, su propio límite diario (`TANDA_LIMITE_CANCHAS`) y un bot que solo habla de reservas y de la prueba gratis. La tanda de Hoy nunca los mezcla. El servicio de cada prospecto sale de su rubro (`src/lib/dominio/lineas.ts`).

- **Vos mandás el primer mensaje**, en tandas diarias que arma el panel: ~15 prospectos por día, cada uno con un mensaje distinto escrito por Claude. Tocás «Abrir WhatsApp» y «Enviar». Son unos 5 minutos.
- **El bot contesta solo** cuando el negocio responde: pregunta cómo cobran, explica el producto, ofrece la prueba gratis y **te pasa la conversación** cuando hay interés real, mandan un audio o algo se complica.
- **Respeta el "no":** si alguien pide que no le escriban, se marca y no se le escribe nunca más.

## Por qué el primer mensaje no es automático

Las reglas de WhatsApp Business exigen que la persona haya aceptado recibir mensajes antes de que una empresa le escriba por la API. Si un bot le manda mensajes en automático a números sacados de Google Maps (aunque sea de a tandas), viola esas reglas, y unos pocos bloqueos o denuncias alcanzan para que Meta limite o dé de baja el número. Es el mismo número que vas a usar con tus clientes.

Este diseño evita ese riesgo:

| Paso | Quién | Por dónde | Por qué es seguro |
|---|---|---|---|
| Primer mensaje y un único seguimiento | Vos, con un toque | Tu app de WhatsApp Business | Lo mandás vos, personalizado, de a pocos por día |
| Respuestas | El bot | Cloud API | Solo contesta dentro de las 24 h desde que el negocio te escribió, que es lo que la API permite |
| Casos difíciles | Vos | App o panel | El bot se corre solo |

## Cómo funciona por dentro

```
Panel (Hoy) ── arma la tanda ──► Claude redacta cada mensaje
     │
     └─ «Abrir WhatsApp» ──► tu app ──► el negocio
                                │
         (coexistencia: la app y la API comparten el número)
                                │
Negocio responde ──► Meta ──► /api/whatsapp ──► bot:
   1. ¿Es prospecto de la campaña? Si no, lo ignora (tus otros chats quedan intactos).
   2. ¿Pidió no ser contactado? Cierra con amabilidad y lo marca.
   3. ¿Audio o imagen? Avisa que lo sigue Eugenio y te deriva.
   4. ¿Escribiste vos hace poco? Se calla 12 horas.
   5. Si no, Claude decide la respuesta (con salida estructurada), la envía,
      actualiza el estado y lo que aprendió del negocio, y deriva si hace falta.
```

Cuando el bot deriva, la conversación aparece arriba en **Hoy → Te necesitan** y, si configurás Resend, te llega un email.

## Puesta en marcha

### 1. Base de datos (Supabase)

Creá un proyecto nuevo (el plan gratis alcanza) y ejecutá en el SQL Editor, en orden:

1. `supabase/migrations/20261014000001_prospector.sql`
2. `supabase/seed.sql`, con los 145 prospectos de Cuotas al día (135 tienen WhatsApp).
3. `supabase/seed-cauce.sql`, con 524 prospectos de los otros servicios (peluquerías, estudios, inmobiliarias, etc.), todos con WhatsApp. Si ya tenés la base andando, ejecutá solo este archivo: no toca lo que ya contactaste.
4. `supabase/seed-canchas.sql`, con 455 complejos de canchas de 21 provincias para Modo Cancha (67 figuran como celular; el resto puede ser fijo, por eso esa tanda sí los prueba y se descartan con «No tiene WhatsApp»). Se puede correr aparte y más de una vez.

### 2. Tu número en la API sin perder la app (coexistencia)

La **coexistencia** de WhatsApp permite usar el mismo número en la app de WhatsApp Business del celular y en la Cloud API. Así seguís escribiendo desde el teléfono y el bot recibe las respuestas. Al activarla, **las listas de difusión de la app dejan de funcionar** (no las vas a necesitar) y conviene usar el celular al menos cada dos semanas.

#### Opción A (gratis): con tu propia app de Meta

Es lo mismo que hacen los proveedores pagos, sin intermediario. El panel trae la pantalla **Conectar WhatsApp** para hacerlo.

1. **Crear la app.** En [developers.facebook.com](https://developers.facebook.com/apps), creá una app con el caso de uso de WhatsApp, vinculada a tu portfolio de Meta Business (si no tenés uno, se crea ahí mismo).
2. **Webhook.** En WhatsApp → Configuración:
   - URL: `https://<tu-dominio>/api/whatsapp`
   - Token de verificación: el valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscribí los campos **messages** y **smb_message_echoes**.
3. **Asistente de conexión.** En Facebook Login para empresas → Configuraciones, creá una configuración con la plantilla de *WhatsApp Embedded Signup*. Copiá su ID en `META_CONFIG_ID`. En la configuración del login, agregá el dominio del panel a «Dominios permitidos para el SDK de JavaScript».
4. **Credenciales.** En Configuración → Básica, copiá el *ID de la app* en `META_APP_ID` y la *clave secreta* en `WHATSAPP_APP_SECRET`.
5. **Conectar.** Publicá el panel, entrá a **Conectar WhatsApp** y seguí el asistente: elegís conectar tu app existente, aceptás en el celular y escaneás un QR. Al final la pantalla te muestra `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` para cargar en las variables.
6. **Token que no vence (recomendado).** En Meta Business → Configuración → Usuarios del sistema, creá un usuario administrador y asignale la app y la cuenta de WhatsApp. Generá un token con `whatsapp_business_messaging` y `whatsapp_business_management`, con caducidad «Nunca», y usalo como `WHATSAPP_TOKEN`.

**Si Meta no te deja usar la coexistencia:** Meta la ofrece oficialmente para proveedores tecnológicos (*Tech Providers*). Como sos administrador de tu propia app, el asistente puede funcionar con tu número sin más trámites, pero no lo pude confirmar. Si te frena, hacete Tech Provider. Meta no cobra por eso, aunque lleva tiempo:
- verificar tu negocio (con tu CUIT y documentación),
- pasar la revisión de la app con dos videos cortos (uno enviando un mensaje y otro creando una plantilla).

Ese trámite además te habilita a ofrecerles WhatsApp automático a los gimnasios de Cuotas al día.

#### Opción B (paga, más rápida): un proveedor

360dialog y otros proveedores hacen la conexión por vos. El proyecto ya soporta 360dialog con estas variables:

```
WHATSAPP_API_URL=https://waba-v2.360dialog.io/messages
WHATSAPP_AUTH_HEADER=D360-API-KEY
WHATSAPP_TOKEN=<tu API key>
```

En este caso dejá `WHATSAPP_APP_SECRET` vacío y registrá el webhook según su documentación.

#### Sin coexistencia

Funciona igual, con una diferencia: después de enviar cada mensaje tenés que tocar «Marcar como enviado» en el panel, porque el sistema no se entera solo.

#### Cuánto cuesta

| Qué | Costo |
|---|---|
| Respuestas del bot por WhatsApp (dentro de las 24 h) | Gratis: Meta no cobra los mensajes de texto dentro de esa ventana |
| Tus mensajes desde la app del celular | Gratis |
| Supabase | Gratis en el plan inicial |
| Claude | Unos centavos de dólar por respuesta. Con `ANTHROPIC_MODEL=claude-haiku-5-5` sale todavía menos |
| Hosting | El plan gratis de Vercel es para uso personal no comercial: revisá sus condiciones o usá otro hosting |

El bot nunca manda plantillas pagas, porque nunca inicia conversaciones.

### 3. Claude

Creá una API key en console.anthropic.com y cargala en `ANTHROPIC_API_KEY`. El modelo por defecto es `claude-sonnet-5-5`. Cada respuesta del bot es una llamada corta.

### 4. Publicar (Vercel)

1. Subí el proyecto a GitHub e importalo en Vercel.
2. Cargá las variables de `.env.example`. Generá las tuyas con:
   ```bash
   openssl rand -hex 24   # SESION_SECRETO
   openssl rand -hex 12   # WHATSAPP_VERIFY_TOKEN
   ```
3. Entrá al panel con `ADMIN_CLAVE`.

### 5. Antes de la primera tanda

1. Mandate un mensaje a vos mismo desde otro teléfono: tu número no está en la base, así que el bot **no** debe responder.
2. Cargá en la base un prospecto de prueba con el número de un amigo, armá una tanda, mandale el mensaje y que te conteste. Revisá cómo responde el bot.
3. Ajustá lo que el bot sabe en `src/lib/bot/conocimiento.ts`: lo general de Cauce, cada servicio y las reglas de conversación. Solo Cuotas al día tiene precios; para el resto el bot ofrece una charla de 15 minutos y nunca da números.

## Uso diario

1. **Hoy → Armar tanda de hoy.** La tanda mezcla servicios (como mucho `TANDA_MAX_POR_LINEA` de cada uno) y cada mensaje habla de lo que le sirve a ese rubro. Revisá los mensajes, editá si querés, y mandalos espaciados durante el día. No los 15 de golpe.
   Los números que en Google Maps figuran como fijos (sin el 9 y empezando con 4) no entran en las tandas, y los que figuran como celular van primero: en la tarjeta se ve «Celular» o «WhatsApp sin confirmar». Si al tocar «Abrir WhatsApp» la app te dice que el número no está en WhatsApp, tocá **«No tiene WhatsApp»**: lo saca para siempre y suma otro en su lugar.
2. **Prospectos:** filtrá por servicio para ver cuántos respondieron sobre cuántos contactaste en cada uno, y así saber qué rubro conviene empujar.
3. **Te necesitan:** respondé esas conversaciones desde el panel o desde el celular. Al escribir vos, el bot se corre 12 horas.
4. **Seguimientos:** a los 3 días sin respuesta, un único recordatorio.

## Reglas para cuidar el número

- Arrancá con **10 por día** la primera semana (`TANDA_LIMITE=10`). Si casi nadie te bloquea, subí a 15.
- Mandá en horario comercial, de lunes a viernes.
- Si varios te bloquean o te contestan mal, pará y cambiá el mensaje.
- Nunca más de un seguimiento. «No» es no.

## Comandos

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run check      # tipos + 57 tests (bot y servicios por rubro) + test de base de datos
```

## Límites conocidos

- Si un negocio manda varios mensajes seguidos muy rápido, el bot puede contestar a más de uno. Es raro, y el límite de respuestas (`BOT_MAX_RESPUESTAS`) lo acota.
- El formato del webhook de ecos (`smb_message_echoes`) es el que Meta documenta para coexistencia. Si tu proveedor lo cambia, ajustá `src/lib/whatsapp/webhook.ts` y su test.
- No transcribe audios: los deriva a vos.
