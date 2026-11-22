# ECO-TAP

A local, full-stack MVP for the ECO-TAP recycling and rewards concept. The site uses React + Vite, a Node.js API, and a Supabase (Postgres) database.

## Run locally

Requires Node.js 22.12 or newer, npm, and a Supabase project.

1. Copy `.env.example` to `.env` and paste your Supabase **Session pooler** connection string into `DATABASE_URL`.
2. Install and start:

```sh
npm install
npm run dev
```

On first start the API creates empty tables in your Supabase database (`server/schema.sql`) and a single `superadmin` account. No sample data is inserted. Later starts reuse what is there.

Open <http://127.0.0.1:5173/> for the landing page, then choose **Staff demo**. The portal is at <http://127.0.0.1:5173/portal.html>.

For a production-style local run:

```sh
npm run build
npm start
```

Then open <http://127.0.0.1:3000/>. The API and built site share that origin.

## Use case coverage

| Use case | Where |
|---|---|
| Inquire card / account information (include: authenticate with NFC tap + 6-digit PIN) | Android kiosk: *Card Inquiry*, NFC + PIN screens |
| Deposit segregated waste (include: select waste category, weigh scale, calculate and award points) | Android kiosk: *Deposit Segregated Waste* (select category, `POST /api/kiosk/deposit/start`); weigh scale + award points via the machine (`POST /api/kiosk/device/deposit-event`) |
| View reward point conversion | Android kiosk: *Reward Point Conversion*; portal *Rewards desk* |
| Redeem supply goods (include: deduct reward points) | Android kiosk: *Redeem Rewards*; portal *Rewards desk* |
| Monitor waste volume (daily, weekly, monthly) and view waste analytics | Portal: *Waste analytics* |
| Monitor user accounts: view, modify, terminate, delete (residents) | Portal: *Resident accounts* (Administrator / Superadmin edit; Supervisor views) |
| Same for staff sign-ins | Portal: *Accounts* (Superadmin) |
| Receive collected waste (Beneficiaries) | Portal: *Beneficiaries* (hand over waste from a bin, then mark received) |

Points per kilogram live in the `waste_categories` table (seeded: PET 10, HDPE 20). Change the rates there.
A terminated account keeps its data but cannot sign in (staff) or use its card (resident) until reactivated.

## React Native kiosk app

The current Expo kiosk lives in [kiosk/](kiosk/README.md). It includes the shared resident-app styling, ECO-TAP branding, NFC sign-in, deposit, account, and rewards flows.

## Original Android kiosk app

`mobile-android/` is the native Android NFC kiosk app (card tap, PIN, rewards, card inquiry). It uses the same server and database as the portal through the `/api/kiosk/*` routes. See `mobile-android/README.md` for setup. It needs `KIOSK_API_KEY` in `.env`. Deposits cannot be logged by hand: the kiosk only opens a deposit session, and the machine's load cell and optical sensor report the weight and material (see *Machine-measured deposits* below).

## Resident mobile app (React Native / Expo)

The `mobile/` folder is a working Android app for residents. It signs in with the NFC card + 6-digit PIN, shows real points and history, starts machine-measured deposits, and redeems rewards, all through the `/api/kiosk/*` routes. See `mobile/README.md` for setup, building an APK, and testing a deposit with the machine simulator.

## Accounts

The only built-in account is `superadmin` (role Superadmin, password `Admin1!`). **Change that password** (or delete the account from the database and recreate it with a stronger one) before exposing this anywhere. Sign in as superadmin and open **Accounts** to create Collector, Supervisor, and Administrator users, change their roles, reset passwords, or delete them.

The portal includes kiosk monitoring and scans, grinding schedules, collection logs, rewards redemption, notifications, upcycled-output estimates, and a staff directory. Supervisor actions are restricted by the local API.

Data is stored in your Supabase Postgres database and persists across reloads and restarts. This is a prototype; it is not suitable for real accounts, rewards, or personal data. The API binds to localhost only. NFC hardware is not wired up, and kiosk scans are simulated.

Move to production authentication, database policies, kiosk device credentials, and real NFC integration only after the target hardware and deployment requirements are confirmed.

## Machine-measured deposits (no manual logging)

Nobody can type in a weight. The flow is:

1. The resident taps their card + PIN and **selects a waste category** on the kiosk. That opens a short-lived deposit session (`POST /api/kiosk/deposit/start`).
2. The machine's **load cell and optical sensor** report the measured weight and detected material to `POST /api/kiosk/device/deposit-event`, authenticated with that station's own key (`X-Station-Id` + `X-Device-Key`, set in `DEVICE_KEYS` in `.env`).
3. The server **calculates and awards the points** from the detected material and measured weight, logs the deposit (`source = machine`), raises the bin weight, and the kiosk shows the result.

The old resident-facing `POST /api/kiosk/deposit` now returns `410`. Waste handovers to beneficiaries use the bin's measured weight, not a typed number. Until the hardware is connected, test with the simulator:

```sh
node scripts/simulate-machine.mjs --station K-001 --key <device key> --material PET --kg 1.25
```
