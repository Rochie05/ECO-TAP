# Local API

The local API stores demo state in Supabase Postgres, reached with the `DATABASE_URL` in `.env` (see `../.env.example`). It runs on `127.0.0.1:3000` and is intended for local development only.

On startup it runs `schema.sql` (safe to re-run; it also enables Row Level Security on every table so the public Supabase REST API cannot read them) and creates the `superadmin` account if it does not exist. All other tables start empty.

The built-in `superadmin` account (password `Admin1!`) is the only account created automatically; only it can create, edit, and delete other accounts (`/api/users`). Passwords are salted and hashed in the database. Change the default password before real use.

The API uses HttpOnly SameSite session cookies (held in server memory, so restarting the API signs everyone out) and requires a signed-in staff session for application data routes. Supervisors, administrators, and the superadmin can scan bins, record batch handovers, and send upcycle notices; staff can process redemptions. Reward point debits are committed with their redemption in one Postgres transaction that locks the resident row, and requests require an idempotency key. Bin scans are also idempotent by scan ID.

Keep `DATABASE_URL` and any Supabase `service_role` key on the server only. This prototype is not suitable for internet exposure or real reward balances. It has no external identity provider, kiosk device credentials, distributed session store, production CSRF/origin controls, or monitoring. Do not bind the API to a public interface or enter real resident information.

## Kiosk API (`/api/kiosk/*`)

Used by the Android kiosk app in `../mobile-android` and the resident app in `../mobile`. These routes do not use staff sessions. The device sends `X-Kiosk-Key` (must equal `KIOSK_API_KEY`; the routes return 503 until it is set), and each resident signs in with NFC card + 6-digit PIN to get a 15-minute bearer token. PINs are salted and hashed like staff passwords, and 5 wrong PINs lock a card for a minute. Routes: `GET health`, `GET rewards`, `GET categories`, `GET stations`, `POST card`, `POST register`, `POST login`, `POST logout`, `GET me`, `PUT pin`, `POST redeem`, `POST deposit/start`, `GET deposit/:id`, `POST deposit/:id/cancel`. `POST deposit` (client-supplied weight) is disabled and returns 410.

Residents open a session with `POST deposit/start {categoryId}`. The machine then calls `POST /api/kiosk/device/deposit-event` (`X-Station-Id` + `X-Device-Key` from `DEVICE_KEYS`) with `{eventId, sessionId?, material, weightKg}` (0.01 to 20 kg, 30 events/min/station). The server calculates `round(weightKg x points_per_kg)`, then in one transaction logs the deposit, credits the resident, writes a `points_ledger` row and raises the bin weight/fill level. Retrying with the same `eventId` returns the original deposit without awarding twice. Terminated residents cannot log in and their open sessions are cut off. Redemptions go through the same transaction as the portal's rewards desk and show up as `pending`.

## Collector card access

Administrators can assign Collector and Supervisor roles. The superadmin can also assign Administrator. Collector accounts cannot sign in to the portal.

Enroll a collector card UID and choose the assigned kiosks under **Accounts**. The machine controller can submit `POST /api/kiosk/device/collection-access` with `{ "cardUid": "<hexadecimal NFC UID>" }` and its station's `X-Station-Id` and `X-Device-Key` headers over HTTPS. An active collector assigned to that station receives a 10-second `bin_collection` authorization, while invalid cards and assignments receive a denial. The controller must integrate this check with its collection lock and machine interlocks. The API itself does not actuate hardware.

By default the API listens on `127.0.0.1` only. Set `API_HOST=0.0.0.0` to let a phone on your network reach it, and only do that on a network you trust: it is plain HTTP.

## Portal routes added for the use case diagram

| Route | Who | What |
|---|---|---|
| `GET /api/analytics` | any signed-in staff | Waste volume by day (14), week (12), month (12), by category, plus beneficiary totals |
| `PATCH /api/residents/:id` | Administrator, Superadmin | Change name, address, phone, status (`active` / `terminated`) or reset PIN |
| `DELETE /api/residents/:id` | Administrator, Superadmin | Delete the account, its points ledger and redemptions (collection logs are kept) |
| `PATCH /api/users/:username` | Superadmin | Now also accepts `status` (`active` / `terminated`) |
| `POST /api/beneficiaries` | Supervisor and up | Register a beneficiary |
| `POST /api/waste-transfers` | Supervisor and up | Hand over a bin's full measured contents (weight is taken from the bin, not typed); needs an idempotency key |
| `POST /api/waste-transfers/:id/receive` | Supervisor and up | Mark a handover as received |
