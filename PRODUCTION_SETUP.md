# Kitchen Diaries POS — Production Setup

## Architecture

- **POS app**: this project. Customer-facing restaurant POS/PWA.
- **Control Panel**: separate project. Platform administration, license generation, device management and observability.
- **Shared database**: both projects intentionally use the **same PostgreSQL database**. They do not share authentication cookies or application routes.
- A generated activation code is the license credential. On first activation it is consumed atomically and creates/activates the subscription and binds the current device.

## License pricing

| Plan | 6 months | 12 months |
|---|---:|---:|
| Basic | ₹3,500 | ₹4,999 |
| Pro | ₹5,999 | ₹7,999 |
| Custom | Custom | Custom |

## Fresh local desktop test

1. Copy `.env.example` to `.env` and set the PostgreSQL connection.
2. Install packages:

```powershell
npm ci
```

3. Generate Prisma client and reset/seed a clean database:

```powershell
npm run db:setup:local
```

4. Start the POS:

```powershell
npm run dev
```

Open `http://localhost:3000`.

### Demo accounts

**PRO 12 months**
- Email: `owner@kitchendiaries.local`
- Password: `Demo@12345`
- Activation code: `KD-DEMO-PRO-12M`

**BASIC 12 months**
- Email: `basic.owner@kitchendiaries.local`
- Password: `Demo@12345`
- Activation code: `KD-DEMO-BASIC-12M`

The first successful online login consumes the demo code and binds that browser/device. Re-running the local reset command recreates fresh demo codes.

## Production database

This POS repository is the **single migration owner** for the PostgreSQL database shared with the Control Panel. Apply all production migrations from this repository; the Control Panel should only generate its Prisma Client and use the already-migrated schema.

Do **not** run `prisma db push --force-reset` in production.

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

Set:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET` (32+ random characters)
- `NEXT_PUBLIC_APP_URL`

The Control Panel must use the same `DATABASE_URL` and `DIRECT_URL`.

## Production validation flow

1. Admin logs into Control Panel.
2. Admin generates a Basic/Pro/Custom activation code with restaurant name, customer/owner name, email and phone.
3. Customer installs/opens POS.
4. Customer enters the activation code and the issued customer email; restaurant/owner metadata is bound from the license.
5. POS transaction creates tenant, owner, subscription and device together.
6. Code becomes `USED` and cannot be reused.
7. Later logins require valid credentials, active subscription and an active bound device.
8. Additional devices are accepted only while `activeDevices < subscription.maxDevices`.
9. `/api/auth/validate` verifies the device id and device key together when both are supplied.
10. Control Panel can revoke/activate devices and change device limits.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

For CI-style checks:

```powershell
npm run verify:ci
```


## Migration safety

The repository contains a final schema-hardening migration after the historical migrations. It adds the current sync states/fields, KOT tables, notification lifecycle fields, subscription renewal metadata, activation-code pricing/device metadata, and the shared Control Panel tables.

A fresh production database must be initialized with:

```powershell
npx prisma migrate deploy
```

Never use:

```powershell
npx prisma db push --force-reset
```

against production.

For local development, use:

```powershell
npm run db:setup:local
```
