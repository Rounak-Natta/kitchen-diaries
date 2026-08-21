# Kitchen Diaries POS

Production-oriented offline-first restaurant POS/PWA for Kitchen Diaries.

## Companion application

The platform Control Panel is a separate project and must use the same PostgreSQL database. It generates activation licenses and manages restaurants/devices.

## Quick start

```powershell
npm ci
Copy-Item .env.example .env
# configure DATABASE_URL, DIRECT_URL and JWT_SECRET
npm run db:setup:local
npm run dev
```

Open `http://localhost:3000`.

## Demo accounts

- **PRO 12M:** `owner@kitchendiaries.local` / `Demo@12345` / `KD-DEMO-PRO-12M`
- **BASIC 12M:** `basic.owner@kitchendiaries.local` / `Demo@12345` / `KD-DEMO-BASIC-12M`

The activation code is consumed on first successful online validation and the current device is bound automatically.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

See `PRODUCTION_SETUP.md` for deployment, license pricing, shared-database rules and production validation flow.


## Database rules

This project now uses Prisma migrations as the source of truth.

### Local reset

```powershell
docker compose up -d postgres
npx prisma generate
npx prisma migrate reset --force
npm run seed:demo
npm run typecheck
npm run lint
npm run build
npm run dev
```

Do not use `prisma db push` for normal development or production after the migration history is established.

### Production

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

Use `.env.production.example` as the starting point for the Supabase configuration.

## Subscription pricing

| Plan | 6 months | 12 months |
|---|---:|---:|
| Basic | ₹3,500 | ₹4,999 |
| Pro | ₹5,999 | ₹7,999 |
| Custom | Custom | Custom |

Activation codes carry the device limit and price metadata. The current default device limit is 10. Demo activation codes also use 10.

## Main app / Control Panel contract

The POS and Control Panel intentionally share the same PostgreSQL database but have separate Next.js applications and separate authentication cookies.

- Control Panel generates activation codes.
- POS consumes an activation code during first activation.
- Activation atomically creates/activates the subscription and binds the current device.
- Later logins require valid credentials, active subscription, and an active device binding.
- Device creation is protected by a serializable transaction to prevent concurrent logins from exceeding the subscription device limit.
- Sync operations are persisted with retry/conflict/error metadata.
