# Baja de correos: `/email-unsubscribe`

Los correos de campañas llevan `${UNSUBSCRIBE_BASE_URL}/email-unsubscribe?t=<token>`. Esta ruta la sirve
`functions/email-unsubscribe.js`, un proxy estricto hacia la edge function `email-unsubscribe` de Supabase.
Existe porque Supabase fuerza `Content-Type: text/plain` a las respuestas HTML de las Edge Functions
(el navegador descargaba un `.txt`); el proxy devuelve el HTML con `text/html`.

- Solo GET y POST (otros métodos: 405). Solo se reenvía el parámetro `t` y el `Content-Type` del POST (cuerpo hasta 4 KB).
- Timeout de 8 s al backend; si falla, 502 con página mínima. Sin `SUPABASE_FUNCTIONS_URL`, 503.
- GET no da de baja: muestra el botón «Confirmar»; la baja ocurre en POST (también el one-click RFC 8058).

## Variable por entorno (Cloudflare Pages)

`SUPABASE_FUNCTIONS_URL` (Settings > Environment variables, por proyecto Pages):

| Entorno | Proyecto Pages | Valor |
|---|---|---|
| Dev | `yoinit-web-cloudflare-pages-dev` (`dev.yoinit.app`) | `https://thytsxqeqmeaifrzqqpy.supabase.co/functions/v1` |
| Prod | `yoinit-web-cloudflare` (`yoinit.app`) | `https://djpgmmibdcgklseiqxpj.supabase.co/functions/v1` |

En Supabase, el secret `UNSUBSCRIBE_BASE_URL` es `https://dev.yoinit.app` (dev) y `https://yoinit.app` (prod).

Prueba local: `wrangler pages dev . --binding SUPABASE_FUNCTIONS_URL=<url de un servidor simulado>`.
