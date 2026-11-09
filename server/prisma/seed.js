import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { buildSeedData } from '../src/data.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding a PostgreSQL database.');
}
if (process.env.SEED_ADMIN_PASSWORD.length < 14) {
  throw new Error('SEED_ADMIN_PASSWORD must be at least 14 characters.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const dateTime = (value) => value ? new Date(value) : null;
const data = buildSeedData();
data.users[0].email = process.env.SEED_ADMIN_EMAIL.toLowerCase();
data.users[0].name = process.env.SEED_ADMIN_NAME || 'Serein Front Desk';
data.users[0].passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);
data.users[1].email = `seed-guest-${randomBytes(4).toString('hex')}@example.invalid`;
data.users[1].passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

try {
  const existing = await prisma.property.count();
  if (existing > 0) throw new Error(`Database already contains ${existing} properties. Seed skipped to protect existing data.`);
  await prisma.$transaction([
    prisma.user.createMany({ data: data.users.map((user) => ({ ...user, createdAt: dateTime(user.createdAt) })) }),
    prisma.property.createMany({ data: data.properties.map((property) => ({ ...property, createdAt: dateTime(property.createdAt) })) }),
    prisma.roomType.createMany({ data: data.roomTypes.map((room) => ({ ...room, createdAt: dateTime(room.createdAt) })) }),
    prisma.booking.createMany({ data: data.bookings.map((booking) => ({ ...booking, checkIn: dateTime(booking.checkIn), checkOut: dateTime(booking.checkOut), createdAt: dateTime(booking.createdAt) })) }),
    prisma.review.createMany({ data: data.reviews.map((review) => ({ ...review, createdAt: dateTime(review.createdAt) })) }),
    prisma.inquiry.createMany({ data: data.inquiries.map((inquiry) => ({ ...inquiry, checkIn: null, checkOut: null, createdAt: dateTime(inquiry.createdAt) })) }),
    prisma.importIssue.createMany({ data: data.importIssues.map((issue) => ({ ...issue, createdAt: dateTime(issue.createdAt) })) }),
  ]);
  console.log(JSON.stringify({ message: 'Serein sample data imported', properties: data.properties.length, roomTypes: data.roomTypes.length, bookings: data.bookings.length, quarantinedStays: data.importIssues.length }));
} finally {
  await prisma.$disconnect();
}
