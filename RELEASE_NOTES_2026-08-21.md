# Kitchen Diaries POS — Production Hardening Release

## Fixed

- Offline POS no longer blocks immediately when connectivity drops while the local subscription/offline lease is still valid.
- Offline order sync strips the legacy local-only `_localOrderId` field before strict server validation.
- Sync push returns HTTP 207 for mixed-success batches so a failed operation is no longer presented as a clean HTTP 200 batch.
- Customer name and phone are mandatory for billing in the UI, server schema, local bill creation and queued cloud-sync payload.
- Offline bill sync now carries customer name, phone, address and notes to the cloud bill.
- Both logout implementations clear the local offline authorization lease and local subscription metadata.
- PWA registration now requires a secure context (HTTPS, except localhost development).
- Service worker no longer caches API responses or tenant-specific protected documents; it caches only the public POS/login shell and static assets.
- Added hardened security headers, production HSTS, API no-store headers, service-worker scope/cache headers and installable PWA metadata.
- Activation licenses can carry restaurant/customer onboarding metadata and the POS uses it when creating the first tenant/owner.
- Commercial prices are aligned to the supplied KD specification: Basic ₹3,500/₹4,999 and Pro ₹5,999/₹7,999 for 6/12 months.

## Database migration

Deploy `20260821093000_activation_customer_metadata` before releasing either application. Both repositories contain the same migration because they share the same PostgreSQL database.

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Run the migration from one deployment pipeline first; the other project will see it as already applied.

## Release checks

Before production traffic, run `npm run verify:ci` in the POS project and `npm run verify` in the control-panel project with production-equivalent environment variables and PostgreSQL available.

## Follow-up fixes

- Fixed the offline acceptance regression fixture so mandatory customer name/phone are exercised and verified across a local database restart.
- Hardened first-activation POS device naming when optional onboarding fields are absent.
