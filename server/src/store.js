import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildSeedData } from './data.js';
import { isoToday, peakBookedRooms } from './utils.js';

const copy = (value) => structuredClone(value);
const tableNames = new Set(['user', 'property', 'roomType', 'booking', 'review', 'inquiry', 'refreshToken', 'importIssue']);

export class InventoryConflictError extends Error {
  constructor() {
    super('That room just sold out for one or more nights. Please choose another room or dates.');
    this.code = 'INVENTORY_CONFLICT';
  }
}

export class InventoryReductionError extends Error {
  constructor(occupied) {
    super(`Inventory cannot be reduced below ${occupied} room${occupied === 1 ? '' : 's'} already reserved on the same night.`);
    this.code = 'INVENTORY_BELOW_OCCUPANCY';
    this.occupied = occupied;
  }
}

function canReserve(bookings, candidate, inventory) {
  const start = new Date(`${candidate.checkIn}T00:00:00Z`);
  const end = new Date(`${candidate.checkOut}T00:00:00Z`);
  for (let night = new Date(start); night < end; night.setUTCDate(night.getUTCDate() + 1)) {
    const day = night.toISOString().slice(0, 10);
    const occupied = bookings.filter((booking) =>
      booking.roomTypeId === candidate.roomTypeId && booking.status !== 'cancelled' &&
      booking.checkIn <= day && booking.checkOut > day
    ).length;
    if (occupied >= inventory) return false;
  }
  return true;
}

export class MemoryStore {
  constructor(data) {
    this.tables = {
      user: data.users ?? [],
      property: data.properties ?? [],
      roomType: data.roomTypes ?? [],
      booking: data.bookings ?? [],
      review: data.reviews ?? [],
      inquiry: data.inquiries ?? [],
      refreshToken: data.refreshTokens ?? [],
      importIssue: data.importIssues ?? [],
    };
    this.dataQuality = copy(data.dataQuality ?? {});
    this.mode = 'demo';
    this.bookingMutex = Promise.resolve();
  }

  async list(table) {
    this.assertTable(table);
    return copy(this.tables[table]);
  }

  async get(table, id) {
    this.assertTable(table);
    const record = this.tables[table].find((item) => item.id === id);
    return record ? copy(record) : null;
  }

  async create(table, record) {
    this.assertTable(table);
    const created = { id: randomUUID(), createdAt: new Date().toISOString(), ...copy(record) };
    this.tables[table].push(created);
    return copy(created);
  }

  async update(table, id, patch) {
    this.assertTable(table);
    const index = this.tables[table].findIndex((item) => item.id === id);
    if (index < 0) return null;
    this.tables[table][index] = { ...this.tables[table][index], ...copy(patch), id };
    return copy(this.tables[table][index]);
  }

  async remove(table, id) {
    this.assertTable(table);
    const previous = this.tables[table].find((item) => item.id === id);
    if (!previous) return null;
    this.tables[table] = this.tables[table].filter((item) => item.id !== id);
    if (table === 'property') {
      const roomIds = new Set(this.tables.roomType.filter((room) => room.propertyId === id).map((room) => room.id));
      this.tables.roomType = this.tables.roomType.filter((room) => room.propertyId !== id);
      this.tables.review = this.tables.review.filter((review) => review.propertyId !== id);
      this.tables.booking = this.tables.booking.filter((booking) => booking.propertyId !== id && !roomIds.has(booking.roomTypeId));
    }
    return copy(previous);
  }

  async withInventoryLock(callback) {
    let release;
    const prior = this.bookingMutex;
    this.bookingMutex = new Promise((resolve) => { release = resolve; });
    await prior;
    try { return await callback(); } finally { release(); }
  }

  async reserveBooking(record) {
    return this.withInventoryLock(async () => {
      const room = this.tables.roomType.find((item) => item.id === record.roomTypeId);
      if (!room || !canReserve(this.tables.booking, record, room.inventory)) throw new InventoryConflictError();
      return this.create('booking', record);
    });
  }

  async updateRoomTypeSafely(id, patch) {
    return this.withInventoryLock(async () => {
      const current = this.tables.roomType.find((room) => room.id === id);
      if (!current) return null;
      if (patch.inventory !== undefined && patch.inventory < current.inventory) {
        const liveBookings = this.tables.booking.filter((booking) => booking.checkOut > isoToday());
        const occupied = peakBookedRooms(liveBookings, id);
        if (patch.inventory < occupied) throw new InventoryReductionError(occupied);
      }
      return this.update('roomType', id, patch);
    });
  }

  async findByEmail(email) {
    const user = this.tables.user.find((item) => item.email.toLowerCase() === email.toLowerCase());
    return user ? copy(user) : null;
  }

  async findRefreshToken(tokenHash) {
    const token = this.tables.refreshToken.find((item) => item.tokenHash === tokenHash);
    return token ? copy(token) : null;
  }

  async deleteRefreshToken(tokenHash) {
    this.tables.refreshToken = this.tables.refreshToken.filter((item) => item.tokenHash !== tokenHash);
  }

  async deleteExpiredRefreshTokens() {
    const now = Date.now();
    this.tables.refreshToken = this.tables.refreshToken.filter((item) => new Date(item.expiresAt).getTime() > now);
  }

  assertTable(table) {
    if (!tableNames.has(table)) throw new Error(`Unknown store table: ${table}`);
  }
}

function normalizePrisma(table, row) {
  if (!row) return null;
  const result = { ...row };
  for (const field of ['basePrice', 'priceInr', 'totalPrice']) {
    if (result[field] != null) result[field] = Number(result[field]);
  }
  for (const field of ['checkIn', 'checkOut']) {
    if (result[field] instanceof Date) result[field] = result[field].toISOString().slice(0, 10);
  }
  return result;
}

function preparePrisma(table, record) {
  const result = { ...record };
  if (table === 'booking' || table === 'inquiry') {
    for (const field of ['checkIn', 'checkOut']) {
      if (typeof result[field] === 'string' && result[field]) result[field] = new Date(`${result[field].slice(0, 10)}T00:00:00.000Z`);
    }
  }
  for (const field of ['createdAt', 'expiresAt']) {
    if (typeof result[field] === 'string' && result[field]) result[field] = new Date(result[field]);
  }
  return result;
}

export class PrismaStore {
  constructor(prisma) {
    this.prisma = prisma;
    this.mode = 'postgres';
    this.dataQuality = { fxUsdInr: Number(process.env.FX_USD_INR || 83.5) };
  }

  model(table) {
    if (!tableNames.has(table)) throw new Error(`Unknown store table: ${table}`);
    return this.prisma[table];
  }

  async list(table) {
    const rows = await this.model(table).findMany();
    return rows.map((row) => normalizePrisma(table, row));
  }

  async get(table, id) {
    return normalizePrisma(table, await this.model(table).findUnique({ where: { id } }));
  }

  async create(table, record) {
    return normalizePrisma(table, await this.model(table).create({ data: preparePrisma(table, record) }));
  }

  async update(table, id, patch) {
    try {
      return normalizePrisma(table, await this.model(table).update({ where: { id }, data: preparePrisma(table, patch) }));
    } catch (error) {
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async remove(table, id) {
    try {
      return normalizePrisma(table, await this.model(table).delete({ where: { id } }));
    } catch (error) {
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async reserveBooking(record) {
    const prepared = preparePrisma('booking', record);
    return this.prisma.$transaction(async (tx) => {
      // A per-room-type advisory lock makes availability check + insert atomic across API instances.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${String(record.roomTypeId)})::bigint)`;
      const room = await tx.roomType.findUnique({ where: { id: record.roomTypeId }, select: { inventory: true } });
      if (!room) throw new InventoryConflictError();
      const overlapping = await tx.booking.findMany({
        where: {
          roomTypeId: record.roomTypeId,
          status: { not: 'cancelled' },
          checkIn: { lt: prepared.checkOut },
          checkOut: { gt: prepared.checkIn },
        },
        select: { roomTypeId: true, checkIn: true, checkOut: true, status: true },
      });
      const normalized = overlapping.map((booking) => ({
        ...booking,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
      }));
      if (!canReserve(normalized, record, room.inventory)) throw new InventoryConflictError();
      const created = await tx.booking.create({ data: prepared });
      return normalizePrisma('booking', created);
    });
  }

  async updateRoomTypeSafely(id, patch) {
    const prepared = preparePrisma('roomType', patch);
    return this.prisma.$transaction(async (tx) => {
      // Share the same room-type lock used by reservations before reducing capacity.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${String(id)})::bigint)`;
      const current = await tx.roomType.findUnique({ where: { id } });
      if (!current) return null;
      if (patch.inventory !== undefined && patch.inventory < current.inventory) {
        const rows = await tx.booking.findMany({
          where: { roomTypeId: id, status: { not: 'cancelled' }, checkOut: { gt: new Date(`${isoToday()}T00:00:00.000Z`) } },
          select: { roomTypeId: true, checkIn: true, checkOut: true, status: true },
        });
        const bookings = rows.map((booking) => ({
          ...booking,
          checkIn: booking.checkIn.toISOString().slice(0, 10),
          checkOut: booking.checkOut.toISOString().slice(0, 10),
        }));
        const occupied = peakBookedRooms(bookings, id);
        if (patch.inventory < occupied) throw new InventoryReductionError(occupied);
      }
      const updated = await tx.roomType.update({ where: { id }, data: prepared });
      return normalizePrisma('roomType', updated);
    });
  }

  async findByEmail(email) {
    return normalizePrisma('user', await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } }));
  }

  async findRefreshToken(tokenHash) {
    return normalizePrisma('refreshToken', await this.prisma.refreshToken.findUnique({ where: { tokenHash } }));
  }

  async deleteRefreshToken(tokenHash) {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async deleteExpiredRefreshTokens() {
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  }
}

export async function createMemoryStore({ demoPasswords = true } = {}) {
  const data = buildSeedData();
  if (demoPasswords) {
    data.users[0].passwordHash = await bcrypt.hash('Harbor!2026', 10);
    data.users[1].passwordHash = await bcrypt.hash('Welcome!2026', 10);
  }
  return new MemoryStore(data);
}

export async function createProductionStore(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return createMemoryStore();
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import('./generated/prisma/client.js'),
    import('@prisma/adapter-pg'),
  ]);
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  return new PrismaStore(prisma);
}

export { randomUUID };
