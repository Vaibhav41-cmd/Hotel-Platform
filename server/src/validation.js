import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.').refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
const stay = z.object({
  checkIn: date,
  checkOut: date,
}).refine((value) => value.checkOut > value.checkIn, { message: 'Check-out must be after check-in.', path: ['checkOut'] });

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(10, 'Use at least 10 characters.').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(100),
});

export const bookingSchema = z.object({
  checkIn: date,
  checkOut: date,
  roomTypeId: z.string().uuid(),
  guests: z.coerce.number().int().min(1).max(8),
  guestName: z.string().trim().min(2).max(80).optional(),
  guestEmail: z.string().trim().email().max(160).optional(),
  guestPhone: z.string().trim().max(30).optional(),
}).refine((value) => value.checkOut > value.checkIn, { message: 'Check-out must be after check-in.', path: ['checkOut'] });

export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(1500),
  checkIn: date.optional().or(z.literal('')),
  checkOut: date.optional().or(z.literal('')),
}).refine((value) => {
  if (!value.checkIn && !value.checkOut) return true;
  return Boolean(value.checkIn && value.checkOut && value.checkOut > value.checkIn);
}, { message: 'Add both dates and make sure check-out is after check-in.', path: ['checkOut'] });

export const reviewSchema = z.object({
  propertyId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(90),
  comment: z.string().trim().min(10).max(1200),
});

export const propertySchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a short, hyphenated URL slug.'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(20).max(1200),
  address: z.string().trim().min(5).max(180),
  neighborhood: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80).default('Mumbai'),
  rating: z.coerce.number().min(1).max(5).default(4.7),
  amenities: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  heroImage: z.string().trim().max(500).default('/hotel-hero.jpg'),
  featured: z.coerce.boolean().default(false),
});

export const roomTypeSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  sourceLabel: z.string().trim().max(100).optional(),
  description: z.string().trim().min(10).max(500),
  maxGuests: z.coerce.number().int().min(1).max(8),
  inventory: z.coerce.number().int().min(1).max(500),
  priceInr: z.coerce.number().positive().max(1000000),
  amenities: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'completed', 'cancelled']),
});

export const inquiryStatusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']),
});

export { date, stay };
