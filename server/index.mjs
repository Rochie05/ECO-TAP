import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  randomBytes, scryptSync, timingSafeEqual,
} from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const dataDir = path.resolve(process.env.ECOTAP_DATA_DIR || path.join(projectRoot, '.data'));
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'ecotap.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL, name TEXT NOT NULL, initials TEXT NOT NULL, role TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY, location TEXT NOT NULL, status TEXT NOT NULL,
    last_sync TEXT NOT NULL, deposits_today INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS bins (
    station_id TEXT NOT NULL REFERENCES stations(id), section TEXT NOT NULL,
    label TEXT NOT NULL, capacity REAL NOT NULL, weight REAL NOT NULL,
    grindable INTEGER NOT NULL, grinding_status TEXT NOT NULL,
    PRIMARY KEY (station_id, section)
  );
  CREATE TABLE IF NOT EXISTS grinding_schedules (
    id TEXT PRIMARY KEY, station TEXT NOT NULL REFERENCES stations(id), bins_json TEXT NOT NULL,
    scheduled_for TEXT NOT NULL, status TEXT NOT NULL, assigned_staff TEXT NOT NULL, note TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS residents (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL CHECK(points >= 0), phone TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY, kiosk TEXT NOT NULL, section TEXT NOT NULL, resident TEXT NOT NULL,
    material TEXT NOT NULL, subtype TEXT NOT NULL, weight REAL NOT NULL, points INTEGER NOT NULL,
    time TEXT NOT NULL, source TEXT NOT NULL, idempotency_key TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, name TEXT NOT NULL, cost INTEGER NOT NULL CHECK(cost > 0));
  CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY, resident TEXT NOT NULL REFERENCES residents(id), items TEXT NOT NULL,
    points INTEGER NOT NULL CHECK(points > 0), time TEXT NOT NULL, status TEXT NOT NULL,
    staff TEXT NOT NULL, idempotency_key TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
    assigned_kiosks TEXT NOT NULL, contact TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, to_group TEXT NOT NULL,
    title TEXT NOT NULL, message TEXT NOT NULL, time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scan_requests (
    scan_id TEXT PRIMARY KEY, results_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS points_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, resident_id TEXT NOT NULL REFERENCES residents(id),
    delta INTEGER NOT NULL, reason TEXT NOT NULL, reference_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const initialStations = [
  { id: 'K-001', location: 'QC Hall — High Rise Lobby', status: 'Online', lastSync: '2 mins ago', depositsToday: 14, bins: {
    b1: { label: 'Clear PET (no caps, no labels)', capacity: 78, weight: 6.2, grindable: true, grindingStatus: 'idle' },
    b2: { label: 'Mixed-color HDPE (no caps, no labels)', capacity: 42, weight: 3.1, grindable: true, grindingStatus: 'idle' },
    b3: { label: 'Mixed PET+HDPE (caps & labels ON)', capacity: 91, weight: 8.5, grindable: false, grindingStatus: 'n/a' },
  } },
  { id: 'K-002', location: 'QC Hall — Annex Entrance', status: 'Online', lastSync: '5 mins ago', depositsToday: 9, bins: {
    b1: { label: 'Clear PET (no caps, no labels)', capacity: 33, weight: 2.4, grindable: true, grindingStatus: 'idle' },
    b2: { label: 'Mixed-color HDPE (no caps, no labels)', capacity: 55, weight: 4.0, grindable: true, grindingStatus: 'idle' },
    b3: { label: 'Mixed PET+HDPE (caps & labels ON)', capacity: 28, weight: 2.6, grindable: false, grindingStatus: 'n/a' },
  } },
  { id: 'K-003', location: 'QC Hall — Parking Area', status: 'Online', lastSync: '12 mins ago', depositsToday: 22, bins: {
    b1: { label: 'Clear PET (no caps, no labels)', capacity: 100, weight: 7.9, grindable: true, grindingStatus: 'full' },
    b2: { label: 'Mixed-color HDPE (no caps, no labels)', capacity: 88, weight: 6.5, grindable: true, grindingStatus: 'idle' },
    b3: { label: 'Mixed PET+HDPE (caps & labels ON)', capacity: 65, weight: 6.1, grindable: false, grindingStatus: 'n/a' },
  } },
];

const initialLogs = [
  { id: 1, kiosk: 'K-001', section: 'b1', resident: 'R-10023', material: 'PET', subtype: 'Clear PET — Water Bottle (500ml)', weight: 1.2, points: 12, time: '2026-11-04 09:12', source: 'kiosk' },
  { id: 2, kiosk: 'K-001', section: 'b2', resident: 'R-10078', material: 'HDPE', subtype: 'HDPE — Milk Jug (1L)', weight: 0.8, points: 16, time: '2026-11-04 09:05', source: 'kiosk' },
  { id: 3, kiosk: 'K-002', section: 'b1', resident: 'R-10012', material: 'PET', subtype: 'Clear PET — Soda Bottle (1.5L)', weight: 2.1, points: 21, time: '2026-11-04 08:58', source: 'app' },
  { id: 4, kiosk: 'K-001', section: 'b3', resident: 'R-10044', material: 'MIXED', subtype: 'PET+HDPE — Shampoo Bottle', weight: 3.4, points: 10, time: '2026-11-04 08:40', source: 'kiosk' },
  { id: 5, kiosk: 'K-002', section: 'b1', resident: 'R-10099', material: 'PET', subtype: 'Clear PET — Water Bottle (1L)', weight: 1.7, points: 17, time: '2026-11-04 08:22', source: 'app' },
  { id: 6, kiosk: 'K-001', section: 'b2', resident: 'R-10055', material: 'HDPE', subtype: 'HDPE — Detergent Bottle', weight: 0.9, points: 9, time: '2026-11-03 16:10', source: 'kiosk' },
  { id: 7, kiosk: 'K-002', section: 'b3', resident: 'R-10067', material: 'MIXED', subtype: 'PET+HDPE — Mixed Bottles', weight: 1.1, points: 5, time: '2026-11-03 15:40', source: 'kiosk' },
  { id: 8, kiosk: 'K-001', section: 'b1', resident: 'R-10023', material: 'PET', subtype: 'Clear PET — Water Bottle (500ml)', weight: 0.6, points: 6, time: '2026-11-02 11:20', source: 'app' },
];

const initialResidents = [
  { id: 'R-10023', name: 'Juan Dela Cruz', points: 150, phone: '0917-100-0023' },
  { id: 'R-10078', name: 'Pedro Reyes', points: 88, phone: '0918-100-0078' },
  { id: 'R-10012', name: 'Rosa Martinez', points: 220, phone: '0919-100-0012' },
  { id: 'R-10044', name: 'Liza Santos', points: 64, phone: '0920-100-0044' },
  { id: 'R-10099', name: 'Mark Aquino', points: 42, phone: '0921-100-0099' },
];

const initialRewards = [
  { id: 'I-01', name: 'Rice (1 kg)', cost: 50 }, { id: 'I-02', name: 'Canned Goods', cost: 25 },
  { id: 'I-03', name: 'Instant Noodles', cost: 15 }, { id: 'I-04', name: 'Cooking Oil (250ml)', cost: 40 },
  { id: 'I-05', name: 'Soap Bar', cost: 20 }, { id: 'I-06', name: 'Sugar (500g)', cost: 30 },
];

const initialStaff = [
  { id: 'S-01', name: 'Maria Santos', role: 'Collector', assignedKiosks: ['K-001', 'K-002'], contact: '0917-111-2222' },
  { id: 'S-02', name: 'Jose Reyes', role: 'Collector', assignedKiosks: ['K-003'], contact: '0918-333-4444' },
  { id: 'S-03', name: 'Ana Cruz', role: 'Supervisor', assignedKiosks: ['All'], contact: '0919-555-6666' },
  { id: 'S-04', name: 'Luis Tan', role: 'Maintenance', assignedKiosks: ['K-001', 'K-003'], contact: '0920-777-8888' },
];

const yields = [
  { product: 'Chair (upcycled plastic)', icon: '🪑', kgPerUnit: 4.5, note: '1 chair ≈ 4.5 kg ground plastic' },
  { product: 'Plastic Lumber (1m)', icon: '🪵', kgPerUnit: 2, note: '1 meter beam ≈ 2 kg' },
  { product: 'Planter Pot', icon: '🪴', kgPerUnit: 1.2, note: '1 pot ≈ 1.2 kg' },
  { product: 'School Desk', icon: '🪑', kgPerUnit: 7, note: '1 desk ≈ 7 kg' },
  { product: 'Eco-Brick', icon: '🧱', kgPerUnit: 0.4, note: '1 brick ≈ 0.4 kg' },
];

function stamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  db.exec('BEGIN IMMEDIATE');
  try {
  const insertUser = db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const user of [
    { username: 'maria', password: 'eco123', name: 'Maria Santos', initials: 'MS', role: 'Collector' },
    { username: 'ana', password: 'eco123', name: 'Ana Cruz', initials: 'AC', role: 'Supervisor' },
    { username: 'admin', password: 'admin', name: 'Administrator', initials: 'AD', role: 'Administrator' },
  ]) {
    const salt = randomBytes(16).toString('hex');
    insertUser.run(randomBytes(8).toString('hex'), user.username, salt, scryptSync(user.password, salt, 64).toString('hex'), user.name, user.initials, user.role);
  }

  const insertStation = db.prepare('INSERT INTO stations VALUES (?, ?, ?, ?, ?)');
  const insertBin = db.prepare('INSERT INTO bins VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const station of initialStations) {
    insertStation.run(station.id, station.location, station.status, station.lastSync, station.depositsToday);
    for (const [section, bin] of Object.entries(station.bins)) {
      insertBin.run(station.id, section, bin.label, bin.capacity, bin.weight, Number(bin.grindable), bin.grindingStatus);
    }
  }

  const insertSchedule = db.prepare('INSERT INTO grinding_schedules VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertSchedule.run('G-1001', 'K-003', JSON.stringify(['b1']), '2026-11-06 14:00', 'scheduled', 'Luis Tan', 'Clear PET section is full — ready for grinding.');
  insertSchedule.run('G-1002', 'K-001', JSON.stringify(['b2']), '2026-11-05 09:30', 'completed', 'Maria Santos', 'Completed. 3.1 kg ground.');

  const insertResident = db.prepare('INSERT INTO residents VALUES (?, ?, ?, ?)');
  const insertLedger = db.prepare('INSERT INTO points_ledger(resident_id,delta,reason,reference_id,created_at) VALUES (?,?,?,?,?)');
  for (const resident of initialResidents) {
    insertResident.run(resident.id, resident.name, resident.points, resident.phone);
    insertLedger.run(resident.id, resident.points, 'seed_balance', `SEED-${resident.id}`, '2026-11-04 00:00');
  }

  const insertLog = db.prepare('INSERT INTO logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const log of initialLogs) insertLog.run(log.id, log.kiosk, log.section, log.resident, log.material, log.subtype, log.weight, log.points, log.time, log.source, `seed-log-${log.id}`);
  const insertReward = db.prepare('INSERT INTO rewards VALUES (?, ?, ?)');
  for (const reward of initialRewards) insertReward.run(reward.id, reward.name, reward.cost);
  const insertStaff = db.prepare('INSERT INTO staff VALUES (?, ?, ?, ?, ?)');
  for (const member of initialStaff) insertStaff.run(member.id, member.name, member.role, JSON.stringify(member.assignedKiosks), member.contact);

  const insertRedemption = db.prepare('INSERT INTO redemptions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertRedemption.run('TXN-1001', 'R-10012', JSON.stringify([{ id: 'I-01', name: 'Rice (1 kg)', qty: 2 }, { id: 'I-02', name: 'Canned Goods', qty: 1 }]), 125, '2026-11-03 14:22', 'fulfilled', 'Maria Santos', 'seed-txn-1001');
  insertRedemption.run('TXN-1002', 'R-10023', JSON.stringify([{ id: 'I-05', name: 'Soap Bar', qty: 1 }, { id: 'I-03', name: 'Instant Noodles', qty: 2 }]), 50, '2026-11-04 08:15', 'pending', 'Ana Cruz', 'seed-txn-1002');

  const insertNotice = db.prepare('INSERT INTO notifications(id,type,to_group,title,message,time) VALUES (?,?,?,?,?,?)');
  insertNotice.run(1, 'crit', 'residents+partner', 'Bin Full — K-003 · Section 1', 'Clear PET bin at QC Hall Parking reached 100% capacity. Please schedule grinding.', '2026-11-04 08:45');
  insertNotice.run(2, 'info', 'partner', 'Grinding Completed — K-001 · Section 2', '3.1 kg of mixed-color HDPE ground and ready for collection.', '2026-11-05 09:45');
  insertNotice.run(3, 'warn', 'residents', 'New Upcycled Batch Ready', 'The grinded plastic batch from K-001 can now make approximately 2 chairs, 4 planter pots, and 8 eco-bricks.', '2026-11-05 10:00');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
seed();

const sessions = new Map();
const loginFailures = new Map();
const cookieName = 'ecotap_session';
const demoAccounts = new Set(['maria', 'ana', 'admin']);

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function bodyJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 32_000) fail(413, 'Request body is too large.');
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { fail(400, 'Request body must be valid JSON.'); }
}

function cookieValue(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

function sessionUser(req) {
  const token = cookieValue(req, cookieName);
  const username = sessions.get(token);
  if (!username) fail(401, 'Sign in to continue.');
  const user = db.prepare('SELECT username,name,initials,role FROM users WHERE username=?').get(username);
  if (!user) fail(401, 'Session is no longer valid. Please sign in again.');
  return user;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) fail(403, 'Your account cannot perform this action.');
}

function textField(value, label, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${label} is required and must be at most ${max} characters.`);
  return value.trim();
}

function displaySchedule(row) {
  return {
    id: row.id, station: row.station, bins: JSON.parse(row.bins_json),
    scheduledFor: row.scheduled_for, status: row.status,
    assignedStaff: row.assigned_staff, note: row.note,
  };
}

function bootstrap(user) {
  const stations = db.prepare('SELECT * FROM stations ORDER BY id').all().map((station) => {
    const bins = Object.fromEntries(db.prepare('SELECT * FROM bins WHERE station_id=? ORDER BY section').all(station.id)
      .map((bin) => [bin.section, {
        label: bin.label, capacity: bin.capacity, weight: bin.weight,
        grindable: Boolean(bin.grindable), grindingStatus: bin.grinding_status,
      }]));
    return { id: station.id, location: station.location, status: station.status, lastSync: station.last_sync, depositsToday: station.deposits_today, bins };
  });
  const logs = db.prepare('SELECT * FROM logs ORDER BY time DESC, id DESC').all().map((row) => ({
    id: row.id, kiosk: row.kiosk, section: row.section, resident: row.resident,
    material: row.material, subtype: row.subtype, weight: row.weight,
    points: row.points, time: row.time, source: row.source,
  }));
  const grindingSchedules = db.prepare('SELECT * FROM grinding_schedules ORDER BY scheduled_for DESC').all().map(displaySchedule);
  const residents = db.prepare('SELECT * FROM residents ORDER BY name').all().map((row) => ({ id: row.id, name: row.name, points: row.points, phone: row.phone }));
  const rewardItems = db.prepare('SELECT id,name,cost FROM rewards ORDER BY id').all();
  const redemptions = db.prepare('SELECT * FROM redemptions ORDER BY time DESC').all().map((row) => ({
    id: row.id, resident: row.resident, items: JSON.parse(row.items), points: row.points,
    time: row.time, status: row.status, staff: row.staff,
  }));
  const staff = db.prepare('SELECT * FROM staff ORDER BY id').all().map((row) => ({
    id: row.id, name: row.name, role: row.role, assignedKiosks: JSON.parse(row.assigned_kiosks), contact: row.contact,
  }));
  const notifications = db.prepare('SELECT id,type,to_group,title,message,time FROM notifications ORDER BY id DESC').all().map((row) => ({
    id: row.id, type: row.type, to: row.to_group, title: row.title, message: row.message, time: row.time,
  }));
  const allBins = stations.flatMap((station) => Object.values(station.bins));
  const stats = {
    kiosks: stations.length,
    depositsToday: stations.reduce((total, station) => total + station.depositsToday, 0),
    totalWeight: Number(allBins.reduce((total, bin) => total + bin.weight, 0).toFixed(1)),
    pointsAwarded: logs.reduce((total, log) => total + log.points, 0),
    fullBins: allBins.filter((bin) => bin.capacity >= 100).length,
  };
  return { user, stats, stations, grindingSchedules, logs, residents, rewardItems, redemptions, notifications, staff, upcycleYield: yields };
}

function createId(prefix) { return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`; }

function notify(type, to, title, message) {
  const result = db.prepare('INSERT INTO notifications(type,to_group,title,message,time) VALUES (?,?,?,?,?)').run(type, to, title, message, stamp());
  return Number(result.lastInsertRowid);
}

function handleLogin(req, res, body) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 80 || password.length > 200) return json(res, 400, { error: 'Enter a valid username and password.' });
  const key = `${req.socket.remoteAddress}:${username}`;
  const failures = loginFailures.get(key) || { count: 0, until: 0 };
  if (failures.until > Date.now()) return json(res, 429, { error: 'Too many sign-in attempts. Try again in one minute.' });
  const user = db.prepare('SELECT username,password_salt,password_hash,name,initials,role FROM users WHERE username=?').get(username);
  const provided = user ? scryptSync(password, user.password_salt, 64) : scryptSync(password, 'ecotap-demo-invalid-user-salt', 64);
  const expected = Buffer.from(user?.password_hash || '00'.repeat(64), 'hex');
  if (!user || !timingSafeEqual(provided, expected)) {
    failures.count += 1;
    if (failures.count >= 5) { failures.count = 0; failures.until = Date.now() + 60_000; }
    loginFailures.set(key, failures);
    return json(res, 401, { error: 'Invalid username or password.' });
  }
  loginFailures.delete(key);
  const token = randomBytes(32).toString('hex');
  sessions.set(token, user.username);
  const cleanUser = { username: user.username, name: user.name, initials: user.initials, role: user.role };
  return json(res, 200, { user: cleanUser }, {
    'Set-Cookie': `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
  });
}

function handleScheduleCreate(user, body) {
  requireRole(user, ['Supervisor', 'Administrator']);
  const station = textField(body.station, 'Station', 20);
  if (!db.prepare('SELECT id FROM stations WHERE id=?').get(station)) fail(400, 'Choose a valid kiosk station.');
  if (!Array.isArray(body.bins) || body.bins.length < 1 || body.bins.length > 2 || body.bins.some((bin) => !['b1', 'b2'].includes(bin)) || new Set(body.bins).size !== body.bins.length) fail(400, 'Choose one or more valid grindable sections.');
  const scheduledFor = textField(body.scheduledFor, 'Schedule time', 32).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(scheduledFor) || Number.isNaN(Date.parse(scheduledFor.replace(' ', 'T')))) fail(400, 'Enter a valid date and time.');
  const assignedStaff = textField(body.assignedStaff, 'Assigned staff', 100);
  if (!db.prepare('SELECT id FROM staff WHERE name=?').get(assignedStaff)) fail(400, 'Choose a staff member from the list.');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  const id = createId('G');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO grinding_schedules VALUES (?,?,?,?,?,?,?)').run(id, station, JSON.stringify(body.bins), scheduledFor, 'scheduled', assignedStaff, note || `Scheduled by ${user.name}`);
    notify('info', 'residents+partner', `Grinding Scheduled — ${station}`, `Grinding of ${body.bins.join(', ')} at ${station} is scheduled for ${scheduledFor}. Partner company has been notified to prepare collection.`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return displaySchedule(db.prepare('SELECT * FROM grinding_schedules WHERE id=?').get(id));
}

function handleScheduleUpdate(user, id, body) {
  requireRole(user, ['Supervisor', 'Administrator']);
  if (!['completed', 'missed'].includes(body.status)) fail(400, 'Status must be completed or missed.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const schedule = db.prepare('SELECT * FROM grinding_schedules WHERE id=?').get(id);
    if (!schedule) fail(404, 'Schedule not found.');
    if (schedule.status !== 'scheduled') fail(409, 'Only scheduled work can be updated.');
    db.prepare('UPDATE grinding_schedules SET status=? WHERE id=?').run(body.status, id);
    if (body.status === 'completed') {
      for (const section of JSON.parse(schedule.bins_json)) {
        db.prepare("UPDATE bins SET capacity=0,weight=0,grinding_status='idle' WHERE station_id=? AND section=?").run(schedule.station, section);
      }
      notify('info', 'partner+residents', `Grinding Completed — ${schedule.station}`, 'Grinded plastic is ready for collection. Partner company notified. Residents can view new upcycled output estimates.');
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return displaySchedule(db.prepare('SELECT * FROM grinding_schedules WHERE id=?').get(id));
}

function handleRedemption(user, body) {
  const residentId = textField(body.residentId, 'Resident ID', 30);
  const idempotencyKey = textField(body.idempotencyKey, 'Idempotency key', 100);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 12) fail(400, 'Select at least one reward.');
  const existing = db.prepare('SELECT id,points FROM redemptions WHERE idempotency_key=?').get(idempotencyKey);
  if (existing) return { id: existing.id, duplicate: true, points: existing.points };
  const resident = db.prepare('SELECT id,points FROM residents WHERE id=?').get(residentId);
  if (!resident) fail(404, 'Resident not found.');
  const combined = new Map();
  for (const item of body.items) {
    const id = textField(item.id, 'Reward ID', 30);
    const qty = Number(item.qty);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) fail(400, 'Reward quantity must be between 1 and 99.');
    combined.set(id, (combined.get(id) || 0) + qty);
  }
  const rewards = [];
  for (const [id, qty] of combined) {
    const reward = db.prepare('SELECT id,name,cost FROM rewards WHERE id=?').get(id);
    if (!reward) fail(400, 'A selected reward is not available.');
    rewards.push({ id, name: reward.name, qty, cost: reward.cost });
  }
  const total = rewards.reduce((sum, reward) => sum + reward.qty * reward.cost, 0);
  const redemptionId = createId('TXN');
  db.exec('BEGIN IMMEDIATE');
  try {
    const prior = db.prepare('SELECT id,points FROM redemptions WHERE idempotency_key=?').get(idempotencyKey);
    if (prior) { db.exec('COMMIT'); return { id: prior.id, duplicate: true, points: prior.points }; }
    const current = db.prepare('SELECT points FROM residents WHERE id=?').get(residentId);
    if (current.points < total) fail(409, 'Resident does not have enough points.');
    const now = stamp();
    db.prepare('UPDATE residents SET points=points-? WHERE id=?').run(total, residentId);
    db.prepare('INSERT INTO points_ledger(resident_id,delta,reason,reference_id,created_at) VALUES (?,?,?,?,?)').run(residentId, -total, 'reward_redemption', redemptionId, now);
    db.prepare('INSERT INTO redemptions VALUES (?,?,?,?,?,?,?,?)').run(redemptionId, residentId, JSON.stringify(rewards.map(({ id, name, qty }) => ({ id, name, qty }))), total, now, 'pending', user.name, idempotencyKey);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { id: redemptionId, duplicate: false, points: total };
}

function handleScan(user, body) {
  requireRole(user, ['Supervisor', 'Administrator']);
  const scanId = textField(body.scanId, 'Scan ID', 100);
  const prior = db.prepare('SELECT results_json FROM scan_requests WHERE scan_id=?').get(scanId);
  if (prior) return { ...JSON.parse(prior.results_json), duplicate: true };
  const full = db.prepare(`SELECT s.id AS station,s.location,b.section,b.label FROM bins b JOIN stations s ON s.id=b.station_id WHERE b.capacity>=100 ORDER BY s.id,b.section`).all();
  db.exec('BEGIN IMMEDIATE');
  try {
    const alerts = [];
    for (const bin of full) {
      const title = `Bin Full — ${bin.station} · ${bin.section.toUpperCase()}`;
      const alreadyReported = db.prepare("SELECT id FROM notifications WHERE type='crit' AND title=? AND substr(time,1,10)=substr(?,1,10)").get(title, stamp());
      if (!alreadyReported) {
        notify('crit', 'residents+partner', title, `${bin.label} bin at ${bin.location} is full. Schedule grinding and coordinate collection with the partner company.`);
        alerts.push(title);
      }
    }
    const result = { scanId, fullBins: full.length, alertsCreated: alerts.length, alerts, duplicate: false };
    db.prepare('INSERT INTO scan_requests VALUES (?,?,?)').run(scanId, JSON.stringify(result), stamp());
    db.exec('COMMIT');
    return result;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function handleUpcycleNotice(user, body) {
  requireRole(user, ['Supervisor', 'Administrator']);
  if (!['residents', 'partner'].includes(body.target)) fail(400, 'Choose residents or partner as the target.');
  const totals = db.prepare('SELECT section,SUM(weight) AS kg FROM bins WHERE grindable=1 GROUP BY section').all();
  const amount = totals.reduce((sum, row) => sum + row.kg, 0);
  if (amount <= 0) fail(409, 'There is no grindable plastic available yet.');
  const bySection = Object.fromEntries(totals.map((row) => [row.section, row.kg]));
  const products = yields.map((item) => ({ ...item, count: Math.floor(amount / item.kgPerUnit) })).filter((item) => item.count > 0);
  const summary = products.map((item) => `${item.count} ${item.product}`).join(', ');
  const title = body.target === 'partner' ? `Grindable Batch Ready — ${amount.toFixed(1)} kg` : 'New Upcycled Output Estimate';
  const message = body.target === 'partner'
    ? `Partner GreenCycle Recycling Corp.: ${amount.toFixed(1)} kg of grindable plastic (PET ${(bySection.b1 || 0).toFixed(1)} kg, HDPE ${(bySection.b2 || 0).toFixed(1)} kg) is available for pickup at QC Hall kiosks.`
    : `Based on ${amount.toFixed(1)} kg of grindable plastic currently collected, approximately ${summary} can be produced. Thank you for segregating!`;
  const id = notify('info', body.target, title, message);
  return { id, title, target: body.target };
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'], ['.webp', 'image/webp'], ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function serveFrontend(req, res, pathname) {
  const distDir = path.resolve(projectRoot, 'dist');
  const entry = path.join(distDir, 'index.html');
  if (!fs.existsSync(entry)) {
    const message = '<!doctype html><html lang="en"><meta charset="utf-8"><title>ECO-TAP is not built</title><body><h1>ECO-TAP frontend is not built yet</h1><p>Run <code>npm run build</code>, then restart the local server.</p></body></html>';
    res.writeHead(503, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(message),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(req.method === 'HEAD' ? undefined : message);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': 0 });
    return res.end();
  }

  let decodedPath;
  try { decodedPath = decodeURIComponent(pathname); }
  catch {
    res.writeHead(400, { 'Content-Length': 0, 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }
  if (decodedPath.includes('\0') || decodedPath.includes('\\')) {
    res.writeHead(400, { 'Content-Length': 0, 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }
  const segments = decodedPath.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.'))) {
    res.writeHead(404, { 'Content-Length': 0, 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }

  const relativePath = segments.length ? segments.join(path.sep) : 'index.html';
  const candidate = path.resolve(distDir, relativePath);
  if (candidate === distDir || !candidate.startsWith(`${distDir}${path.sep}`)) {
    res.writeHead(404, { 'Content-Length': 0, 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }

  let filePath = candidate;
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    const realDist = fs.realpathSync(distDir);
    const realFile = fs.realpathSync(filePath);
    if (!realFile.startsWith(`${realDist}${path.sep}`) || !fs.statSync(realFile).isFile()) throw new Error('Not a static file');
    filePath = realFile;
  } catch {
    res.writeHead(404, { 'Content-Length': 0, 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

async function api(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, mode: 'local-demo' });
  if (req.method === 'POST' && pathname === '/api/login') return handleLogin(req, res, await bodyJson(req));
  if (req.method === 'POST' && pathname === '/api/logout') {
    const token = cookieValue(req, cookieName);
    sessions.delete(token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
  }
  const user = sessionUser(req);
  if (req.method === 'GET' && pathname === '/api/bootstrap') return json(res, 200, bootstrap(user));
  if (req.method === 'POST' && pathname === '/api/grinding-schedules') return json(res, 201, { schedule: handleScheduleCreate(user, await bodyJson(req)) });
  const scheduleMatch = pathname.match(/^\/api\/grinding-schedules\/([A-Za-z0-9-]+)$/);
  if (req.method === 'PATCH' && scheduleMatch) return json(res, 200, { schedule: handleScheduleUpdate(user, scheduleMatch[1], await bodyJson(req)) });
  if (req.method === 'POST' && pathname === '/api/redemptions') return json(res, 201, { redemption: handleRedemption(user, await bodyJson(req)) });
  const redemptionMatch = pathname.match(/^\/api\/redemptions\/([A-Za-z0-9-]+)$/);
  if (req.method === 'PATCH' && redemptionMatch) {
    if (user.role !== 'Supervisor' && user.role !== 'Administrator' && user.role !== 'Collector') fail(403, 'Your account cannot fulfill redemptions.');
    const body = await bodyJson(req);
    if (body.status !== 'fulfilled') fail(400, 'Status must be fulfilled.');
    const result = db.prepare("UPDATE redemptions SET status='fulfilled' WHERE id=? AND status='pending'").run(redemptionMatch[1]);
    if (!result.changes) fail(409, 'Redemption was not found or is already fulfilled.');
    return json(res, 200, { id: redemptionMatch[1], status: 'fulfilled' });
  }
  if (req.method === 'POST' && pathname === '/api/scan-bins') return json(res, 200, handleScan(user, await bodyJson(req)));
  if (req.method === 'POST' && pathname === '/api/upcycle-notifications') return json(res, 201, handleUpcycleNotice(user, await bodyJson(req)));
  return json(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveFrontend(req, res, url.pathname);
  try { await api(req, res, url.pathname); }
  catch (error) {
    if (res.headersSent) return res.end();
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status === 500) console.error('ECO-TAP API error:', error);
    json(res, status, { error: status === 500 ? 'The local demo encountered an error.' : error.message });
  }
});

const port = Number(process.env.API_PORT || 3000);
server.listen(port, '127.0.0.1', () => {
  console.log(`ECO-TAP local demo API listening at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${path.join(dataDir, 'ecotap.sqlite')}`);
  console.log(`Demo accounts: ${[...demoAccounts].join(', ')}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(() => { db.close(); process.exit(0); }); });
}
