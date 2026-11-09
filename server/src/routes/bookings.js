import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { asyncHandler, HttpError, logEvent } from '../http.js';
import { bookingSchema } from '../validation.js';
import { InventoryConflictError } from '../store.js';
import { isoToday, nightsBetween } from '../utils.js';

export function bookingRoutes({ store, authenticate, enqueueNotification = async () => {} }) {
  const router = Router();

  router.post('/', authenticate, asyncHandler(async (req, res) => {
    const body = bookingSchema.parse(req.body);
    if (body.checkIn < isoToday()) throw new HttpError(400, 'CHECKIN_IN_PAST', 'Check-in must be today or a future date.');
    const room = await store.get('roomType', body.roomTypeId);
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'That room type is no longer available.');
    const property = await store.get('property', room.propertyId);
    if (!property) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'We could not find that stay.');
    if (body.guests > room.maxGuests) throw new HttpError(400, 'GUEST_LIMIT', `This room is set up for up to ${room.maxGuests} guests.`);
    const booking = {
      confirmation: `SRN-${randomBytes(3).toString('hex').toUpperCase()}`,
      userId: req.user.id,
      propertyId: property.id,
      roomTypeId: room.id,
      guestName: body.guestName || req.user.name,
      guestEmail: body.guestEmail || req.user.email,
      guestPhone: body.guestPhone || null,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      guests: body.guests,
      status: 'confirmed',
      totalPrice: Number(room.priceInr) * nightsBetween(body.checkIn, body.checkOut),
      currency: 'INR',
    };
    let created;
    try {
      created = await store.reserveBooking(booking);
    } catch (error) {
      if (error instanceof InventoryConflictError || error.code === 'INVENTORY_CONFLICT') {
        throw new HttpError(409, 'ROOM_UNAVAILABLE', error.message);
      }
      throw error;
    }
    logEvent('booking.created', { bookingId: created.id, confirmation: created.confirmation, propertyId: property.id, userId: req.user.id });
    void enqueueNotification('booking-confirmation', { email: booking.guestEmail, bookingId: created.id, confirmation: created.confirmation }).catch(() => {});
    res.status(201).json({ data: { ...created, propertyName: property.name, roomName: room.name } });
  }));

  router.get('/mine', authenticate, asyncHandler(async (req, res) => {
    const [bookings, properties, roomTypes] = await Promise.all([store.list('booking'), store.list('property'), store.list('roomType')]);
    const result = bookings.filter((booking) => booking.userId === req.user.id).map((booking) => ({
      ...booking,
      propertyName: properties.find((item) => item.id === booking.propertyId)?.name || 'Serein stay',
      neighborhood: properties.find((item) => item.id === booking.propertyId)?.neighborhood || '',
      roomName: roomTypes.find((item) => item.id === booking.roomTypeId)?.name || 'Guest room',
    })).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    res.json({ data: result });
  }));

  router.patch('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
    const booking = await store.get('booking', req.params.id);
    if (!booking) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'We could not find that reservation.');
    if (booking.userId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'You can only change your own reservation.');
    if (booking.status === 'cancelled') throw new HttpError(409, 'ALREADY_CANCELLED', 'This reservation is already cancelled.');
    if (booking.status === 'checked_in' || (booking.checkIn <= isoToday() && req.user.role !== 'admin')) {
      throw new HttpError(409, 'CANCELLATION_CLOSED', 'Please contact the front desk to change an in-progress stay.');
    }
    const updated = await store.update('booking', booking.id, { status: 'cancelled' });
    logEvent('booking.cancelled', { bookingId: booking.id, userId: req.user.id, byAdmin: req.user.role === 'admin' });
    res.json({ data: updated });
  }));

  return router;
}
