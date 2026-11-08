# KAB6ANbl ESPORTS — REG.RU deployment

## Recommended REG.RU setup

This repository is a Vite/React single-page application. Deploy the generated static files, not the source directory.

### Build

```bash
npm ci
npm run build
```

The publish directory is:

```text
dist
```

On ordinary hosting, upload the **contents** of `dist/` to the site's document root (usually `www/`). The included `public/.htaccess` is copied into `dist/` and enables SPA fallback for `/admin` and other client-side routes.

### Build-time environment variables

Create these variables in REG.RU's build/deploy settings, or create a local `.env` before running the build:

```text
VITE_SUPABASE_URL=https://dydsgyjwjbrcymkvzrji.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase Publishable/anon public key>
```

`VITE_SUPABASE_ANON_KEY` is required at build time because Vite embeds `VITE_*` variables into the browser bundle. Never use a Supabase `service_role` or secret key in this project.

### If REG.RU does not build from GitHub

Build locally with the variables above, then upload the contents of `dist/` through the REG.RU file manager or SFTP. Do not upload `.env`, `node_modules`, or the source `.git` directory.

### Supabase Edge Functions

The existing FACEIT/admin server functions remain in `supabase/functions/site-admin`. They must stay deployed in the Supabase project `dydsgyjwjbrcymkvzrji`; static REG.RU hosting does not run Deno Edge Functions.
