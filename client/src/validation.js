import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.').refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a real calendar date.');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email address.').max(160),
  password: z.string().min(10, 'Use at least 10 characters.').max(100),
});
export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
export const bookingSchema = z.object({
  checkIn: date,
  checkOut: date,
  guests: z.coerce.number().int().min(1).max(8),
  guestName: z.string().trim().min(2, 'Enter the guest name.'),
  guestPhone: z.string().trim().max(30).optional(),
}).refine((value) => value.checkOut > value.checkIn, { message: 'Check-out must be after check-in.', path: ['checkOut'] });
export const inquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(1500),
  checkIn: date.optional().or(z.literal('')),
  checkOut: date.optional().or(z.literal('')),
}).refine((value) => (!value.checkIn && !value.checkOut) || (value.checkIn && value.checkOut && value.checkOut > value.checkIn), {
  message: 'Add both dates and make sure check-out is after check-in.', path: ['checkOut'],
});
