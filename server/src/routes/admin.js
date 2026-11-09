import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import multer from 'multer';
import { Router } from 'express';
import { asyncHandler, HttpError, logEvent } from '../http.js';
import { propertySchema, roomTypeSchema, inquiryStatusSchema, updateBookingStatusSchema } from '../validation.js';
import { calculateDashboardMetrics, toPublicProperty } from '../utils.js';

const uploadsDirectory = fileURLToPath(new URL('../../uploads/', import.meta.url));
mkdirSync(uploadsDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDirectory),
  filename: (_req, file, callback) => {
    const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[file.mimetype];
    callback(null, `${Date.now()}-${randomBytes(6).toString('hex')}${extension}`);
  },
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new HttpError(400, 'UNSUPPORTED_IMAGE', 'Upload a JPG, PNG or WebP image.'));
    callback(null, true);
  },
});

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export function adminRoutes({ store, authenticate, requireAdmin }) {
  const router = Router();
  router.use(authenticate, requireAdmin);

  router.get('/metrics', asyncHandler(async (req, res) => {
    const days = Number(req.query.days || 30);
    if (![7, 30, 90].includes(days)) throw new HttpError(400, 'INVALID_RANGE', 'Choose a 7, 30 or 90 day reporting window.');
    const [properties, roomTypes, bookings, inquiries, issues] = await Promise.all([
      store.list('property'), store.list('roomType'), store.list('booking'), store.list('inquiry'), store.list('importIssue'),
    ]);
    const metrics = calculateDashboardMetrics({ properties, roomTypes, bookings, days });
    const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled');
    const dataQuality = {
      ...store.dataQuality,
      sourcePropertyCount: properties.length,
      importedRoomTypeCount: roomTypes.length,
      roomLabelVariantsNormalized: roomTypes.filter((room) => room.sourceLabel && room.name && room.sourceLabel !== room.name).length,
      usdRatesConverted: roomTypes.filter((room) => room.currency === 'USD').length,
      invalidStaysQuarantined: issues.length,
      fxUsdInr: store.dataQuality.fxUsdInr || Number(process.env.FX_USD_INR || 83.5),
    };
    const summary = {
      totalProperties: properties.length,
      totalRooms: roomTypes.reduce((sum, room) => sum + Number(room.inventory || 0), 0),
      activeBookings: activeBookings.length,
      newInquiries: inquiries.filter((item) => item.status === 'new').length,
      openDataIssues: issues.filter((item) => !item.resolved).length,
      dataQuality,
    };
    res.json({ data: { ...metrics, summary, recentBookings: bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8) } });
  }));

  router.get('/properties', asyncHandler(async (_req, res) => {
    const [properties, roomTypes, reviews, bookings] = await Promise.all([
      store.list('property'), store.list('roomType'), store.list('review'), store.list('booking'),
    ]);
    res.json({ data: properties.map((property) => toPublicProperty(property, roomTypes, reviews, bookings)) });
  }));

  router.post('/properties', asyncHandler(async (req, res) => {
    const body = propertySchema.parse(req.body);
    if ((await store.list('property')).some((property) => property.slug === body.slug)) throw new HttpError(409, 'SLUG_IN_USE', 'That property URL is already in use.');
    const property = await store.create('property', { ...body, country: 'India' });
    logEvent('admin.property.created', { propertyId: property.id, actorId: req.user.id });
    res.status(201).json({ data: property });
  }));

  router.patch('/properties/:id', asyncHandler(async (req, res) => {
    const current = await store.get('property', req.params.id);
    if (!current) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'We could not find that property.');
    const patch = propertySchema.partial().parse(req.body);
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'EMPTY_UPDATE', 'Add at least one field to update.');
    if (patch.slug && patch.slug !== current.slug && (await store.list('property')).some((property) => property.slug === patch.slug)) throw new HttpError(409, 'SLUG_IN_USE', 'That property URL is already in use.');
    const updated = await store.update('property', current.id, patch);
    logEvent('admin.property.updated', { propertyId: current.id, actorId: req.user.id });
    res.json({ data: updated });
  }));

  router.delete('/properties/:id', asyncHandler(async (req, res) => {
    const property = await store.get('property', req.params.id);
    if (!property) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'We could not find that property.');
    if ((await store.list('booking')).some((booking) => booking.propertyId === property.id)) throw new HttpError(409, 'PROPERTY_HAS_BOOKINGS', 'A property with stay history cannot be deleted. Archive it instead.');
    await store.remove('property', property.id);
    logEvent('admin.property.deleted', { propertyId: property.id, actorId: req.user.id });
    res.json({ data: { deleted: true } });
  }));

  router.post('/room-types', asyncHandler(async (req, res) => {
    const body = roomTypeSchema.parse(req.body);
    if (!await store.get('property', body.propertyId)) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'Select an existing property.');
    const roomType = await store.create('roomType', {
      ...body,
      sourceLabel: body.sourceLabel || body.name,
      basePrice: body.priceInr,
      currency: 'INR',
    });
    logEvent('admin.room_type.created', { roomTypeId: roomType.id, propertyId: roomType.propertyId, actorId: req.user.id });
    res.status(201).json({ data: roomType });
  }));

  router.patch('/room-types/:id', asyncHandler(async (req, res) => {
    const current = await store.get('roomType', req.params.id);
    if (!current) throw new HttpError(404, 'ROOM_NOT_FOUND', 'We could not find that room type.');
    const patch = roomTypeSchema.partial().parse(req.body);
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'EMPTY_UPDATE', 'Add at least one field to update.');
    if (patch.propertyId && !await store.get('property', patch.propertyId)) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'Select an existing property.');
    if (patch.priceInr !== undefined) {
      patch.basePrice = patch.priceInr;
      patch.currency = 'INR';
    }
    let updated;
    try {
      updated = await store.updateRoomTypeSafely(current.id, patch);
    } catch (error) {
      if (error.code === 'INVENTORY_BELOW_OCCUPANCY') throw new HttpError(409, error.code, error.message);
      throw error;
    }
    logEvent('admin.room_type.updated', { roomTypeId: current.id, actorId: req.user.id });
    res.json({ data: updated });
  }));

  router.delete('/room-types/:id', asyncHandler(async (req, res) => {
    const room = await store.get('roomType', req.params.id);
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'We could not find that room type.');
    if ((await store.list('booking')).some((booking) => booking.roomTypeId === room.id)) throw new HttpError(409, 'ROOM_HAS_BOOKINGS', 'A room type with stay history cannot be deleted. Reduce its inventory instead.');
    await store.remove('roomType', room.id);
    logEvent('admin.room_type.deleted', { roomTypeId: room.id, actorId: req.user.id });
    res.json({ data: { deleted: true } });
  }));

  router.get('/bookings', asyncHandler(async (_req, res) => {
    const [bookings, properties, roomTypes] = await Promise.all([store.list('booking'), store.list('property'), store.list('roomType')]);
    const result = bookings.map((booking) => ({
      ...booking,
      propertyName: properties.find((item) => item.id === booking.propertyId)?.name || '—',
      roomName: roomTypes.find((item) => item.id === booking.roomTypeId)?.name || '—',
    })).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    res.json({ data: result });
  }));

  router.patch('/bookings/:id', asyncHandler(async (req, res) => {
    const body = updateBookingStatusSchema.parse(req.body);
    const current = await store.get('booking', req.params.id);
    if (!current) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'We could not find that reservation.');
    if (current.status === 'cancelled' && body.status !== 'cancelled') {
      throw new HttpError(409, 'CANCELLED_BOOKING_CLOSED', 'Create a new reservation rather than reopening a cancelled stay.');
    }
    const updated = await store.update('booking', current.id, { status: body.status });
    logEvent('admin.booking.status_changed', { bookingId: current.id, status: body.status, actorId: req.user.id });
    res.json({ data: updated });
  }));

  router.delete('/bookings/:id', asyncHandler(async (req, res) => {
    const booking = await store.remove('booking', req.params.id);
    if (!booking) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'We could not find that reservation.');
    logEvent('admin.booking.deleted', { bookingId: booking.id, actorId: req.user.id });
    res.json({ data: { deleted: true } });
  }));

  router.get('/inquiries', asyncHandler(async (_req, res) => {
    const inquiries = await store.list('inquiry');
    inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ data: inquiries });
  }));

  router.patch('/inquiries/:id', asyncHandler(async (req, res) => {
    const { status } = inquiryStatusSchema.parse(req.body);
    const current = await store.get('inquiry', req.params.id);
    if (!current) throw new HttpError(404, 'INQUIRY_NOT_FOUND', 'We could not find that enquiry.');
    const updated = await store.update('inquiry', current.id, { status });
    logEvent('admin.inquiry.updated', { inquiryId: current.id, status, actorId: req.user.id });
    res.json({ data: updated });
  }));

  router.get('/import-issues', asyncHandler(async (_req, res) => {
    const issues = await store.list('importIssue');
    res.json({ data: issues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
  }));

  router.patch('/import-issues/:id', asyncHandler(async (req, res) => {
    const resolved = Boolean(req.body?.resolved);
    const issue = await store.update('importIssue', req.params.id, { resolved });
    if (!issue) throw new HttpError(404, 'ISSUE_NOT_FOUND', 'We could not find that data issue.');
    res.json({ data: issue });
  }));

  router.delete('/reviews/:id', asyncHandler(async (req, res) => {
    const review = await store.remove('review', req.params.id);
    if (!review) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'We could not find that review.');
    logEvent('admin.review.deleted', { reviewId: review.id, actorId: req.user.id });
    res.json({ data: { deleted: true } });
  }));

  router.post('/upload', (req, res, next) => {
    imageUpload.single('image')(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(400, 'FILE_TOO_LARGE', 'Images must be smaller than 4 MB.'));
        return next(error);
      }
      next();
    });
  }, asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'IMAGE_REQUIRED', 'Choose an image to upload.');
    const bytes = await readFile(req.file.path);
    if (!hasValidImageSignature(bytes, req.file.mimetype)) {
      await unlink(req.file.path).catch(() => {});
      throw new HttpError(400, 'INVALID_IMAGE_CONTENT', 'The uploaded file does not match its declared image type.');
    }
    logEvent('admin.image.uploaded', { filename: req.file.filename, actorId: req.user.id });
    res.status(201).json({ data: { url: `/api/uploads/${req.file.filename}`, fileName: req.file.filename, size: req.file.size } });
  }));

  return router;
}
