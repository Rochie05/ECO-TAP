# ECO-TAP

A local, full-stack MVP for the ECO-TAP recycling and rewards concept. The site uses React + Vite, a Node.js API, and a persistent SQLite database.

## Run locally

Requires Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173/> for the landing page, then choose **Staff demo**. The portal is at <http://127.0.0.1:5173/portal.html>.

For a production-style local run:

```sh
npm run build
npm start
```

Then open <http://127.0.0.1:3000/>. The API and built site share that origin.

## Resident mobile app

The `mobile/` folder contains an Expo app for Android and iPhone. It uses the same cream, forest-green, and leaf-green design as the website. The resident demo includes a points dashboard, kiosk list, sample deposit flow, reward redemption, activity history, and a profile.

```sh
cd mobile
npm install
npm start
```

Open the project in Expo Go using the QR code printed by Expo. This is a local prototype: deposits and redemptions are simulated, and changes last only for the current app session. The mobile app does not connect to the staff API, NFC hardware, or a live rewards service.

## Demo accounts

- `maria` / `eco123` — Collector
- `ana` / `eco123` — Supervisor
- `admin` / `admin` — Administrator

The portal includes kiosk monitoring and scans, grinding schedules, collection logs, rewards redemption, notifications, upcycled-output estimates, and a staff directory. Supervisor actions are restricted by the local API.

Data is stored in `.data/ecotap.sqlite` and persists across reloads and restarts. This is a local demo with sample resident and staff records; it is not suitable for real accounts, rewards, or personal data. It binds to localhost only. NFC hardware is not wired up, the resident mobile prototype is separate from this API, and kiosk scans are simulated.

The local SQLite backend provides a runnable development substitute for the planned hosted Postgres/Supabase backend. Move to production authentication, database policies, kiosk device credentials, and real NFC integration only after the target hardware and deployment requirements are confirmed.
