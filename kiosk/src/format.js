// Pure helpers shared by the controller and the screens.

/** Points for a weight, rounded half up like the server (so the preview matches the award). */
export function pointsForWeight(weightKg, category) {
  return Math.round(weightKg * category.pointsPerKg);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 22, 2026 - 01:52 PM", the kiosk's "MMM dd, yyyy - hh:mm a" in the device's time zone. */
export function formatDate(timestamp) {
  const d = new Date(Number(timestamp));
  const pad = (n) => String(n).padStart(2, '0');
  const h = d.getHours();
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} - ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Kotlin printed Double kg as-is ("2.0", "1.25"); keep one decimal at least. */
export function formatKg(kg) {
  const n = Number(kg) || 0;
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/** Kotlin's ceil(points / pointsPerKg * 10) / 10 for "equal to about 2.5 kg PET". */
export function kgWorth(pointsCost, pointsPerKg) {
  return formatKg(Math.ceil((pointsCost / pointsPerKg) * 10) / 10);
}
