import { overlaps } from './data.js';

export const money = (value) => Math.round(Number(value) || 0);
export const isoToday = () => new Date().toISOString().slice(0, 10);
export function addIsoDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function nightsBetween(checkIn, checkOut) {
  return Math.max(0, Math.round((new Date(`${checkOut}T00:00:00Z`) - new Date(`${checkIn}T00:00:00Z`)) / 86400000));
}

export function availableRoomCount(room, bookings, checkIn, checkOut) {
  if (!checkIn || !checkOut) return room.inventory;
  let maxOccupied = 0;
  for (let night = new Date(`${checkIn}T00:00:00Z`); night < new Date(`${checkOut}T00:00:00Z`); night.setUTCDate(night.getUTCDate() + 1)) {
    const day = night.toISOString().slice(0, 10);
    const occupied = bookings.filter((booking) =>
      booking.roomTypeId === room.id && booking.status !== 'cancelled' &&
      booking.checkIn <= day && booking.checkOut > day
    ).length;
    maxOccupied = Math.max(maxOccupied, occupied);
  }
  return Math.max(0, room.inventory - maxOccupied);
}

export function peakBookedRooms(bookings, roomTypeId) {
  const occupiedByNight = new Map();
  for (const booking of bookings) {
    if (booking.roomTypeId !== roomTypeId || booking.status === 'cancelled') continue;
    for (let night = new Date(`${booking.checkIn}T00:00:00Z`); night < new Date(`${booking.checkOut}T00:00:00Z`); night.setUTCDate(night.getUTCDate() + 1)) {
      const day = night.toISOString().slice(0, 10);
      occupiedByNight.set(day, (occupiedByNight.get(day) || 0) + 1);
    }
  }
  return Math.max(0, ...occupiedByNight.values());
}

function aggregateForRange(properties, roomTypes, bookings, days, today) {
  const start = addIsoDays(today, -days);
  const end = today;
  const propertyRows = properties.map((property) => ({ propertyId: property.id, propertyName: property.name, inventory: 0, availableRoomNights: 0, occupiedRoomNights: 0, revenue: 0 }));
  const byId = new Map(propertyRows.map((row) => [row.propertyId, row]));
  for (const room of roomTypes) {
    const row = byId.get(room.propertyId);
    if (row) row.inventory += Number(room.inventory || 0);
  }
  for (const row of propertyRows) row.availableRoomNights = row.inventory * days;

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue;
    const room = roomTypes.find((item) => item.id === booking.roomTypeId);
    const row = byId.get(booking.propertyId);
    if (!room || !row) continue;
    const totalNights = nightsBetween(booking.checkIn, booking.checkOut);
    if (!totalNights) continue;
    const nightlyRate = Number(booking.totalPrice || 0) / totalNights;
    for (let night = new Date(`${start}T00:00:00Z`); night < new Date(`${end}T00:00:00Z`); night.setUTCDate(night.getUTCDate() + 1)) {
      const date = night.toISOString().slice(0, 10);
      if (booking.checkIn <= date && booking.checkOut > date) {
        row.occupiedRoomNights += 1;
        row.revenue += nightlyRate;
      }
    }
  }

  const sum = propertyRows.reduce((total, row) => ({
    inventory: total.inventory + row.inventory,
    availableRoomNights: total.availableRoomNights + row.availableRoomNights,
    occupiedRoomNights: total.occupiedRoomNights + row.occupiedRoomNights,
    revenue: total.revenue + row.revenue,
  }), { inventory: 0, availableRoomNights: 0, occupiedRoomNights: 0, revenue: 0 });
  const makeMetrics = (row) => ({
    ...row,
    occupancyRate: row.availableRoomNights ? Math.round(row.occupiedRoomNights / row.availableRoomNights * 1000) / 10 : 0,
    adr: row.occupiedRoomNights ? Math.round(row.revenue / row.occupiedRoomNights) : 0,
    revpar: row.availableRoomNights ? Math.round(row.revenue / row.availableRoomNights) : 0,
    revenue: Math.round(row.revenue),
  });
  return { startDate: start, endDate: end, ...makeMetrics(sum), byProperty: propertyRows.map(makeMetrics).sort((a, b) => b.revenue - a.revenue) };
}

export function calculateDashboardMetrics({ properties, roomTypes, bookings, days = 30, today = isoToday() }) {
  const requestedDays = Number(days);
  const safeDays = Number.isInteger(requestedDays) && requestedDays > 0 && requestedDays <= 365 ? requestedDays : 30;
  const period = aggregateForRange(properties, roomTypes, bookings, safeDays, today);
  const previousEnd = addIsoDays(today, -safeDays);
  const previousPeriod = aggregateForRange(properties, roomTypes, bookings, safeDays, previousEnd);
  return {
    period,
    previousPeriod,
    delta: {
      occupancyRate: Math.round((period.occupancyRate - previousPeriod.occupancyRate) * 10) / 10,
      adr: period.adr - previousPeriod.adr,
      revpar: period.revpar - previousPeriod.revpar,
      revenue: period.revenue - previousPeriod.revenue,
    },
  };
}

export function toPublicProperty(property, roomTypes, reviews, bookings, dates = {}) {
  const rooms = roomTypes.filter((room) => room.propertyId === property.id).map((room) => ({
    ...room,
    availableRooms: availableRoomCount(room, bookings, dates.checkIn, dates.checkOut),
  }));
  const matchingReviews = reviews.filter((review) => review.propertyId === property.id);
  const reviewAverage = matchingReviews.length
    ? matchingReviews.reduce((sum, review) => sum + Number(review.rating), 0) / matchingReviews.length
    : Number(property.rating || 4.5);
  return {
    ...property,
    rating: Math.round(reviewAverage * 10) / 10,
    reviewCount: matchingReviews.length,
    minPriceInr: rooms.length ? Math.min(...rooms.map((room) => Number(room.priceInr))) : 0,
    roomTypes: rooms,
    amenities: property.amenities || [],
  };
}

export function bookingNightsAndRevenue(bookings, roomTypes) {
  return bookings.reduce((acc, booking) => {
    if (booking.status === 'cancelled') return acc;
    const room = roomTypes.find((item) => item.id === booking.roomTypeId);
    if (!room) return acc;
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    acc.nights += nights;
    acc.revenue += Number(booking.totalPrice || 0);
    return acc;
  }, { nights: 0, revenue: 0 });
}
