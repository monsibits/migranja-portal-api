# Mi Granja portal API

Private API for the Mi Granja staff portal and public booking calendar. It runs as a Cloudflare Worker on a workers.dev host and stores data in a private D1 database.

The public website talks to this API from `https://www.migranjaevents.com/book/` and `https://www.migranjaevents.com/portal/`.

## Stack

- Cloudflare Worker (free plan)
- Cloudflare D1 (private database)
- Session tokens sent in the `Authorization` header, with roles checked on the server

Google Sheets is not connected yet. D1 is the source of truth. A later step can export or sync to a private Sheet once a Google Cloud service account is available.

## Deploy

`src/index.js` imports `handleOps` from `src/ops.js`, so a plain Wrangler deploy includes every operations route. Do not concatenate the files by hand.

From this folder, with Wrangler logged in to the same Cloudflare account that owns migranjaevents.com:

```
npx wrangler d1 migrations apply migranja-portal --remote
npx wrangler deploy
node scripts/smoke.mjs
```

`scripts/smoke.mjs` signs in with the SAMPLE accounts in `.sample-staff` (that file is gitignored) and creates one sample record per new module. It never prints passwords or tokens.

If a deploy path needs a single Worker file, run `node scripts/bundle-worker.mjs` and upload `artifacts/worker.js`. That folder is gitignored.

Secrets (never commit these):

- None are required in source. Session IDs are random and stored in D1.
- `.sample-staff` holds SAMPLE test logins only. Keep it mode 600 and never paste those passwords into chat or logs.

## First owner sign-in

Until the owner password is set, open the one-time setup page on the live site (`/portal/#setup`) with the setup code issued at launch. The code is not stored in this repository. After that, sign in with the email and password chosen on that page.

## Browser support

Recent Chrome, Firefox, Safari, and Edge (last two major versions).

Sample records in the private database are marked and can be removed by the owner. They do not appear on the public booking calendar.
