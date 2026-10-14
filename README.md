# Prospector

Bot de prospección por WhatsApp para **Cuotas al día**.

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
2. `supabase/seed.sql`, con los 145 prospectos (135 tienen WhatsApp).

### 2. Tu número en la API sin perder la app (coexistencia)

La **coexistencia** de WhatsApp permite usar el mismo número en la app de WhatsApp Business del celular y en la Cloud API. Así seguís escribiendo desde el teléfono y el bot recibe las respuestas.

Se activa con el *Embedded Signup* de un proveedor de WhatsApp (BSP) que la ofrezca. Opción recomendada para arrancar: **360dialog**, porque su API es compatible con la de Meta y este proyecto ya la soporta. Hay otros proveedores con coexistencia (YCloud, Chakra, etc.); antes de elegir, compará precios en sus sitios.

Al conectar el número con coexistencia:
- Se sincronizan los chats de los últimos 6 meses.
- **Las listas de difusión dejan de funcionar** en la app (no las vas a necesitar).
- Los mensajes que mandás desde la app llegan al webhook como «ecos». Con eso el panel marca solo a quién ya contactaste.

**Con 360dialog:**
1. Conectá el número con su flujo de coexistencia y creá una API key.
2. Variables:
   ```
   WHATSAPP_API_URL=https://waba-v2.360dialog.io/messages
   WHATSAPP_AUTH_HEADER=D360-API-KEY
   WHATSAPP_TOKEN=<tu API key de 360dialog>
   ```
3. Registrá el webhook apuntando a `https://<tu-dominio>/api/whatsapp`, según su documentación. 360dialog no firma como Meta, así que dejá `WHATSAPP_APP_SECRET` vacío.

**Directo con Meta** (si sos o te hacés *Tech Provider*, algo que te va a servir también para ofrecer WhatsApp automático a los gimnasios de Cuotas al día):
1. En developers.facebook.com, creá una app con el producto WhatsApp y hacé el onboarding del número con coexistencia.
2. En Webhook, poné la URL `https://<tu-dominio>/api/whatsapp` y como token de verificación el mismo valor de `WHATSAPP_VERIFY_TOKEN`. Suscribí los campos **messages** y **smb_message_echoes**.
3. Variables: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` (token permanente de un usuario del sistema) y `WHATSAPP_APP_SECRET` (App Secret, para validar la firma de cada aviso).

**Sin coexistencia** funciona igual, con una diferencia: después de enviar cada mensaje tenés que tocar «Marcar como enviado» en el panel, porque el sistema no se entera solo.

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
3. Ajustá lo que el bot sabe en `src/lib/bot/conocimiento.ts`. Ahí están la información del producto y las reglas de conversación.

## Uso diario

1. **Hoy → Armar tanda de hoy.** Revisá los mensajes, editá si querés, y mandalos espaciados durante el día. No los 15 de golpe.
2. **Te necesitan:** respondé esas conversaciones desde el panel o desde el celular. Al escribir vos, el bot se corre 12 horas.
3. **Seguimientos:** a los 3 días sin respuesta, un único recordatorio.

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
npm run check      # tipos + 39 tests del bot + test de base de datos
```

## Límites conocidos

- Si un negocio manda varios mensajes seguidos muy rápido, el bot puede contestar a más de uno. Es raro, y el límite de respuestas (`BOT_MAX_RESPUESTAS`) lo acota.
- El formato del webhook de ecos (`smb_message_echoes`) es el que Meta documenta para coexistencia. Si tu proveedor lo cambia, ajustá `src/lib/whatsapp/webhook.ts` y su test.
- No transcribe audios: los deriva a vos.
