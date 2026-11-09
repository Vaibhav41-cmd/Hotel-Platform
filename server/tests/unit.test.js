import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeedData, isValidStay, normalizeRoomName, overlaps } from '../src/data.js';
import { MemoryStore, InventoryConflictError } from '../src/store.js';
import { calculateDashboardMetrics } from '../src/utils.js';

const fx = 83.5;

test('room-label cleanup maps inconsistent legacy labels to canonical room types', () => {
  assert.equal(normalizeRoomName('Classic Queen Room'), 'Classic Queen');
  assert.equal(normalizeRoomName('Queen Classic'), 'Classic Queen');
  assert.equal(normalizeRoomName('Marine View King Suite'), 'Sea View Suite');
  assert.equal(normalizeRoomName('Garden Courtyard Room'), 'Courtyard Room');
});

test('stay dates reject malformed and reversed stays; overlap uses half-open nights', () => {
  assert.equal(isValidStay('2026-11-10', '2026-11-12'), true);
  assert.equal(isValidStay('2026-11-12', '2026-11-10'), false);
  assert.equal(isValidStay('2026-02-30', '2026-03-02'), false);
  assert.equal(overlaps('2026-11-10', '2026-11-12', '2026-11-12', '2026-11-14'), false);
  assert.equal(overlaps('2026-11-10', '2026-11-13', '2026-11-12', '2026-11-14'), true);
});

test('import seed keeps 14 properties and quarantines invalid stays while retaining mixed-currency provenance', () => {
  const seed = buildSeedData({ fxUsdInr: fx });
  assert.equal(seed.properties.length, 14);
  assert.equal(seed.roomTypes.length, 28);
  assert.equal(seed.dataQuality.invalidStaysQuarantined, 2);
  assert.equal(seed.importIssues.length, 2);
  assert.ok(seed.roomTypes.some((room) => room.currency === 'USD' && room.basePrice < room.priceInr));
  assert.ok(seed.roomTypes.every((room) => room.sourceLabel && room.name));
});

test('atomic reservation guard prevents two concurrent bookings from selling the same last room', async () => {
  const data = buildSeedData();
  data.roomTypes[0].inventory = 1;
  const store = new MemoryStore(data);
  const room = data.roomTypes[0];
  const checkIn = '2027-11-10';
  const candidate = {
    roomTypeId: room.id, checkIn, checkOut: '2027-11-13', status: 'confirmed',
    totalPrice: room.priceInr * 3, currency: 'INR', guestName: 'Test Guest', guestEmail: 'test@example.test',
  };
  const results = await Promise.allSettled([
    store.reserveBooking({ ...candidate, confirmation: 'SRN-LOCK-1' }),
    store.reserveBooking({ ...candidate, confirmation: 'SRN-LOCK-2' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected.reason instanceof InventoryConflictError);
});

test('admin metric calculation produces occupancy, ADR and RevPAR from room-nights', () => {
  const properties = [{ id: 'p1', name: 'Harbor House' }];
  const roomTypes = [{ id: 'r1', propertyId: 'p1', inventory: 2, priceInr: 1000 }];
  const bookings = [{ id: 'b1', propertyId: 'p1', roomTypeId: 'r1', checkIn: '2026-10-01', checkOut: '2026-10-04', totalPrice: 3000, status: 'completed' }];
  const result = calculateDashboardMetrics({ properties, roomTypes, bookings, days: 5, today: '2026-10-05' });
  assert.equal(result.period.occupiedRoomNights, 3);
  assert.equal(result.period.availableRoomNights, 10);
  assert.equal(result.period.occupancyRate, 30);
  assert.equal(result.period.adr, 1000);
  assert.equal(result.period.revpar, 300);
});
