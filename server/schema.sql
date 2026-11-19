-- ECO-TAP database schema (Postgres / Supabase).
-- The server runs this file on startup; every statement is safe to re-run.
-- You can also paste it into the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, username text NOT NULL UNIQUE, password_salt text NOT NULL,
  password_hash text NOT NULL, name text NOT NULL, initials text NOT NULL, role text NOT NULL
);
CREATE TABLE IF NOT EXISTS stations (
  id text PRIMARY KEY, location text NOT NULL, status text NOT NULL,
  last_sync text NOT NULL, deposits_today integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bins (
  station_id text NOT NULL REFERENCES stations(id), section text NOT NULL,
  label text NOT NULL, capacity double precision NOT NULL, weight double precision NOT NULL,
  grindable integer NOT NULL, grinding_status text NOT NULL,
  PRIMARY KEY (station_id, section)
);
CREATE TABLE IF NOT EXISTS grinding_schedules (
  id text PRIMARY KEY, station text NOT NULL REFERENCES stations(id), bins_json text NOT NULL,
  scheduled_for text NOT NULL, status text NOT NULL, assigned_staff text NOT NULL, note text NOT NULL
);
CREATE TABLE IF NOT EXISTS residents (
  id text PRIMARY KEY, name text NOT NULL, points integer NOT NULL CHECK (points >= 0), phone text NOT NULL
);
-- Resident card / PIN login for the mobile kiosk app (safe to re-run).
ALTER TABLE residents ADD COLUMN IF NOT EXISTS nfc_card_id text UNIQUE;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS pin_salt text;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE residents ADD COLUMN IF NOT EXISTS registered_at text;
CREATE TABLE IF NOT EXISTS logs (
  id integer PRIMARY KEY, kiosk text NOT NULL, section text NOT NULL, resident text NOT NULL,
  material text NOT NULL, subtype text NOT NULL, weight double precision NOT NULL, points integer NOT NULL,
  "time" text NOT NULL, source text NOT NULL, idempotency_key text UNIQUE
);
CREATE TABLE IF NOT EXISTS rewards (
  id text PRIMARY KEY, name text NOT NULL, cost integer NOT NULL CHECK (cost > 0)
);
CREATE TABLE IF NOT EXISTS redemptions (
  id text PRIMARY KEY, resident text NOT NULL REFERENCES residents(id), items text NOT NULL,
  points integer NOT NULL CHECK (points > 0), "time" text NOT NULL, status text NOT NULL,
  staff text NOT NULL, idempotency_key text UNIQUE
);
CREATE TABLE IF NOT EXISTS staff (
  id text PRIMARY KEY, name text NOT NULL, role text NOT NULL,
  assigned_kiosks text NOT NULL, contact text NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, type text NOT NULL, to_group text NOT NULL,
  title text NOT NULL, message text NOT NULL, "time" text NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_requests (
  scan_id text PRIMARY KEY, results_json text NOT NULL, created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS points_ledger (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, resident_id text NOT NULL REFERENCES residents(id),
  delta integer NOT NULL, reason text NOT NULL, reference_id text NOT NULL, created_at text NOT NULL
);

-- Supabase exposes public tables through its REST API. Turning on Row Level Security
-- with no policies blocks that route; the Node server connects directly and is unaffected.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE grinding_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Use-case update: terminate accounts, waste categories, beneficiaries.
-- ---------------------------------------------------------------------------
-- "Terminate User Account": a terminated account is kept but can no longer sign in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE residents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- "Select Waste Category" / "Calculate and Award Points": category -> bin section + points per kg.
-- Seeded with the two kiosk bin sections (b1 = PET, b2 = HDPE); edit the rates here to change conversion.
CREATE TABLE IF NOT EXISTS waste_categories (
  id text PRIMARY KEY, name text NOT NULL, section text NOT NULL,
  points_per_kg integer NOT NULL CHECK (points_per_kg > 0)
);
INSERT INTO waste_categories (id,name,section,points_per_kg) VALUES
  ('PET','PET bottles','b1',10), ('HDPE','HDPE containers','b2',20)
ON CONFLICT (id) DO NOTHING;

-- "Receive Collected Waste": beneficiaries and the waste handed over to them.
CREATE TABLE IF NOT EXISTS beneficiaries (
  id text PRIMARY KEY, name text NOT NULL, contact text NOT NULL DEFAULT '', address text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS waste_transfers (
  id text PRIMARY KEY, beneficiary_id text NOT NULL REFERENCES beneficiaries(id),
  station text NOT NULL, section text NOT NULL, material text NOT NULL,
  weight double precision NOT NULL CHECK (weight > 0), status text NOT NULL,
  dispatched_at text NOT NULL, received_at text, staff text NOT NULL, idempotency_key text UNIQUE
);
ALTER TABLE waste_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_transfers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Machine-measured deposits. A resident only opens a deposit session (who + which category);
-- the weight and detected material come from the machine's load cell / optical sensor through
-- /api/kiosk/device/deposit-event, authenticated with a per-station device key.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deposit_sessions (
  id text PRIMARY KEY, resident_id text NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  station_id text NOT NULL, category_id text NOT NULL, status text NOT NULL,
  created_at text NOT NULL, expires_ms bigint NOT NULL, result_json text
);
CREATE INDEX IF NOT EXISTS deposit_sessions_station_open ON deposit_sessions (station_id, status);
ALTER TABLE deposit_sessions ENABLE ROW LEVEL SECURITY;
