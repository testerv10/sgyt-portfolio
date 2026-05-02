# SGYT Portfolio — Astro Edition

Built with Astro + Cloudflare Pages adapter. Zero framework lock-in, deploys perfectly on Cloudflare Pages with Wrangler v2 or v3.

## Deploy

```bash
npm install
npm run build
wrangler pages publish dist --project-name=sgyt-portfolio
```

## Cloudflare Pages Settings

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Deploy command**: *(leave empty or `echo done`)*

## D1 Database Binding

In Cloudflare Dashboard → Pages → sgyt-portfolio → Settings → Functions → D1 database bindings:
- Variable name: `DB`
- Database: `sgyt-portfolio-db`

## Contact Worker

The contact form sends email via the standalone Cloudflare Worker in `contact-worker/`:

```bash
cd contact-worker
wrangler secret put TO_EMAIL        # cshaily38@gmail.com
wrangler secret put FROM_EMAIL      # noreply@slayergamer.eu.org
wrangler secret put ALLOWED_ORIGIN  # https://slayergamer.eu.org
wrangler publish
```

## MailChannels DNS record

Add this TXT record to your domain:
- Name: `_mailchannels`
- Type: `TXT`
- Value: `v=mc1 cfid=cshaily38.cloudflareaccess.com`
