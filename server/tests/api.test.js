import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store.js';

const store = await createMemoryStore();
const app = createApp({ store, config: { jwtSecret: 'unit-test-secret-with-at-least-32-characters-long', secureCookies: false, sameSite: 'lax' } });
const guestAgent = request.agent(app);
let guestToken = '';
let adminToken = '';
const futureDate = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

test('health and public search return the seeded 14-property collection', async () => {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.data.mode, 'demo');
  const response = await request(app).get('/api/properties').expect(200);
  assert.equal(response.body.data.length, 14);
  assert.equal(response.body.meta.currency, 'INR');
  const bandra = await request(app).get('/api/properties?q=Bandra').expect(200);
  assert.ok(bandra.body.data.length >= 2);
  const detail = await request(app).get('/api/properties/harbor-house?checkIn=2026-11-12&checkOut=2026-11-14&guests=2').expect(200);
  assert.equal(detail.body.data.name, 'Harbor House');
  assert.ok(detail.body.data.roomTypes.every((room) => room.maxGuests >= 2 && room.availableRooms > 0));
});

test('guest login issues a short-lived JWT and rotating httpOnly refresh cookie', async () => {
  const login = await guestAgent.post('/api/auth/login').send({ email: 'guest@sereinstays.demo', password: 'Welcome!2026' }).expect(200);
  guestToken = login.body.data.accessToken;
  assert.ok(guestToken);
  assert.equal(login.body.data.user.role, 'user');
  assert.match(login.headers['set-cookie'].join(';'), /HttpOnly/i);
  const refresh = await guestAgent.post('/api/auth/refresh').expect(200);
  assert.ok(refresh.body.data.accessToken);
  assert.notEqual(refresh.body.data.accessToken, guestToken);
  guestToken = refresh.body.data.accessToken;
});

test('admin metrics are role protected and include data-quality and hotel KPIs', async () => {
  const denied = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${guestToken}`).expect(403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@sereinstays.demo', password: 'Harbor!2026' }).expect(200);
  adminToken = login.body.data.accessToken;
  const metrics = await request(app).get('/api/admin/metrics?days=30').set('Authorization', `Bearer ${adminToken}`).expect(200);
  assert.equal(metrics.body.data.summary.totalProperties, 14);
  assert.ok(metrics.body.data.period.occupancyRate >= 0);
  assert.ok(metrics.body.data.period.adr >= 0);
  assert.ok(metrics.body.data.period.revpar >= 0);
  assert.equal(metrics.body.data.summary.openDataIssues, 2);
});

test('guest can create an available booking; server computes the total and validates dates', async () => {
  const room = (await store.list('roomType'))[0];
  const checkIn = futureDate(90);
  const checkOut = futureDate(93);
  const created = await request(app).post('/api/bookings').set('Authorization', `Bearer ${guestToken}`).send({
    roomTypeId: room.id, checkIn, checkOut, guests: 2, guestName: 'Aanya Guest',
  }).expect(201);
  assert.equal(created.body.data.totalPrice, room.priceInr * 3);
  assert.match(created.body.data.confirmation, /^SRN-/);
  assert.equal(created.body.data.currency, 'INR');
  const mine = await request(app).get('/api/bookings/mine').set('Authorization', `Bearer ${guestToken}`).expect(200);
  assert.ok(mine.body.data.some((booking) => booking.id === created.body.data.id));
  const updated = await request(app).patch(`/api/admin/bookings/${created.body.data.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'completed' }).expect(200);
  assert.equal(updated.body.data.status, 'completed');
  await request(app).delete(`/api/admin/bookings/${created.body.data.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  await request(app).post('/api/bookings').set('Authorization', `Bearer ${guestToken}`).send({
    roomTypeId: room.id, checkIn: '2026-11-15', checkOut: '2026-11-12', guests: 2,
  }).expect(400);
});

test('public enquiry creation validates and is visible to front desk', async () => {
  const response = await request(app).post('/api/inquiries').send({
    name: 'Nina Patel', email: 'nina@example.com', message: 'Could you help us plan a quiet weekend in Bandra?',
  }).expect(201);
  const inbox = await request(app).get('/api/admin/inquiries').set('Authorization', `Bearer ${adminToken}`).expect(200);
  assert.ok(inbox.body.data.some((item) => item.id === response.body.data.id));
  await request(app).post('/api/inquiries').send({ name: 'X', email: 'bad', message: 'short' }).expect(400);
});

test('image upload accepts only a matching supported image signature', async () => {
  const fakeJpeg = Buffer.from('this is not a JPEG image');
  const response = await request(app).post('/api/admin/upload')
    .set('Authorization', `Bearer ${adminToken}`)
    .attach('image', fakeJpeg, { filename: 'not-really.jpg', contentType: 'image/jpeg' })
    .expect(400);
  assert.equal(response.body.error.code, 'INVALID_IMAGE_CONTENT');
});

test('front desk can create, update and remove properties and room inventory', async () => {
  const propertyResponse = await request(app).post('/api/admin/properties').set('Authorization', `Bearer ${adminToken}`).send({
    slug: 'test-courtyard', name: 'Test Courtyard', neighborhood: 'Mahim', address: '4 Garden Lane, Mahim, Mumbai',
    description: 'A small sample property used to verify front desk inventory workflows.', amenities: ['Garden', 'Breakfast'], featured: false,
  }).expect(201);
  const property = propertyResponse.body.data;
  const edited = await request(app).patch(`/api/admin/properties/${property.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Test Courtyard House' }).expect(200);
  assert.equal(edited.body.data.name, 'Test Courtyard House');
  const roomResponse = await request(app).post('/api/admin/room-types').set('Authorization', `Bearer ${adminToken}`).send({
    propertyId: property.id, name: 'Garden Queen', description: 'A bright little room with a private garden outlook.', inventory: 3, maxGuests: 2, priceInr: 14500,
  }).expect(201);
  const room = roomResponse.body.data;
  const reservations = [];
  for (let index = 0; index < 2; index += 1) {
    reservations.push(await store.reserveBooking({
      confirmation: `SRN-ROOM-LOCK-${index + 1}`, userId: null, propertyId: property.id, roomTypeId: room.id,
      guestName: `Inventory Guest ${index + 1}`, guestEmail: `inventory${index + 1}@example.test`,
      checkIn: '2027-05-10', checkOut: '2027-05-13', guests: 1, status: 'confirmed', totalPrice: 43500, currency: 'INR',
    }));
  }
  await request(app).patch(`/api/admin/room-types/${room.id}`).set('Authorization', `Bearer ${adminToken}`).send({ inventory: 1 }).expect(409);
  const updatedRoom = await request(app).patch(`/api/admin/room-types/${room.id}`).set('Authorization', `Bearer ${adminToken}`).send({ inventory: 4, priceInr: 15500 }).expect(200);
  assert.equal(updatedRoom.body.data.inventory, 4);
  assert.equal(updatedRoom.body.data.priceInr, 15500);
  for (const booking of reservations) await request(app).delete(`/api/admin/bookings/${booking.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  await request(app).delete(`/api/admin/room-types/${room.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  await request(app).delete(`/api/admin/properties/${property.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
});
