import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  // Local dev/preview only — these servers don't exist in production (the site
  // ships as static files via Cloudflare Pages). Allow access by any hostname
  // so `--host` works behind a reverse proxy or by machine name (e.g. r630-js),
  // not just localhost/IP. Astro's dev and static-preview servers both read
  // this `server.allowedHosts` value.
  server: {
    allowedHosts: true,
  },
});
