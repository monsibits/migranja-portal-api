# Mi Granja portal API

Private API for the Mi Granja staff portal and public booking calendar. It runs as a Cloudflare Worker on a workers.dev host and stores data in a private D1 database.

The public website talks to this API from `https://www.migranjaevents.com/book/` and `https://www.migranjaevents.com/portal/`.

## Stack

- Cloudflare Worker (free plan)
- Cloudflare D1 (private database)
- Session cookies (`HttpOnly`, `Secure`, `SameSite=None`) with roles checked on the server

Google Sheets is not connected yet. D1 is the source of truth. A later step can export or sync to a private Sheet once a Google Cloud service account is available.

## Deploy

From this folder, with Wrangler logged in to the same Cloudflare account that owns migranjaevents.com:

```
npx wrangler deploy
```

Secrets (never commit these):

- None are required in source. Session IDs are random and stored in D1.

## First owner sign-in

Until the owner password is set, open the one-time setup page on the live site (`/portal/#setup`) with the setup code issued at launch. The code is not stored in this repository. After that, sign in with the email and password chosen on that page.

## Browser support

Recent Chrome, Firefox, Safari, and Edge (last two major versions).
