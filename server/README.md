# Local API

The localhost API stores demo state in SQLite at `../.data/ecotap.sqlite`. It runs on `127.0.0.1:3000` and is intended for local development only.

Demo users are seeded on first startup: `maria / eco123`, `ana / eco123`, and `admin / admin`. Passwords are salted and hashed in the local database. The accounts and sample resident data are public demo fixtures, not production credentials or real records.

The API uses HttpOnly SameSite session cookies and requires a signed-in staff session for application data routes. Supervisors and administrators can schedule grinding, scan bins, and send upcycle notices; staff can process redemptions. Reward point debits are committed with their redemption in one SQLite transaction and requests require an idempotency key. Bin scans are also idempotent by scan ID.

This prototype is not suitable for internet exposure or real reward balances. It has no external identity provider, kiosk device credentials, distributed session store, production CSRF/origin controls, backups, monitoring, or deployable secrets management. Do not bind the API to a public interface or enter real resident information.
