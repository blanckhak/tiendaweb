# AURUM — Tienda de perfumes que vende por WhatsApp

Tienda online (catálogo, bolsa, checkout) + panel admin + bot de WhatsApp con IA + automatizaciones.
Toda venta se cierra por WhatsApp: el checkout crea el pedido, reserva el stock 24 h y abre el chat con el código.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Postgres (PGlite en local, Supabase en producción) · WhatsApp Cloud API · API de Claude.

## Probar en tu computadora

```bash
npm install
npm run dev
```

- Tienda: http://localhost:3000
- Panel: http://localhost:3000/admin — entra con `ADMIN_EMAIL` y `ADMIN_PASSWORD`; en desarrollo la contraseña es `admin123` si no defines `ADMIN_PASSWORD`.
- `npm run dev` levanta primero una base Postgres local (PGlite en `.data/pglite`, puerto 54329) y luego la tienda.
  Para usar la base de Supabase de `.env.local` en desarrollo, corre `npm run dev:next`.
- Sin configurar nada: la base empieza con 10 perfumes de ejemplo, WhatsApp funciona en
  **modo simulado** (los mensajes se ven en el panel pero no salen) y el bot responde con un menú básico.
- Para probar el bot sin Meta: **Panel → Simulador de WhatsApp**. Escribe el código de un pedido (`AUR-1001`) o adjunta una imagen como comprobante.
- Los mensajes programados se procesan cada minuto mientras corre `npm run dev`.

Pruebas automáticas: `npm test` (pedidos, stock, comprobantes, automatizaciones, firma del webhook, test de perfumes).

## Cómo funciona una venta

1. El cliente arma su bolsa y confirma en `/checkout` → se crea `AUR-1001`, se **reservan** las unidades por 24 h.
2. Se abre WhatsApp con el resumen → el bot responde con el total y los datos de Yape/Plin.
3. Tú fijas el costo de envío en el panel. El cliente manda la **captura del comprobante** → el pedido pasa a *Pago en revisión*.
4. Revisas el comprobante en tu app de Yape/Plin y lo apruebas en el panel → baja el stock y el cliente recibe la confirmación.
5. Despachas (agencia + guía) → aviso al cliente. Marcas entregado → a los 3 días se pide reseña y a los 60 días recordatorio de recompra (solo si aceptó promociones).
6. Si no paga: recordatorio a las 2 h, último aviso a las 22 h y a las 24 h el pedido vence y el stock se libera.

Todo lo automático se edita en **Panel → Automatizaciones** (textos, tiempos, activar/pausar).

## Cuentas de clientes (sin contraseña)

- El cliente entra en `/cuenta/ingresar` → toca **Entrar con WhatsApp** → envía el mensaje `ACCESO XXXXXX` que se abre solo → la página entra sola.
  Así se verifica que el número es suyo sin SMS, sin contraseñas y sin plantillas pagadas (el cliente escribe primero).
- En **Mi cuenta** ve sus pedidos (estado y guía), sus cotizaciones y guarda sus datos; el checkout se completa solo.
- Probar sin Meta: pide el código en la web y envíalo desde **Panel → Simulador** con el mismo teléfono.

### Confirmar un pedido exige cuenta

Al llegar al checkout sin sesión, el cliente ve **Entrar con WhatsApp** y **Continuar con Google** (si está configurado).
La bolsa no se pierde. El pedido se registra siempre con el WhatsApp verificado de la cuenta.

### Ingreso con Google (opcional)

1. https://console.cloud.google.com → crea un proyecto → *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre de la tienda, tu correo.
2. *Credenciales → Crear credenciales → ID de cliente de OAuth* → tipo **Aplicación web**.
3. *URI de redireccionamiento autorizados*: `http://localhost:3000/api/auth/google/callback` (pruebas) y `https://TU-DOMINIO/api/auth/google/callback` (producción).
4. Copia el *ID de cliente* en `GOOGLE_CLIENT_ID` y el *Secreto* en `GOOGLE_CLIENT_SECRET`, y reinicia la tienda.

Google no comparte el número de celular: quien entra con Google **vincula su WhatsApp una sola vez** (mismo código `ACCESO`).
Si ese WhatsApp ya tenía pedidos, las dos cuentas se unen en una. Nunca se unen cuentas solo por el correo.

## Cotizaciones por cantidad (por WhatsApp)

1. El cliente (con cuenta) arma su bolsa y entra a `/cotizar`: ajusta cantidades y deja una nota → se crea `COT-1001` y abre WhatsApp.
2. Te llega el aviso. En **Panel → Cotizaciones** pones el precio por perfume, descuento, envío y días de validez → **Enviar por WhatsApp**.
3. El cliente recibe el mensaje con el link, revisa y **acepta** (elige entrega y pago) → se crea el pedido con esos precios y sigue el flujo normal de pago.
4. Si vence (por defecto 7 días) o la rechaza, ya no se puede aceptar.

## Más funciones de la tienda

- **Número de WhatsApp de pedidos** (**Panel → Ajustes**): el carrito, el botón verde y los avisos abren el chat con este número (`https://wa.me/<número>?text=<pedido>`). Si no lo cambias, se usa `NEXT_PUBLIC_WHATSAPP_NUMBER`. El código `ACCESO` para entrar a la cuenta siempre va al número de `.env`, que es el conectado a Meta.
  Si usas la API de WhatsApp, pon aquí ese mismo número: el bot solo lee los mensajes del número conectado.
- **Mensaje del pedido**: nombre, perfumes, cantidades, precio de oferta con el normal tachado (`~S/ 159~`), ahorro, envío y **total a pagar**.
- **Asesor de perfumes con IA** (botón abajo a la izquierda): recomienda por notas, ocasión y presupuesto con precios y stock reales del catálogo, y responde dudas de envíos y pagos. Las tarjetas sugeridas se agregan a la bolsa desde el chat.
  Usa la misma `ANTHROPIC_API_KEY` y `BOT_MODEL` que el bot; sin clave responde con una búsqueda simple por palabras. Máximo 20 preguntas por IP y hora. Se oculta desde **Panel → Ajustes**.
- **Ofertas**: los perfumes con "precio antes" muestran su % de descuento, aparecen en la banda de ofertas del inicio y en `/perfumes?ofertas=1`. El catálogo filtra también por rango de precio.
- **Envío gratis**: desde `NEXT_PUBLIC_FREE_SHIPPING_FROM` (S/ 199 por defecto) a domicilio en `NEXT_PUBLIC_FREE_SHIPPING_ZONES` (Lima, Callao). La bolsa muestra cuánto falta y el pedido se registra con envío S/ 0. Pon `0` para desactivarlo.
- **Seguimiento sin cuenta** (`/seguimiento`): código del pedido + 4 últimos dígitos del WhatsApp. Nunca muestra nombre ni teléfono.
- **Reseñas**: solo de pedidos entregados (una por perfume). El mensaje automático "pedir reseña" lleva a `/cuenta/calificar/AUR-xxxx`. Se publican al aprobarlas en **Panel → Reseñas**; las estrellas aparecen en las tarjetas y en la ficha.
- **Imagen al compartir**: cada perfume genera su tarjeta (frasco o foto, nombre, precio, estrellas) para WhatsApp y Facebook. Requiere `NEXT_PUBLIC_SITE_URL` con tu dominio real.
- **Libro de Reclamaciones virtual** (`/libro-de-reclamaciones`, enlazado en el pie de página): hoja numerada `0001-2026`, plazo de 15 días hábiles, constancia imprimible y aviso por WhatsApp al dueño. Se responde en **Panel → Libro de Reclamaciones**.
  - Completa `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_RUC` y `NEXT_PUBLIC_BUSINESS_ADDRESS`.
  - Configura `RESEND_API_KEY` y `EMAIL_FROM` para que la constancia y la respuesta lleguen al correo del consumidor.
  - Los feriados no se descuentan del plazo: responde con margen. Revisa los requisitos vigentes con INDECOPI (aviso visible, conservación de hojas) antes de lanzar.

## Pasar a producción

### 1. Supabase (base de datos y archivos)
1. Crea un proyecto en https://supabase.com.
2. *Project Settings → Database → Connection pooling* (modo **Transaction**): copia la URL en `DATABASE_URL`.
3. *Storage*: crea dos buckets: `public` (marcado como público, para fotos) y `private` (privado, para comprobantes).
4. *Project Settings → API*: copia `URL` en `SUPABASE_URL` y la `service_role key` en `SUPABASE_SERVICE_ROLE_KEY` (es secreta: nunca en el navegador).
5. Las tablas se crean solas la primera vez que arranca la app (`db/schema.sql`). También puedes pegar ese archivo en el SQL Editor.

### 2. Vercel (hosting)
1. Sube el proyecto a GitHub e impórtalo en https://vercel.com.
2. Carga todas las variables de `.env.example` (con `NEXT_PUBLIC_SITE_URL` = tu dominio).
3. `vercel.json` programa el cron de automatizaciones una vez al día (9:00 de Perú), porque **el plan gratuito (Hobby) solo permite crons diarios** y rechaza el despliegue si son más seguidos. Para correrlas cada 10 minutos usa el plan Pro (y cambia `schedule` a `*/10 * * * *`) o un cron externo gratuito (p. ej. cron-job.org) que llame a `https://TU-DOMINIO/api/cron/automatizaciones` con el header `Authorization: Bearer <CRON_SECRET>`.

> En Vercel no se puede usar la base local (`.data/`): el disco se borra. `DATABASE_URL` es obligatoria.

### 3. WhatsApp Cloud API (Meta)
1. Crea una cuenta en https://business.facebook.com y **verifica el negocio** (puede tardar días: hazlo primero).
2. En https://developers.facebook.com crea una app tipo *Business* y agrega el producto **WhatsApp**.
3. Agrega tu número del negocio (uno dedicado, que no tengas en la app de WhatsApp del celular) y copia el *Phone number ID* → `WHATSAPP_PHONE_NUMBER_ID`.
4. Crea un **usuario del sistema** con token permanente (permisos `whatsapp_business_messaging`, `whatsapp_business_management`) → `WHATSAPP_TOKEN`.
5. *App settings → Basic*: copia el **App Secret** → `WHATSAPP_APP_SECRET`.
6. *WhatsApp → Configuration → Webhook*: URL `https://TU-DOMINIO/api/whatsapp`, *Verify token* = el valor de `WHATSAPP_VERIFY_TOKEN`. Suscríbete al campo **messages**.
7. **Plantillas:** WhatsApp solo entrega texto libre si el cliente escribió en las últimas 24 h. Para recordatorios fuera de esa ventana crea plantillas en *WhatsApp Manager → Plantillas* (categoría *Utility* para pedidos, *Marketing* para reseña/recompra) con 3 variables `{{1}}` nombre, `{{2}}` código, `{{3}}` perfume, y escribe su nombre en **Panel → Automatizaciones**. Sin plantilla, esos mensajes quedan como *omitido* en el registro.
8. `OWNER_WHATSAPP`: tu número personal para avisos. Escríbele al número del negocio al menos una vez al día para que la ventana de 24 h esté abierta (o crea una plantilla para avisos).

### 4. Bot con IA (Claude)
1. Crea una API key en https://console.anthropic.com → `ANTHROPIC_API_KEY`.
2. El bot usa `claude-opus-5-5` con esfuerzo bajo (respuestas cortas y rápidas) y respaldo automático del servidor si el modelo declina una respuesta. Cambia el modelo con `BOT_MODEL` o desactiva la IA con `BOT_AI=off`.
3. El bot solo da precios y stock que lee del catálogo, nunca confirma pagos y deriva a una persona cuando hay reclamos o lo piden. Tope: 30 respuestas por cliente por hora.

## Seguridad

- Panel protegido con correo (`ADMIN_EMAIL`, opcional) y contraseña (`ADMIN_PASSWORD`) y cookie firmada (`SESSION_SECRET`); cada página y acción vuelve a verificar la sesión.
- Webhook: se verifica la firma `X-Hub-Signature-256` de Meta; en producción sin secreto se rechaza todo.
- Precios y stock siempre salen de la base de datos (el navegador solo envía ids y cantidades). Máximo 3 pedidos sin pagar por número.
- Comprobantes en almacenamiento privado, visibles solo con sesión de admin. Fotos de productos ≤ 4 MB.
- Pendiente recomendado antes de mucho tráfico: limitar intentos de login y del checkout por IP (Vercel Firewall).

## Estructura

```
db/schema.sql              tablas (Postgres)
src/app/(tienda)/          tienda pública
src/app/admin/             panel (login, pedidos, productos, chats, automatizaciones, simulador, ajustes)
src/app/api/whatsapp/      webhook de Meta
src/app/api/cron/          procesa mensajes programados
src/server/                lógica del servidor: db, pedidos, bot, asesor web (assistant.ts), ajustes, WhatsApp, archivos
src/lib/                   utilidades compartidas con el navegador
tests/                     pruebas (vitest + PGlite en memoria)
```
