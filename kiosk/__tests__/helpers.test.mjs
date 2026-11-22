// Ports of ApiHelpersTest.kt and PointsTest.kt, plus the new JS-only helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCardId, parseErrorMessage } from '../src/api.js';
import { pointsForWeight, formatDate, formatKg, kgWorth } from '../src/format.js';
import { cardIdFromTag } from '../src/nfc.js';

test('cardIdGetsPrefixAndUppercase', () => {
  assert.equal(normalizeCardId(' 8a19b '), 'ECO-TAP-8A19B');
});

test('cardIdWithPrefixIsKept', () => {
  assert.equal(normalizeCardId('eco-tap-3f72c'), 'ECO-TAP-3F72C');
});

test('errorMessageIsReadFromServerBody', () => {
  assert.equal(parseErrorMessage('{"error":"Invalid 6-digit PIN. Please try again."}', 'fallback'), 'Invalid 6-digit PIN. Please try again.');
});

test('errorMessageFallsBackOnBadBody', () => {
  assert.equal(parseErrorMessage('<html>502</html>', 'fallback'), 'fallback');
  assert.equal(parseErrorMessage(null, 'fallback'), 'fallback');
  assert.equal(parseErrorMessage('{}', 'fallback'), 'fallback');
});

const pet = { id: 'PET', name: 'PET bottles', section: 'b1', pointsPerKg: 10 };
const hdpe = { id: 'HDPE', name: 'HDPE containers', section: 'b2', pointsPerKg: 20 };

test('points: whole kilograms', () => {
  assert.equal(pointsForWeight(1.0, pet), 10);
  assert.equal(pointsForWeight(5.0, hdpe), 100);
});

test('points: fractions round half up', () => {
  assert.equal(pointsForWeight(2.5, pet), 25);
  assert.equal(pointsForWeight(1.2, hdpe), 24);
  assert.equal(pointsForWeight(0.05, hdpe), 1);
  assert.equal(pointsForWeight(0.05, pet), 1); // 0.5 rounds up
});

test('points: zero weight earns nothing', () => {
  assert.equal(pointsForWeight(0, pet), 0);
});

test('formatKg keeps Kotlin Double style', () => {
  assert.equal(formatKg(2), '2.0');
  assert.equal(formatKg(1.25), '1.25');
  assert.equal(formatKg(undefined), '0.0');
});

test('kgWorth rounds up to 0.1 kg like the Kotlin screen', () => {
  assert.equal(kgWorth(100, 10), '10.0');
  assert.equal(kgWorth(25, 20), '1.3');
});

test('formatDate matches "MMM dd, yyyy - hh:mm a"', () => {
  assert.equal(formatDate(new Date(2026, 10, 2, 13, 5).getTime()), 'Nov 02, 2026 - 01:05 PM');
  assert.equal(formatDate(new Date(2026, 0, 15, 0, 7).getTime()), 'Jan 15, 2026 - 12:07 AM');
});

test('NFC tag id becomes ECO-TAP-<UPPERCASE HEX>', () => {
  assert.equal(cardIdFromTag({ id: '04a1b2c3' }), 'ECO-TAP-04A1B2C3');
  assert.equal(cardIdFromTag({ id: '' }), null);
  assert.equal(cardIdFromTag(null), null);
});
