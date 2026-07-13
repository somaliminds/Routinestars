# Professional Portal — Web Deploy (Option A)

The professional portal runs on the web from the **same Expo codebase** as the
mobile app (react-native-web). Only the professional experience is supported on
web; child/parent/TA users see a "use the mobile app" notice.

## Security note

Opening a web surface adds **no** new access to children's data. Every gate —
mandatory MFA (`aal2`), active consent, scoped data categories — is enforced in
Postgres RLS server-side (migrations 028/029/032). The web client is just a
different front-end to the same locked-down backend, exactly as constrained as
the mobile app.

## Build

```bash
cd apps/mobile
npx expo export --platform web      # → apps/mobile/dist/
```

Output is a static site in `dist/` (`app.json` → `web.output: "single"`, a
single-page app). `expo-sqlite` and other native-only modules are excluded from
the web bundle via platform files (e.g. `offline-db.web.ts`).

## Hosting

Host `dist/` as a static site on any static host (Vercel, Netlify, Cloudflare
Pages, or the same provider as `routinestars.co.uk`). Suggested subdomain:
**`portal.routinestars.co.uk`**.

**SPA rewrite is required** — every route must serve `index.html` (the router
resolves the path client-side). Examples:

- **Netlify** — `dist/_redirects`:
  ```
  /*    /index.html   200
  ```
- **Vercel** — `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- **Cloudflare Pages** — set the build output dir to `dist`; SPA rewrites are on
  by default.

## Environment variables

The web build reads the same `EXPO_PUBLIC_*` vars as mobile (baked in at build
time). Ensure these are present in the build environment (they are public keys,
safe to ship in a client bundle):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (optional — crash reporting)
- Stripe **publishable** key is not needed by the portal (professionals don't
  bill).

## First-run checklist

1. Build → deploy `dist/` with the SPA rewrite.
2. Open the site → you should land on the auth/welcome screen.
3. Sign in with a **professional** account (an account that holds an active
   consent). → routed to the portal → MFA gate (scan the TOTP QR) → children
   list.
4. Sign in with a **parent** account → the "use the mobile app" notice.

## Known web limitations

- Push notifications, camera, audio narration, and the offline queue are
  native-only — not needed by the portal, disabled on web.
- The portal is styled as a centered max-width column on desktop; it is not a
  bespoke desktop layout. Fine for the current form-based portal; revisit if the
  portal grows data-dense tables.
