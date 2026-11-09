import { Router } from 'express';
import { asyncHandler, HttpError, logEvent } from '../http.js';
import { reviewSchema } from '../validation.js';
import { isValidStay } from '../data.js';
import { toPublicProperty } from '../utils.js';

export function propertyRoutes({ store, authenticate }) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    const [properties, roomTypes, reviews, bookings] = await Promise.all([
      store.list('property'), store.list('roomType'), store.list('review'), store.list('booking'),
    ]);
    const { checkIn, checkOut } = req.query;
    if ((checkIn || checkOut) && !isValidStay(String(checkIn || ''), String(checkOut || ''))) {
      throw new HttpError(400, 'INVALID_STAY', 'Choose valid dates and make sure check-out is after check-in.');
    }
    const city = String(req.query.city || '').trim().toLowerCase();
    const neighborhood = String(req.query.neighborhood || '').trim().toLowerCase();
    const search = String(req.query.q || '').trim().toLowerCase();
    const guests = Math.max(1, Number.parseInt(req.query.guests || '1', 10) || 1);
    const minPrice = req.query.minPrice === undefined ? 0 : Number(req.query.minPrice);
    const maxPrice = req.query.maxPrice === undefined ? Number.POSITIVE_INFINITY : Number(req.query.maxPrice);
    const minRating = req.query.minRating === undefined ? 0 : Number(req.query.minRating);
    if (!Number.isFinite(minPrice) || minPrice < 0 || Number.isNaN(maxPrice) || maxPrice < minPrice || !Number.isFinite(minRating)) {
      throw new HttpError(400, 'INVALID_FILTER', 'One or more search filters are invalid.');
    }
    const wantedAmenities = String(req.query.amenities || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    let result = properties.map((property) => toPublicProperty(property, roomTypes, reviews, bookings, { checkIn, checkOut }));
    result = result.filter((property) => {
      const matchesLocation = (!city || property.city.toLowerCase().includes(city)) && (!neighborhood || property.neighborhood.toLowerCase().includes(neighborhood));
      const matchesText = !search || `${property.name} ${property.neighborhood} ${property.description} ${property.amenities.join(' ')}`.toLowerCase().includes(search);
      const matchingRooms = property.roomTypes.filter((room) => room.maxGuests >= guests && room.availableRooms > 0 && room.priceInr >= minPrice && room.priceInr <= maxPrice);
      const matchesRating = property.rating >= minRating;
      const amenityText = property.amenities.join(' ').toLowerCase();
      const matchesAmenities = wantedAmenities.every((amenity) => amenityText.includes(amenity));
      property.roomTypes = matchingRooms;
      property.minPriceInr = matchingRooms.length ? Math.min(...matchingRooms.map((room) => Number(room.priceInr))) : 0;
      return matchesLocation && matchesText && matchingRooms.length > 0 && matchesRating && matchesAmenities;
    });
    const sort = String(req.query.sort || 'recommended');
    if (sort === 'price-asc') result.sort((a, b) => a.minPriceInr - b.minPriceInr);
    else if (sort === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    else result.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
    res.json({ data: result, meta: { count: result.length, currency: 'INR' } });
  }));

  router.get('/:slug', asyncHandler(async (req, res) => {
    const [properties, roomTypes, reviews, bookings] = await Promise.all([
      store.list('property'), store.list('roomType'), store.list('review'), store.list('booking'),
    ]);
    const property = properties.find((item) => item.slug === req.params.slug);
    if (!property) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'We could not find that stay.');
    const { checkIn, checkOut } = req.query;
    if ((checkIn || checkOut) && !isValidStay(String(checkIn || ''), String(checkOut || ''))) {
      throw new HttpError(400, 'INVALID_STAY', 'Choose valid dates and make sure check-out is after check-in.');
    }
    const result = toPublicProperty(property, roomTypes, reviews, bookings, { checkIn, checkOut });
    const guests = Math.max(1, Number.parseInt(req.query.guests || '1', 10) || 1);
    result.roomTypes = result.roomTypes.filter((room) => room.maxGuests >= guests && room.availableRooms > 0);
    result.minPriceInr = result.roomTypes.length ? Math.min(...result.roomTypes.map((room) => Number(room.priceInr))) : 0;
    result.reviews = reviews.filter((review) => review.propertyId === property.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ data: result });
  }));

  router.post('/reviews', authenticate, asyncHandler(async (req, res) => {
    const body = reviewSchema.parse(req.body);
    const property = await store.get('property', body.propertyId);
    if (!property) throw new HttpError(404, 'PROPERTY_NOT_FOUND', 'We could not find that stay.');
    const existing = (await store.list('review')).find((review) => review.propertyId === body.propertyId && review.userId === req.user.id);
    if (existing) throw new HttpError(409, 'REVIEW_EXISTS', 'You have already left a review for this stay.');
    const review = await store.create('review', { ...body, userId: req.user.id, guestName: req.user.name });
    logEvent('review.created', { reviewId: review.id, propertyId: property.id, userId: req.user.id });
    res.status(201).json({ data: review });
  }));

  return router;
}
