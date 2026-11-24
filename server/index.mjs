import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
try { process.loadEnvFile(path.join(projectRoot, '.env')); } catch { /* no .env file; use real environment variables */ }

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and paste your Supabase connection string.');
  process.exit(1);
}
let dbHost;
try { dbHost = new URL(process.env.DATABASE_URL).hostname; }
catch { dbHost = ''; }
if (!dbHost.includes('.') && !['localhost', '127.0.0.1'].includes(dbHost)) {
  console.error('DATABASE_URL could not be read. If your database password has special characters (@ # / : ? %), replace them with their URL-encoded form (for example @ becomes %40), or reset the password to letters and numbers only.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: ['localhost', '127.0.0.1'].includes(dbHost) ? false : 'require',
  max: 5,
  prepare: false, // safe with Supabase's pooler in either mode
  onnotice: false,
});

try {
  await sql.unsafe(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
} catch (error) {
  console.error(`Could not set up the database at ${dbHost}: ${error.message}`);
  console.error('Check DATABASE_URL, the database password, and that your Supabase project is not paused.');
  process.exit(1);
}

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


const SUPERADMIN = { username: 'superadmin', password: 'Admin1!', name: 'Super Admin', initials: 'SA', role: 'Superadmin' };

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return { password_salt: salt, password_hash: scryptSync(password, salt, 64).toString('hex') };
}

// Tables start empty. The only row created is the superadmin account (if it does not exist yet).
async function ensureSuperadmin() {
  const [existing] = await sql`SELECT 1 AS ok FROM users WHERE username=${SUPERADMIN.username}`;
  if (existing) return;
  await sql`INSERT INTO users ${sql({
    id: randomBytes(8).toString('hex'), username: SUPERADMIN.username, ...hashPassword(SUPERADMIN.password),
    name: SUPERADMIN.name, initials: SUPERADMIN.initials, role: SUPERADMIN.role,
  })} ON CONFLICT (username) DO NOTHING`;
}
await ensureSuperadmin();

const sessions = new Map();
const loginFailures = new Map();
const cookieName = 'ecotap_session';
const ROLES = ['Collector', 'Supervisor', 'Administrator'];

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

async function sessionUser(req) {
  const token = cookieValue(req, cookieName);
  const username = sessions.get(token);
  if (!username) fail(401, 'Sign in to continue.');
  const [user] = await sql`SELECT username,name,initials,role,status FROM users WHERE username=${username}`;
  if (!user || user.status === 'terminated') fail(401, 'Session is no longer valid. Please sign in again.');
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

async function bootstrap(user) {
  const [stationRows, binRows, logRows, scheduleRows, residentRows, rewardItems, redemptionRows, staffRows, noticeRows, categoryRows, beneficiaryRows, transferRows] = await Promise.all([
    sql`SELECT * FROM stations ORDER BY id`,
    sql`SELECT * FROM bins ORDER BY station_id, section`,
    sql`SELECT * FROM logs ORDER BY "time" COLLATE "C" DESC, id DESC`,
    sql`SELECT * FROM grinding_schedules ORDER BY scheduled_for COLLATE "C" DESC`,
    sql`SELECT * FROM residents ORDER BY name`,
    sql`SELECT id,name,cost FROM rewards ORDER BY id`,
    sql`SELECT * FROM redemptions ORDER BY "time" COLLATE "C" DESC`,
    sql`SELECT * FROM staff ORDER BY id`,
    sql`SELECT id,type,to_group,title,message,"time" FROM notifications ORDER BY id DESC`,
    sql`SELECT id,name,section,points_per_kg FROM waste_categories ORDER BY id`,
    sql`SELECT * FROM beneficiaries ORDER BY name`,
    sql`SELECT * FROM waste_transfers ORDER BY dispatched_at COLLATE "C" DESC`,
  ]);
  const stations = stationRows.map((station) => {
    const bins = Object.fromEntries(binRows.filter((bin) => bin.station_id === station.id)
      .map((bin) => [bin.section, {
        label: bin.label, capacity: bin.capacity, weight: bin.weight,
        grindable: Boolean(bin.grindable), grindingStatus: bin.grinding_status,
      }]));
    return { id: station.id, location: station.location, status: station.status, lastSync: station.last_sync, depositsToday: station.deposits_today, bins };
  });
  const logs = logRows.map((row) => ({
    id: row.id, kiosk: row.kiosk, section: row.section, resident: row.resident,
    material: row.material, subtype: row.subtype, weight: row.weight,
    points: row.points, time: row.time, source: row.source,
  }));
  const grindingSchedules = scheduleRows.map(displaySchedule);
  const residents = residentRows.map((row) => ({
    id: row.id, name: row.name, points: row.points, phone: row.phone, address: row.address || '',
    nfcCardId: row.nfc_card_id || '', status: row.status || 'active', registeredAt: row.registered_at || '',
  }));
  const wasteCategories = categoryRows.map((row) => ({ id: row.id, name: row.name, section: row.section, pointsPerKg: row.points_per_kg }));
  const beneficiaries = beneficiaryRows.map((row) => ({ id: row.id, name: row.name, contact: row.contact, address: row.address }));
  const wasteTransfers = transferRows.map((row) => ({
    id: row.id, beneficiaryId: row.beneficiary_id, station: row.station, section: row.section, material: row.material,
    weight: row.weight, status: row.status, dispatchedAt: row.dispatched_at, receivedAt: row.received_at, staff: row.staff,
  }));
  const redemptions = redemptionRows.map((row) => ({
    id: row.id, resident: row.resident, items: JSON.parse(row.items), points: row.points,
    time: row.time, status: row.status, staff: row.staff,
  }));
  const staff = staffRows.map((row) => ({
    id: row.id, name: row.name, role: row.role, assignedKiosks: JSON.parse(row.assigned_kiosks), contact: row.contact,
  }));
  const notifications = noticeRows.map((row) => ({
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
  const users = user.role === 'Superadmin'
    ? (await sql`SELECT username,name,initials,role,status FROM users ORDER BY (role='Superadmin') DESC, username`).map((row) => ({ username: row.username, name: row.name, initials: row.initials, role: row.role, status: row.status }))
    : undefined;
  return { user, users, stats, stations, grindingSchedules, logs, residents, rewardItems: [...rewardItems], redemptions, notifications, staff, upcycleYield: yields, wasteCategories, beneficiaries, wasteTransfers };
}

function createId(prefix) { return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`; }

async function notify(q, type, to, title, message) {
  const [row] = await q`INSERT INTO notifications (type,to_group,title,message,"time") VALUES (${type},${to},${title},${message},${stamp()}) RETURNING id`;
  return row.id;
}

async function handleLogin(req, res, body) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 80 || password.length > 200) return json(res, 400, { error: 'Enter a valid username and password.' });
  const key = `${req.socket.remoteAddress}:${username}`;
  const failures = loginFailures.get(key) || { count: 0, until: 0 };
  if (failures.until > Date.now()) return json(res, 429, { error: 'Too many sign-in attempts. Try again in one minute.' });
  const [user] = await sql`SELECT username,password_salt,password_hash,name,initials,role,status FROM users WHERE username=${username}`;
  const provided = user ? scryptSync(password, user.password_salt, 64) : scryptSync(password, 'ecotap-invalid-user-salt', 64);
  const expected = Buffer.from(user?.password_hash || '00'.repeat(64), 'hex');
  if (!user || !timingSafeEqual(provided, expected)) {
    failures.count += 1;
    if (failures.count >= 5) { failures.count = 0; failures.until = Date.now() + 60_000; }
    loginFailures.set(key, failures);
    return json(res, 401, { error: 'Invalid username or password.' });
  }
  loginFailures.delete(key);
  if (user.status === 'terminated') return json(res, 403, { error: 'This account has been terminated. Contact the superadmin.' });
  const token = randomBytes(32).toString('hex');
  sessions.set(token, user.username);
  const cleanUser = { username: user.username, name: user.name, initials: user.initials, role: user.role };
  return json(res, 200, { user: cleanUser }, {
    'Set-Cookie': `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
  });
}

function initialsFor(name) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '??';
}

function validPassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 200) fail(400, 'Password must be 8 to 200 characters.');
  return value;
}

function validRole(value) {
  if (!ROLES.includes(value)) fail(400, `Role must be one of: ${ROLES.join(', ')}.`);
  return value;
}

async function handleUserCreate(user, body) {
  requireRole(user, ['Superadmin']);
  const username = textField(body.username, 'Username', 40).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) fail(400, 'Username may only use letters, numbers, dots, dashes and underscores.');
  const name = textField(body.name, 'Name', 100);
  const role = validRole(body.role);
  const password = validPassword(body.password);
  const [taken] = await sql`SELECT 1 AS ok FROM users WHERE username=${username}`;
  if (taken) fail(409, 'That username is already in use.');
  await sql`INSERT INTO users ${sql({ id: randomBytes(8).toString('hex'), username, ...hashPassword(password), name, initials: initialsFor(name), role })}`;
  return { username, name, initials: initialsFor(name), role };
}

async function handleUserUpdate(user, username, body) {
  requireRole(user, ['Superadmin']);
  const [target] = await sql`SELECT username,name,role FROM users WHERE username=${username}`;
  if (!target) fail(404, 'Account not found.');
  if (target.role === 'Superadmin') fail(403, 'The superadmin account cannot be edited here.');
  const changes = {};
  if (body.name !== undefined) { changes.name = textField(body.name, 'Name', 100); changes.initials = initialsFor(changes.name); }
  if (body.role !== undefined) changes.role = validRole(body.role);
  if (body.status !== undefined) {
    if (!['active', 'terminated'].includes(body.status)) fail(400, 'Status must be active or terminated.');
    changes.status = body.status;
  }
  if (body.password !== undefined) Object.assign(changes, hashPassword(validPassword(body.password)));
  if (!Object.keys(changes).length) fail(400, 'Nothing to update.');
  await sql`UPDATE users SET ${sql(changes)} WHERE username=${username}`;
  if (changes.password_hash || changes.role || changes.status === 'terminated') {
    for (const [token, name] of sessions) if (name === username) sessions.delete(token);
  }
  return { username };
}

async function handleUserDelete(user, username) {
  requireRole(user, ['Superadmin']);
  const [target] = await sql`SELECT role FROM users WHERE username=${username}`;
  if (!target) fail(404, 'Account not found.');
  if (target.role === 'Superadmin') fail(403, 'The superadmin account cannot be deleted.');
  await sql`DELETE FROM users WHERE username=${username}`;
  for (const [token, name] of sessions) if (name === username) sessions.delete(token);
  return { username, deleted: true };
}

async function handleScheduleCreate(user, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  const station = textField(body.station, 'Station', 20);
  const [stationRow] = await sql`SELECT id FROM stations WHERE id=${station}`;
  if (!stationRow) fail(400, 'Choose a valid kiosk station.');
  if (!Array.isArray(body.bins) || body.bins.length < 1 || body.bins.length > 2 || body.bins.some((bin) => !['b1', 'b2'].includes(bin)) || new Set(body.bins).size !== body.bins.length) fail(400, 'Choose one or more valid grindable sections.');
  const scheduledFor = textField(body.scheduledFor, 'Schedule time', 32).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(scheduledFor) || Number.isNaN(Date.parse(scheduledFor.replace(' ', 'T')))) fail(400, 'Enter a valid date and time.');
  const assignedStaff = textField(body.assignedStaff, 'Assigned staff', 100);
  const [staffRow] = await sql`SELECT id FROM staff WHERE name=${assignedStaff}`;
  if (!staffRow) fail(400, 'Choose a staff member from the list.');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  const id = createId('G');
  await sql.begin(async (tx) => {
    await tx`INSERT INTO grinding_schedules (id,station,bins_json,scheduled_for,status,assigned_staff,note) VALUES (${id},${station},${JSON.stringify(body.bins)},${scheduledFor},'scheduled',${assignedStaff},${note || `Scheduled by ${user.name}`})`;
    await notify(tx, 'info', 'residents+partner', `Grinding Scheduled — ${station}`, `Grinding of ${body.bins.join(', ')} at ${station} is scheduled for ${scheduledFor}. Partner company has been notified to prepare collection.`);
  });
  const [row] = await sql`SELECT * FROM grinding_schedules WHERE id=${id}`;
  return displaySchedule(row);
}

async function handleScheduleUpdate(user, id, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  if (!['completed', 'missed'].includes(body.status)) fail(400, 'Status must be completed or missed.');
  await sql.begin(async (tx) => {
    const [schedule] = await tx`SELECT * FROM grinding_schedules WHERE id=${id} FOR UPDATE`;
    if (!schedule) fail(404, 'Schedule not found.');
    if (schedule.status !== 'scheduled') fail(409, 'Only scheduled work can be updated.');
    await tx`UPDATE grinding_schedules SET status=${body.status} WHERE id=${id}`;
    if (body.status === 'completed') {
      for (const section of JSON.parse(schedule.bins_json)) {
        await tx`UPDATE bins SET capacity=0,weight=0,grinding_status='idle' WHERE station_id=${schedule.station} AND section=${section}`;
      }
      await notify(tx, 'info', 'partner+residents', `Grinding Completed — ${schedule.station}`, 'Grinded plastic is ready for collection. Partner company notified. Residents can view new upcycled output estimates.');
    }
  });
  const [row] = await sql`SELECT * FROM grinding_schedules WHERE id=${id}`;
  return displaySchedule(row);
}

async function handleRedemption(user, body) {
  const residentId = textField(body.residentId, 'Resident ID', 30);
  const idempotencyKey = textField(body.idempotencyKey, 'Idempotency key', 100);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 12) fail(400, 'Select at least one reward.');
  const [existing] = await sql`SELECT id,points FROM redemptions WHERE idempotency_key=${idempotencyKey}`;
  if (existing) return { id: existing.id, duplicate: true, points: existing.points };
  const [resident] = await sql`SELECT id,points,status FROM residents WHERE id=${residentId}`;
  if (!resident) fail(404, 'Resident not found.');
  if (resident.status === 'terminated') fail(403, 'This resident account has been terminated.');
  const combined = new Map();
  for (const item of body.items) {
    const id = textField(item.id, 'Reward ID', 30);
    const qty = Number(item.qty);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) fail(400, 'Reward quantity must be between 1 and 99.');
    combined.set(id, (combined.get(id) || 0) + qty);
  }
  const rewards = [];
  for (const [id, qty] of combined) {
    const [reward] = await sql`SELECT id,name,cost FROM rewards WHERE id=${id}`;
    if (!reward) fail(400, 'A selected reward is not available.');
    rewards.push({ id, name: reward.name, qty, cost: reward.cost });
  }
  const total = rewards.reduce((sum, reward) => sum + reward.qty * reward.cost, 0);
  const redemptionId = createId('TXN');
  return sql.begin(async (tx) => {
    // Lock the resident row so two redemptions can't spend the same points at once.
    const [current] = await tx`SELECT points FROM residents WHERE id=${residentId} FOR UPDATE`;
    const [prior] = await tx`SELECT id,points FROM redemptions WHERE idempotency_key=${idempotencyKey}`;
    if (prior) return { id: prior.id, duplicate: true, points: prior.points };
    if (current.points < total) fail(409, 'Resident does not have enough points.');
    const now = stamp();
    await tx`UPDATE residents SET points=points-${total} WHERE id=${residentId}`;
    await tx`INSERT INTO points_ledger (resident_id,delta,reason,reference_id,created_at) VALUES (${residentId},${-total},'reward_redemption',${redemptionId},${now})`;
    await tx`INSERT INTO redemptions (id,resident,items,points,"time",status,staff,idempotency_key) VALUES (${redemptionId},${residentId},${JSON.stringify(rewards.map(({ id, name, qty }) => ({ id, name, qty })))},${total},${now},'pending',${user.name},${idempotencyKey})`;
    return { id: redemptionId, duplicate: false, points: total };
  });
}

async function handleScan(user, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  const scanId = textField(body.scanId, 'Scan ID', 100);
  const [prior] = await sql`SELECT results_json FROM scan_requests WHERE scan_id=${scanId}`;
  if (prior) return { ...JSON.parse(prior.results_json), duplicate: true };
  const full = await sql`SELECT s.id AS station,s.location,b.section,b.label FROM bins b JOIN stations s ON s.id=b.station_id WHERE b.capacity>=100 ORDER BY s.id,b.section`;
  return sql.begin(async (tx) => {
    const alerts = [];
    for (const bin of full) {
      const title = `Bin Full — ${bin.station} · ${bin.section.toUpperCase()}`;
      const [alreadyReported] = await tx`SELECT id FROM notifications WHERE type='crit' AND title=${title} AND substr("time",1,10)=substr(${stamp()}::text,1,10)`;
      if (!alreadyReported) {
        await notify(tx, 'crit', 'residents+partner', title, `${bin.label} bin at ${bin.location} is full. Schedule grinding and coordinate collection with the partner company.`);
        alerts.push(title);
      }
    }
    const result = { scanId, fullBins: full.length, alertsCreated: alerts.length, alerts, duplicate: false };
    await tx`INSERT INTO scan_requests (scan_id,results_json,created_at) VALUES (${scanId},${JSON.stringify(result)},${stamp()})`;
    return result;
  });
}

async function handleUpcycleNotice(user, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  if (!['residents', 'partner'].includes(body.target)) fail(400, 'Choose residents or partner as the target.');
  const totals = await sql`SELECT section,SUM(weight) AS kg FROM bins WHERE grindable=1 GROUP BY section`;
  const amount = totals.reduce((sum, row) => sum + row.kg, 0);
  if (amount <= 0) fail(409, 'There is no grindable plastic available yet.');
  const bySection = Object.fromEntries(totals.map((row) => [row.section, row.kg]));
  const products = yields.map((item) => ({ ...item, count: Math.floor(amount / item.kgPerUnit) })).filter((item) => item.count > 0);
  const summary = products.map((item) => `${item.count} ${item.product}`).join(', ');
  const title = body.target === 'partner' ? `Grindable Batch Ready — ${amount.toFixed(1)} kg` : 'New Upcycled Output Estimate';
  const message = body.target === 'partner'
    ? `Partner GreenCycle Recycling Corp.: ${amount.toFixed(1)} kg of grindable plastic (PET ${(bySection.b1 || 0).toFixed(1)} kg, HDPE ${(bySection.b2 || 0).toFixed(1)} kg) is available for pickup at QC Hall kiosks.`
    : `Based on ${amount.toFixed(1)} kg of grindable plastic currently collected, approximately ${summary} can be produced. Thank you for segregating!`;
  const id = await notify(sql, 'info', body.target, title, message);
  return { id, title, target: body.target };
}

// ---------------------------------------------------------------------------
// Kiosk / resident mobile API (/api/kiosk/*)
// The Android kiosk app is not a staff user. It authenticates the device with a shared
// key (KIOSK_API_KEY, header X-Kiosk-Key) and each resident with NFC card + 6-digit PIN,
// which returns a short-lived bearer token.
// ---------------------------------------------------------------------------
const KIOSK_BARANGAY = 'Barangay Central, Quezon City';
const RESIDENT_SESSION_MS = 15 * 60_000;
const residentSessions = new Map(); // token -> { id, expires }
const pinFailures = new Map();

function digest(value) { return createHash('sha256').update(String(value)).digest(); }

function requireKioskKey(req) {
  const expected = process.env.KIOSK_API_KEY || '';
  if (!expected) fail(503, 'The kiosk API is disabled. Set KIOSK_API_KEY in .env and restart the server.');
  if (!timingSafeEqual(digest(req.headers['x-kiosk-key'] || ''), digest(expected))) fail(401, 'This device is not authorised.');
}

function normalizeCard(value) {
  const card = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9-]{4,40}$/.test(card)) fail(400, 'Card ID is not valid.');
  return card.startsWith('ECO-TAP-') ? card : `ECO-TAP-${card}`;
}

function validPin(value) {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) fail(400, 'PIN must be exactly 6 digits.');
  return value;
}

function pinRecord(pin) {
  const salt = randomBytes(16).toString('hex');
  return { pin_salt: salt, pin_hash: scryptSync(pin, salt, 64).toString('hex') };
}

function stampToMs(value) {
  const ms = Date.parse(String(value).replace(' ', 'T'));
  return Number.isNaN(ms) ? Date.now() : ms;
}

async function residentView(id) {
  const [row] = await sql`SELECT r.id,r.name,r.address,r.points,r.nfc_card_id,r.registered_at,
    COALESCE((SELECT SUM(weight) FROM logs WHERE resident=r.id),0) AS kg FROM residents r WHERE r.id=${id}`;
  if (!row) fail(404, 'Resident not found.');
  return {
    id: row.id, nfcCardId: row.nfc_card_id, fullName: row.name, address: row.address,
    barangay: KIOSK_BARANGAY, ecoPoints: row.points, totalWasteKg: Number(Number(row.kg).toFixed(2)),
    registeredDate: row.registered_at || '',
  };
}

function residentFromToken(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = residentSessions.get(token);
  if (!session || session.expires < Date.now()) { residentSessions.delete(token); fail(401, 'Session expired. Tap your card again.'); }
  session.expires = Date.now() + RESIDENT_SESSION_MS;
  return { id: session.id, token };
}

async function kioskLogin(body) {
  const card = normalizeCard(body.nfcCardId);
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const failures = pinFailures.get(card) || { count: 0, until: 0 };
  if (failures.until > Date.now()) fail(429, 'Too many wrong PINs. Try again in one minute.');
  const [row] = await sql`SELECT id,pin_salt,pin_hash,status FROM residents WHERE nfc_card_id=${card}`;
  const provided = scryptSync(pin, row?.pin_salt || 'ecotap-invalid-card-salt', 64);
  const expected = Buffer.from(row?.pin_hash || '00'.repeat(64), 'hex');
  if (!row || !row.pin_hash || !timingSafeEqual(provided, expected)) {
    failures.count += 1;
    if (failures.count >= 5) { failures.count = 0; failures.until = Date.now() + 60_000; }
    pinFailures.set(card, failures);
    fail(401, 'Invalid 6-digit PIN. Please try again.');
  }
  pinFailures.delete(card);
  if (row.status === 'terminated') fail(403, 'This card account has been terminated. Please see the Waste Management Department.');
  const token = randomBytes(32).toString('hex');
  residentSessions.set(token, { id: row.id, expires: Date.now() + RESIDENT_SESSION_MS });
  return { token, resident: await residentView(row.id) };
}

async function kioskRegister(body) {
  const card = normalizeCard(body.nfcCardId);
  const name = textField(body.fullName, 'Full name', 100);
  const address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
  const pin = pinRecord(validPin(body.pin));
  const id = createId('R');
  await sql.begin(async (tx) => {
    const [taken] = await tx`SELECT 1 AS ok FROM residents WHERE nfc_card_id=${card}`;
    if (taken) fail(409, 'This card is already registered.');
    const now = stamp();
    await tx`INSERT INTO residents (id,name,points,phone,nfc_card_id,pin_salt,pin_hash,address,registered_at)
      VALUES (${id},${name},0,'',${card},${pin.pin_salt},${pin.pin_hash},${address},${now.slice(0, 10)})`;
  });
  return { resident: await residentView(id) };
}

async function kioskHistory(residentId) {
  const [logRows, redemptionRows] = await Promise.all([
    sql`SELECT * FROM logs WHERE resident=${residentId} ORDER BY "time" COLLATE "C" DESC, id DESC LIMIT 50`,
    sql`SELECT * FROM redemptions WHERE resident=${residentId} ORDER BY "time" COLLATE "C" DESC LIMIT 50`,
  ]);
  const resident = await residentView(residentId);
  const deposits = logRows.map((row) => ({
    id: String(row.id), userId: residentId, userName: resident.fullName, nfcCardId: resident.nfcCardId,
    categoryId: row.material, categoryName: row.subtype, weightKg: row.weight, pointsEarned: row.points, timestamp: stampToMs(row.time),
  }));
  const redemptions = redemptionRows.map((row) => redemptionView(row, resident));
  return { resident, deposits, redemptions };
}

function redemptionView(row, resident) {
  const items = JSON.parse(row.items);
  return {
    id: row.id, userId: resident.id, userName: resident.fullName, nfcCardId: resident.nfcCardId,
    itemId: items[0]?.id || '', itemTitle: items.map((item) => (item.qty > 1 ? `${item.name} x${item.qty}` : item.name)).join(', '),
    pointsDeducted: row.points, timestamp: stampToMs(row.time),
  };
}

async function kioskApi(req, res, pathname) {
  const method = req.method;
  // The machine controller (load cell + optical sensor) has its own per-station key, not the tablet's.
  if (method === 'POST' && pathname === '/api/kiosk/device/deposit-event') return json(res, 201, await handleDeviceDepositEvent(req, await bodyJson(req)));
  requireKioskKey(req);
  if (method === 'GET' && pathname === '/api/kiosk/health') return json(res, 200, { ok: true });
  if (method === 'GET' && pathname === '/api/kiosk/rewards') {
    const rows = await sql`SELECT id,name,cost FROM rewards ORDER BY cost, id`;
    return json(res, 200, { rewards: rows.map((row) => ({ id: row.id, title: row.name, description: '', pointsCost: row.cost, category: 'Reward', iconName: 'gift' })) });
  }
  if (method === 'GET' && pathname === '/api/kiosk/categories') {
    const rows = await sql`SELECT id,name,section,points_per_kg FROM waste_categories ORDER BY id`;
    return json(res, 200, { categories: rows.map((row) => ({ id: row.id, name: row.name, section: row.section, pointsPerKg: row.points_per_kg })) });
  }
  if (method === 'GET' && pathname === '/api/kiosk/stations') {
    const [stations, bins] = await Promise.all([
      sql`SELECT id,location,status FROM stations ORDER BY id`,
      sql`SELECT station_id,capacity FROM bins`,
    ]);
    return json(res, 200, { stations: stations.map((row) => ({
      id: row.id, name: row.location, status: row.status,
      fill: Math.round(Math.max(0, ...bins.filter((bin) => bin.station_id === row.id).map((bin) => Number(bin.capacity)))),
    })) });
  }
  if (method === 'POST' && pathname === '/api/kiosk/card') {
    const card = normalizeCard((await bodyJson(req)).nfcCardId);
    const [row] = await sql`SELECT name FROM residents WHERE nfc_card_id=${card}`;
    return json(res, 200, { nfcCardId: card, registered: Boolean(row), fullName: row?.name || null, barangay: KIOSK_BARANGAY });
  }
  if (method === 'POST' && pathname === '/api/kiosk/register') return json(res, 201, await kioskRegister(await bodyJson(req)));
  if (method === 'POST' && pathname === '/api/kiosk/login') return json(res, 200, await kioskLogin(await bodyJson(req)));

  const { id, token } = residentFromToken(req);
  const [account] = await sql`SELECT status FROM residents WHERE id=${id}`;
  if (!account || account.status === 'terminated') { residentSessions.delete(token); fail(401, 'Session expired. Tap your card again.'); }
  if (method === 'POST' && pathname === '/api/kiosk/logout') { residentSessions.delete(token); return json(res, 200, { ok: true }); }
  if (method === 'GET' && pathname === '/api/kiosk/me') return json(res, 200, await kioskHistory(id));
  if (method === 'PUT' && pathname === '/api/kiosk/pin') {
    const pin = pinRecord(validPin((await bodyJson(req)).pin));
    await sql`UPDATE residents SET pin_salt=${pin.pin_salt}, pin_hash=${pin.pin_hash} WHERE id=${id}`;
    return json(res, 200, { ok: true });
  }
  if (method === 'POST' && pathname === '/api/kiosk/redeem') {
    const body = await bodyJson(req);
    const result = await handleRedemption({ name: 'Kiosk app' }, {
      residentId: id, idempotencyKey: body.idempotencyKey, items: [{ id: body.itemId, qty: 1 }],
    });
    const [row] = await sql`SELECT * FROM redemptions WHERE id=${result.id}`;
    const resident = await residentView(id);
    return json(res, 201, { redemption: redemptionView(row, resident), resident, duplicate: result.duplicate });
  }
  // Residents can no longer post a weight. They open a session; the machine reports the measurement.
  if (method === 'POST' && pathname === '/api/kiosk/deposit') fail(410, 'Deposits are measured by the machine. Start a deposit session instead.');
  if (method === 'POST' && pathname === '/api/kiosk/deposit/start') return json(res, 201, await handleDepositStart(id, await bodyJson(req)));
  const depositMatch = pathname.match(/^\/api\/kiosk\/deposit\/(DS-[A-Z0-9]+)(\/cancel)?$/);
  if (depositMatch && method === 'GET' && !depositMatch[2]) return json(res, 200, await handleDepositStatus(id, depositMatch[1]));
  if (depositMatch && method === 'POST' && depositMatch[2]) return json(res, 200, await handleDepositCancel(id, depositMatch[1]));
  return json(res, 404, { error: 'API route not found.' });
}

// ---------------------------------------------------------------------------
// Deposit Segregated Waste: select category -> weigh -> calculate and award points.
// ---------------------------------------------------------------------------
const BIN_CAPACITY_KG = Number(process.env.BIN_CAPACITY_KG) || 50; // kg that equals a 100% full bin
const MAX_DEPOSIT_KG = 20;

const DEPOSIT_SESSION_MS = 3 * 60_000;
const deviceEventTimes = new Map(); // station -> recent event timestamps (simple rate limit)

async function kioskStation(tx) {
  const wanted = process.env.KIOSK_STATION_ID || '';
  const [station] = wanted
    ? await tx`SELECT id FROM stations WHERE id=${wanted}`
    : await tx`SELECT id FROM stations ORDER BY id LIMIT 1`;
  if (!station) fail(409, 'No kiosk station is set up yet. Please see the Waste Management Department.');
  return station;
}

// Select Waste Category: the resident says what they are about to put in. No weight is accepted here.
async function handleDepositStart(residentId, body) {
  const categoryId = textField(body.categoryId, 'Waste category', 30);
  return sql.begin(async (tx) => {
    const [category] = await tx`SELECT id,name,section FROM waste_categories WHERE id=${categoryId}`;
    if (!category) fail(400, 'Choose a valid waste category.');
    const [resident] = await tx`SELECT status FROM residents WHERE id=${residentId} FOR UPDATE`;
    if (!resident) fail(404, 'Resident not found.');
    if (resident.status === 'terminated') fail(403, 'This card account has been terminated.');
    const station = await kioskStation(tx);
    const [bin] = await tx`SELECT capacity FROM bins WHERE station_id=${station.id} AND section=${category.section}`;
    if (bin && bin.capacity >= 100) fail(409, `The ${category.name} bin is full. Please wait for collection.`);
    await tx`UPDATE deposit_sessions SET status='expired' WHERE status='open' AND expires_ms < ${Date.now()}`;
    const [busyRow] = await tx`SELECT id FROM deposit_sessions WHERE station_id=${station.id} AND status='open' AND resident_id<>${residentId}`;
    if (busyRow) fail(409, 'The machine is in use. Please wait a moment.');
    await tx`UPDATE deposit_sessions SET status='cancelled' WHERE resident_id=${residentId} AND status='open'`;
    const id = createId('DS');
    const expiresMs = Date.now() + DEPOSIT_SESSION_MS;
    await tx`INSERT INTO deposit_sessions (id,resident_id,station_id,category_id,status,created_at,expires_ms)
      VALUES (${id},${residentId},${station.id},${category.id},'open',${stamp()},${expiresMs})`;
    return { sessionId: id, status: 'open', stationId: station.id, categoryId: category.id, categoryName: category.name, expiresAt: expiresMs };
  });
}

// Weigh Scale -> Calculate and Award Points result, as reported by the machine.
async function handleDepositStatus(residentId, sessionId) {
  const [row] = await sql`SELECT * FROM deposit_sessions WHERE id=${sessionId} AND resident_id=${residentId}`;
  if (!row) fail(404, 'Deposit session not found.');
  let status = row.status;
  if (status === 'open' && Number(row.expires_ms) < Date.now()) {
    await sql`UPDATE deposit_sessions SET status='expired' WHERE id=${sessionId} AND status='open'`;
    status = 'expired';
  }
  const out = { sessionId: row.id, status, categoryId: row.category_id, expiresAt: Number(row.expires_ms) };
  if (status === 'completed' && row.result_json) {
    const resident = await residentView(residentId);
    out.deposit = { ...JSON.parse(row.result_json), userId: resident.id, userName: resident.fullName, nfcCardId: resident.nfcCardId };
    out.resident = resident;
  }
  return out;
}

async function handleDepositCancel(residentId, sessionId) {
  await sql`UPDATE deposit_sessions SET status='cancelled' WHERE id=${sessionId} AND resident_id=${residentId} AND status='open'`;
  return { ok: true };
}

function requireDeviceKey(req) {
  const keys = new Map(String(process.env.DEVICE_KEYS || '').split(',').map((pair) => pair.trim()).filter(Boolean)
    .map((pair) => { const i = pair.indexOf(':'); return [pair.slice(0, i).trim(), pair.slice(i + 1).trim()]; }));
  if (!keys.size) fail(503, 'Machine deposit events are disabled. Set DEVICE_KEYS in .env and restart the server.');
  const station = String(req.headers['x-station-id'] || '').trim();
  const expected = keys.get(station) || '';
  const ok = timingSafeEqual(digest(req.headers['x-device-key'] || ''), digest(expected || randomBytes(16)));
  if (!expected || !ok) fail(401, 'This machine is not authorised.');
  const now = Date.now();
  const recent = (deviceEventTimes.get(station) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) fail(429, 'Too many machine events. Slow down.');
  recent.push(now);
  deviceEventTimes.set(station, recent);
  return station;
}

// The ONLY place a deposit is logged. Weight and material come from the machine, never from a resident.
async function handleDeviceDepositEvent(req, body) {
  const stationId = requireDeviceKey(req);
  const eventId = textField(body.eventId, 'Event ID', 80);
  const idempotencyKey = `machine:${stationId}:${eventId}`;
  const raw = Number(body.weightKg);
  if (!Number.isFinite(raw) || raw < 0.01 || raw > MAX_DEPOSIT_KG) fail(400, `Measured weight must be between 0.01 and ${MAX_DEPOSIT_KG} kg.`);
  const weightKg = Math.round(raw * 100) / 100;
  const detected = textField(body.material, 'Detected material', 30);
  const [category] = await sql`SELECT id,name,section,points_per_kg FROM waste_categories WHERE id=${detected}`;
  if (!category) fail(400, 'Unknown detected material.');
  const points = Math.round(weightKg * category.points_per_kg);
  if (points < 1) fail(400, 'That weight is too small to earn points.');
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  return sql.begin(async (tx) => {
    const [prior] = await tx`SELECT id,resident,points,weight FROM logs WHERE idempotency_key=${idempotencyKey}`;
    if (prior) return { duplicate: true, depositId: String(prior.id), residentId: prior.resident, pointsEarned: prior.points, weightKg: prior.weight };
    const [session] = sessionId
      ? await tx`SELECT * FROM deposit_sessions WHERE id=${sessionId} AND station_id=${stationId} FOR UPDATE`
      : await tx`SELECT * FROM deposit_sessions WHERE station_id=${stationId} AND status='open' ORDER BY expires_ms DESC LIMIT 1 FOR UPDATE`;
    if (!session || session.status !== 'open') fail(409, 'No resident is signed in for a deposit at this machine.');
    if (Number(session.expires_ms) < Date.now()) fail(409, 'The deposit session has expired.');
    const residentId = session.resident_id;
    const [resident] = await tx`SELECT id,status FROM residents WHERE id=${residentId} FOR UPDATE`;
    if (!resident) fail(404, 'Resident not found.');
    if (resident.status === 'terminated') fail(403, 'This card account has been terminated.');
    const [station] = await tx`SELECT id FROM stations WHERE id=${stationId}`;
    if (!station) fail(404, 'Unknown station.');
    const [bin] = await tx`SELECT weight,capacity FROM bins WHERE station_id=${stationId} AND section=${category.section} FOR UPDATE`;
    if (bin && bin.capacity >= 100) fail(409, `The ${category.name} bin is full.`);
    await tx`LOCK TABLE logs IN SHARE ROW EXCLUSIVE MODE`;
    const [{ next }] = await tx`SELECT COALESCE(MAX(id),0)+1 AS next FROM logs`;
    const now = stamp();
    await tx`INSERT INTO logs (id,kiosk,section,resident,material,subtype,weight,points,"time",source,idempotency_key)
      VALUES (${next},${stationId},${category.section},${residentId},${category.id},${category.name},${weightKg},${points},${now},'machine',${idempotencyKey})`;
    await tx`UPDATE residents SET points=points+${points} WHERE id=${residentId}`;
    await tx`INSERT INTO points_ledger (resident_id,delta,reason,reference_id,created_at) VALUES (${residentId},${points},'waste_deposit',${`DEP-${next}`},${now})`;
    if (bin) {
      const newWeight = bin.weight + weightKg;
      await tx`UPDATE bins SET weight=${newWeight},capacity=${Math.min(100, Math.round((newWeight / BIN_CAPACITY_KG) * 1000) / 10)} WHERE station_id=${stationId} AND section=${category.section}`;
    }
    await tx`UPDATE stations SET deposits_today=deposits_today+1,last_sync=${now} WHERE id=${stationId}`;
    const view = { id: String(next), categoryId: category.id, categoryName: category.name, weightKg, pointsEarned: points, timestamp: stampToMs(now), categoryMismatch: session.category_id !== category.id };
    await tx`UPDATE deposit_sessions SET status='completed',result_json=${JSON.stringify(view)} WHERE id=${session.id}`;
    return { duplicate: false, depositId: view.id, residentId, pointsEarned: points, weightKg, material: category.id, categoryMismatch: view.categoryMismatch };
  });
}

// ---------------------------------------------------------------------------
// Monitor Waste Volume (daily / weekly / monthly) and View Waste Analytics.
// ---------------------------------------------------------------------------
function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function weekStart(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}

async function handleAnalytics() {
  const [rows, transfers, [{ count: residentCount }]] = await Promise.all([
    sql`SELECT "time",material,subtype,weight,points FROM logs`,
    sql`SELECT material,weight,status FROM waste_transfers`,
    sql`SELECT COUNT(*)::int AS count FROM residents`,
  ]);
  const now = new Date();
  const today = localDay(now);
  const buckets = { daily: [], weekly: [], monthly: [] };
  for (let i = 13; i >= 0; i -= 1) { const d = new Date(now); d.setDate(d.getDate() - i); buckets.daily.push(localDay(d)); }
  for (let i = 11; i >= 0; i -= 1) { const d = new Date(`${weekStart(today)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7 * i); buckets.weekly.push(d.toISOString().slice(0, 10)); }
  for (let i = 11; i >= 0; i -= 1) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.monthly.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  const make = (keys) => new Map(keys.map((key) => [key, { key, kg: 0, points: 0, deposits: 0 }]));
  const maps = { daily: make(buckets.daily), weekly: make(buckets.weekly), monthly: make(buckets.monthly) };
  const byCategory = new Map();
  const totals = { kg: 0, points: 0, deposits: 0 };
  for (const row of rows) {
    const day = String(row.time).slice(0, 10);
    const keys = { daily: day, weekly: /^\d{4}-\d{2}-\d{2}$/.test(day) ? weekStart(day) : '', monthly: day.slice(0, 7) };
    for (const [period, key] of Object.entries(keys)) {
      const bucket = maps[period].get(key);
      if (bucket) { bucket.kg += row.weight; bucket.points += row.points; bucket.deposits += 1; }
    }
    const cat = byCategory.get(row.material) || { material: row.material, name: row.subtype, kg: 0, points: 0, deposits: 0 };
    cat.kg += row.weight; cat.points += row.points; cat.deposits += 1;
    byCategory.set(row.material, cat);
    totals.kg += row.weight; totals.points += row.points; totals.deposits += 1;
  }
  const round = (item) => ({ ...item, kg: Number(item.kg.toFixed(2)) });
  const received = transfers.filter((t) => t.status === 'received');
  const pending = transfers.filter((t) => t.status !== 'received');
  const sum = (list) => Number(list.reduce((n, t) => n + t.weight, 0).toFixed(2));
  return {
    periods: Object.fromEntries(Object.entries(maps).map(([period, map]) => [period, [...map.values()].map(round)])),
    byCategory: [...byCategory.values()].map(round).sort((a, b) => b.kg - a.kg),
    totals: { ...totals, kg: Number(totals.kg.toFixed(2)), residents: residentCount },
    beneficiaries: { receivedKg: sum(received), pendingKg: sum(pending), receivedCount: received.length, pendingCount: pending.length },
  };
}

// ---------------------------------------------------------------------------
// Monitor User Accounts (residents): view / modify / terminate / delete.
// Staff sign-ins are managed separately by the superadmin (/api/users).
// ---------------------------------------------------------------------------
async function handleResidentUpdate(user, id, body) {
  requireRole(user, ['Administrator', 'Superadmin']);
  const [target] = await sql`SELECT id FROM residents WHERE id=${id}`;
  if (!target) fail(404, 'Resident not found.');
  const changes = {};
  if (body.name !== undefined) changes.name = textField(body.name, 'Name', 100);
  if (body.address !== undefined) changes.address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : fail(400, 'Address must be text.');
  if (body.phone !== undefined) changes.phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : fail(400, 'Phone must be text.');
  if (body.status !== undefined) {
    if (!['active', 'terminated'].includes(body.status)) fail(400, 'Status must be active or terminated.');
    changes.status = body.status;
  }
  if (body.pin !== undefined) Object.assign(changes, pinRecord(validPin(body.pin)));
  if (!Object.keys(changes).length) fail(400, 'Nothing to update.');
  await sql`UPDATE residents SET ${sql(changes)} WHERE id=${id}`;
  if (changes.status === 'terminated' || changes.pin_hash) {
    for (const [token, session] of residentSessions) if (session.id === id) residentSessions.delete(token);
  }
  return { id };
}

async function handleResidentDelete(user, id) {
  requireRole(user, ['Administrator', 'Superadmin']);
  const [target] = await sql`SELECT id FROM residents WHERE id=${id}`;
  if (!target) fail(404, 'Resident not found.');
  // Collection logs stay (waste volume history is still valid); the account, ledger and redemptions go.
  await sql.begin(async (tx) => {
    await tx`DELETE FROM points_ledger WHERE resident_id=${id}`;
    await tx`DELETE FROM redemptions WHERE resident=${id}`;
    await tx`DELETE FROM residents WHERE id=${id}`;
  });
  for (const [token, session] of residentSessions) if (session.id === id) residentSessions.delete(token);
  return { id, deleted: true };
}

// ---------------------------------------------------------------------------
// Receive Collected Waste: beneficiaries receive waste taken from a kiosk bin.
// ---------------------------------------------------------------------------
async function handleBeneficiaryCreate(user, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  const id = createId('B');
  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 100) : '';
  const address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
  await sql`INSERT INTO beneficiaries (id,name,contact,address) VALUES (${id},${textField(body.name, 'Name', 100)},${contact},${address})`;
  return { id };
}

async function handleTransferCreate(user, body) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  const idempotencyKey = textField(body.idempotencyKey, 'Idempotency key', 100);
  const [existing] = await sql`SELECT id FROM waste_transfers WHERE idempotency_key=${idempotencyKey}`;
  if (existing) return { id: existing.id, duplicate: true };
  const beneficiaryId = textField(body.beneficiaryId, 'Beneficiary', 30);
  const station = textField(body.station, 'Station', 20);
  const section = textField(body.section, 'Section', 20);
  const id = createId('WT');
  await sql.begin(async (tx) => {
    const [beneficiary] = await tx`SELECT name FROM beneficiaries WHERE id=${beneficiaryId}`;
    if (!beneficiary) fail(400, 'Choose a valid beneficiary.');
    const [bin] = await tx`SELECT label,weight FROM bins WHERE station_id=${station} AND section=${section} FOR UPDATE`;
    if (!bin) fail(400, 'Choose a valid kiosk bin.');
    // The handover is the weight the bin's load cell reports. Staff cannot type a different number.
    const weight = Math.round(bin.weight * 100) / 100;
    if (!(weight > 0)) fail(409, 'That bin is empty.');
    await tx`UPDATE bins SET weight=0,capacity=0 WHERE station_id=${station} AND section=${section}`;
    await tx`INSERT INTO waste_transfers (id,beneficiary_id,station,section,material,weight,status,dispatched_at,staff,idempotency_key)
      VALUES (${id},${beneficiaryId},${station},${section},${bin.label},${weight},'dispatched',${stamp()},${user.name},${idempotencyKey})`;
    await notify(tx, 'info', 'beneficiaries', `Waste Dispatched — ${beneficiary.name}`, `${weight.toFixed(1)} kg of ${bin.label} from ${station} is on its way to ${beneficiary.name}.`);
  });
  return { id, duplicate: false };
}

async function handleTransferReceive(user, id) {
  requireRole(user, ['Supervisor', 'Administrator', 'Superadmin']);
  await sql.begin(async (tx) => {
    const [transfer] = await tx`SELECT t.status,t.weight,t.material,b.name FROM waste_transfers t JOIN beneficiaries b ON b.id=t.beneficiary_id WHERE t.id=${id} FOR UPDATE OF t`;
    if (!transfer) fail(404, 'Transfer not found.');
    if (transfer.status === 'received') fail(409, 'This transfer is already marked received.');
    await tx`UPDATE waste_transfers SET status='received',received_at=${stamp()} WHERE id=${id}`;
    await notify(tx, 'info', 'residents', `Waste Received — ${transfer.name}`, `${transfer.name} received ${transfer.weight.toFixed(1)} kg of ${transfer.material}. Thank you for segregating!`);
  });
  return { id, status: 'received' };
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
  if (req.method === 'GET' && pathname === '/api/health') {
    await sql`SELECT 1`;
    return json(res, 200, { ok: true, mode: 'supabase-postgres' });
  }
  if (req.method === 'POST' && pathname === '/api/login') return handleLogin(req, res, await bodyJson(req));
  if (req.method === 'POST' && pathname === '/api/logout') {
    const token = cookieValue(req, cookieName);
    sessions.delete(token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
  }
  if (pathname.startsWith('/api/kiosk/')) return kioskApi(req, res, pathname);
  const user = await sessionUser(req);
  if (req.method === 'GET' && pathname === '/api/bootstrap') return json(res, 200, await bootstrap(user));
  if (req.method === 'POST' && pathname === '/api/users') return json(res, 201, { user: await handleUserCreate(user, await bodyJson(req)) });
  const userMatch = pathname.match(/^\/api\/users\/([a-z0-9._-]+)$/);
  if (req.method === 'PATCH' && userMatch) return json(res, 200, await handleUserUpdate(user, userMatch[1], await bodyJson(req)));
  if (req.method === 'DELETE' && userMatch) return json(res, 200, await handleUserDelete(user, userMatch[1]));
  if (req.method === 'GET' && pathname === '/api/analytics') return json(res, 200, await handleAnalytics());
  const residentMatch = pathname.match(/^\/api\/residents\/([A-Za-z0-9-]+)$/);
  if (req.method === 'PATCH' && residentMatch) return json(res, 200, await handleResidentUpdate(user, residentMatch[1], await bodyJson(req)));
  if (req.method === 'DELETE' && residentMatch) return json(res, 200, await handleResidentDelete(user, residentMatch[1]));
  if (req.method === 'POST' && pathname === '/api/beneficiaries') return json(res, 201, await handleBeneficiaryCreate(user, await bodyJson(req)));
  if (req.method === 'POST' && pathname === '/api/waste-transfers') return json(res, 201, await handleTransferCreate(user, await bodyJson(req)));
  const transferMatch = pathname.match(/^\/api\/waste-transfers\/([A-Za-z0-9-]+)\/receive$/);
  if (req.method === 'POST' && transferMatch) return json(res, 200, await handleTransferReceive(user, transferMatch[1]));
  if (req.method === 'POST' && pathname === '/api/grinding-schedules') return json(res, 201, { schedule: await handleScheduleCreate(user, await bodyJson(req)) });
  const scheduleMatch = pathname.match(/^\/api\/grinding-schedules\/([A-Za-z0-9-]+)$/);
  if (req.method === 'PATCH' && scheduleMatch) return json(res, 200, { schedule: await handleScheduleUpdate(user, scheduleMatch[1], await bodyJson(req)) });
  if (req.method === 'POST' && pathname === '/api/redemptions') return json(res, 201, { redemption: await handleRedemption(user, await bodyJson(req)) });
  const redemptionMatch = pathname.match(/^\/api\/redemptions\/([A-Za-z0-9-]+)$/);
  if (req.method === 'PATCH' && redemptionMatch) {
    if (!['Collector', 'Supervisor', 'Administrator', 'Superadmin'].includes(user.role)) fail(403, 'Your account cannot fulfill redemptions.');
    const body = await bodyJson(req);
    if (body.status !== 'fulfilled') fail(400, 'Status must be fulfilled.');
    const result = await sql`UPDATE redemptions SET status='fulfilled' WHERE id=${redemptionMatch[1]} AND status='pending' RETURNING id`;
    if (!result.length) fail(409, 'Redemption was not found or is already fulfilled.');
    return json(res, 200, { id: redemptionMatch[1], status: 'fulfilled' });
  }
  if (req.method === 'POST' && pathname === '/api/scan-bins') return json(res, 200, await handleScan(user, await bodyJson(req)));
  if (req.method === 'POST' && pathname === '/api/upcycle-notifications') return json(res, 201, await handleUpcycleNotice(user, await bodyJson(req)));
  return json(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveFrontend(req, res, url.pathname);
  try { await api(req, res, url.pathname); }
  catch (error) {
    if (res.headersSent) return res.end();
    // 23505 = unique violation, e.g. the same idempotency key sent twice at the same moment.
    const status = Number.isInteger(error.status) ? error.status : error.code === '23505' ? 409 : 500;
    if (status === 500) console.error('ECO-TAP API error:', error);
    json(res, status, { error: status === 500 ? 'The server encountered an error.' : status === 409 && !error.status ? 'That request was already processed.' : error.message });
  }
});

const port = Number(process.env.API_PORT || 3000);
const host = process.env.API_HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`ECO-TAP API listening at http://${host}:${port}`);
  console.log(`Kiosk API: ${process.env.KIOSK_API_KEY ? 'enabled' : 'disabled (set KIOSK_API_KEY)'}`);
  console.log(`Database: Postgres at ${dbHost}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(async () => { await sql.end({ timeout: 5 }); process.exit(0); }); });
}
