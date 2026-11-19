// Stand-in for the machine controller until the real load cell / optical sensor is wired up.
// It plays the role of the hardware: it reports the measured weight and detected material for the
// resident who is currently signed in at the station. Residents cannot do this themselves.
//
//   node scripts/simulate-machine.mjs --station K-001 --key <device key> --material PET --kg 1.25
//   Optional: --url http://127.0.0.1:3000  --session DS-XXXXXXXX  --event <id>
import { randomUUID } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc), []));
const url = (args.url || 'http://127.0.0.1:3000').replace(/\/$/, '');
if (!args.station || !args.key || !args.material || !args.kg) {
  console.error('Usage: node scripts/simulate-machine.mjs --station K-001 --key <device key> --material PET --kg 1.25');
  process.exit(1);
}
const res = await fetch(`${url}/api/kiosk/device/deposit-event`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Station-Id': args.station, 'X-Device-Key': args.key },
  body: JSON.stringify({ eventId: args.event || randomUUID(), sessionId: args.session, material: args.material, weightKg: Number(args.kg) }),
});
console.log(res.status, await res.text());
