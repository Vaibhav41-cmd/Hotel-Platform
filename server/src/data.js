import { randomUUID } from 'node:crypto';

const id = () => randomUUID();
const addDays = (date, amount) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

export function normalizeRoomName(label = '') {
  const value = label.trim().toLowerCase();
  if (/queen/.test(value) && /(classic|standard|heritage)/.test(value)) return 'Classic Queen';
  if (/king/.test(value) && /(classic|standard)/.test(value)) return 'Classic King';
  if (/king/.test(value) && /(deluxe|premier|premium)/.test(value)) return 'Deluxe King';
  if (/(sea|ocean|harbou?r|marine).*(view|facing)|(view|facing).*(sea|ocean|harbou?r|marine)/.test(value)) return 'Sea View Suite';
  if (/(courtyard|garden|veranda)/.test(value)) return 'Courtyard Room';
  if (/(junior|studio).*(suite)|(suite).*(junior|studio)/.test(value)) return 'Junior Suite';
  if (/family/.test(value)) return 'Family Room';
  return label.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isValidStay(checkIn, checkOut) {
  const isCalendarDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  return isCalendarDate(checkIn) && isCalendarDate(checkOut) && checkOut > checkIn;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export const propertyBlueprints = [
  {
    slug: 'harbor-house', name: 'Harbor House', neighborhood: 'Fort', rating: 4.9, featured: true,
    description: 'A discreet art-filled address in the old trading quarter, where grand Bombay balconies meet a quietly modern point of view.',
    address: '14 Ropewalk Lane, Fort, Mumbai', amenities: ['Heritage architecture', 'Rooftop bar', 'All-day dining', 'Concierge'],
    rooms: [['Classic Queen Room', 11800, 'INR', 7, 2], ['Harbour-facing King', 198, 'USD', 4, 2]],
  },
  {
    slug: 'the-mangrove', name: 'The Mangrove', neighborhood: 'Colaba', rating: 4.8, featured: true,
    description: 'A leafy sanctuary just off the waterfront, with sun-washed rooms, local art and a very good breakfast downstairs.',
    address: '7 Battery Street, Colaba, Mumbai', amenities: ['Garden courtyard', 'Breakfast', 'Library lounge', 'Airport transfer'],
    rooms: [['Garden Classic Queen', 10400, 'INR', 6, 2], ['Ocean View Suite', 225, 'USD', 3, 2]],
  },
  {
    slug: 'banyan-and-brass', name: 'Banyan & Brass', neighborhood: 'Bandra West', rating: 4.9, featured: true,
    description: 'An intimate, design-led hideaway on a lively Bandra lane, layered with handwoven textures and brass from local ateliers.',
    address: '22 Chapel Road, Bandra West, Mumbai', amenities: ['Design studio', 'Cafe', 'Pet friendly', 'Yoga deck'],
    rooms: [['Queen Classic', 13200, 'INR', 5, 2], ['Deluxe King Bedroom', 17900, 'INR', 4, 2]],
  },
  {
    slug: 'casa-pali', name: 'Casa Pali', neighborhood: 'Pali Hill', rating: 4.7, featured: false,
    description: 'A lived-in, light-filled townhouse stay on a leafy hill, made for slow mornings and evenings on the terrace.',
    address: '5 St. John Baptist Road, Pali Hill, Mumbai', amenities: ['Terrace', 'Breakfast', 'Cowork nook', 'Laundry'],
    rooms: [['Heritage Queen Classic', 148, 'USD', 4, 2], ['Veranda Suite', 21000, 'INR', 2, 3]],
  },
  {
    slug: 'monsoon-house', name: 'Monsoon House', neighborhood: 'Juhu', rating: 4.6, featured: false,
    description: 'A breezy coastal retreat with a private garden and the soft rhythm of the Arabian Sea just a short walk away.',
    address: '19 Juhu Tara Road, Juhu, Mumbai', amenities: ['Pool', 'Garden', 'Beach access', 'Family friendly'],
    rooms: [['Standard King Room', 15600, 'INR', 8, 2], ['Sea-facing Suite', 248, 'USD', 3, 3]],
  },
  {
    slug: 'house-of-iris', name: 'House of Iris', neighborhood: 'Khar West', rating: 4.8, featured: false,
    description: 'A jewel-box residence that pairs contemporary Indian craft with a calm, residential pace in the heart of Khar.',
    address: '31 14th Road, Khar West, Mumbai', amenities: ['Library', 'In-room dining', 'Spa treatments', 'Valet parking'],
    rooms: [['Classic Queen Room', 11500, 'INR', 5, 2], ['Premier King Room', 16800, 'INR', 3, 2]],
  },
  {
    slug: 'sea-glass-residency', name: 'Sea Glass Residency', neighborhood: 'Versova', rating: 4.5, featured: false,
    description: 'A sunlit collection of coastal suites with thoughtful details, easygoing service and a horizon-facing rooftop.',
    address: '4 Yari Road, Versova, Mumbai', amenities: ['Rooftop', 'Kitchenette', 'Coastal walks', 'Long-stay rates'],
    rooms: [['Marine View King', 189, 'USD', 4, 2], ['Studio Junior Suite', 17400, 'INR', 5, 2]],
  },
  {
    slug: 'pali-village-stay', name: 'Pali Village Stay', neighborhood: 'Bandra West', rating: 4.7, featured: false,
    description: 'A friendly village-style guesthouse with restored Portuguese details, a generous breakfast table and a local spirit.',
    address: '9 Waroda Road, Bandra West, Mumbai', amenities: ['Breakfast', 'Courtyard', 'Local guide', 'Pet friendly'],
    rooms: [['Heritage Queen', 9700, 'INR', 6, 2], ['Courtyard Deluxe King', 15400, 'INR', 2, 2]],
  },
  {
    slug: 'gilded-palm', name: 'The Gilded Palm', neighborhood: 'Powai', rating: 4.6, featured: false,
    description: 'A polished city retreat by the lake, designed for work trips that deserve an unhurried finish.',
    address: '6 Lake Boulevard, Powai, Mumbai', amenities: ['Business lounge', 'Gym', 'Lake view', 'Airport transfer'],
    rooms: [['Classic King', 13900, 'INR', 9, 2], ['Deluxe Suite', 205, 'USD', 4, 3]],
  },
  {
    slug: 'studio-marine', name: 'Studio Marine', neighborhood: 'Marine Drive', rating: 4.8, featured: true,
    description: 'A modernist address above the curve of the bay, with thoughtful rooms and a front-row seat to the city at dusk.',
    address: '81 Marine Drive, Mumbai', amenities: ['Sea view', 'Roof terrace', 'Restaurant', 'Fitness room'],
    rooms: [['Ocean-facing Queen', 16400, 'INR', 5, 2], ['Marine View King Suite', 276, 'USD', 2, 2]],
  },
  {
    slug: 'cobalt-courtyard', name: 'Cobalt Courtyard', neighborhood: 'Lower Parel', rating: 4.6, featured: false,
    description: 'A quiet courtyard hotel in the city’s creative quarter, close to galleries, good coffee and late-night kitchens.',
    address: '12 Phoenix Mills Lane, Lower Parel, Mumbai', amenities: ['Courtyard cafe', 'Co-working', 'Gym', 'Late checkout'],
    rooms: [['Classic Queen', 12700, 'INR', 5, 2], ['Premier King', 175, 'USD', 4, 2]],
  },
  {
    slug: 'niraamaya-byculla', name: 'Niraamaya Byculla', neighborhood: 'Byculla', rating: 4.5, featured: false,
    description: 'A warm, unpretentious heritage stay near the botanical gardens, with a deep connection to the neighbourhood.',
    address: '3 Nesbit Road, Byculla, Mumbai', amenities: ['Garden', 'Heritage rooms', 'Breakfast', 'Concierge'],
    rooms: [['Standard Queen Room', 8200, 'INR', 7, 2], ['Garden Junior Suite', 132, 'USD', 3, 2]],
  },
  {
    slug: 'saffron-and-stone', name: 'Saffron & Stone', neighborhood: 'Dadar', rating: 4.7, featured: false,
    description: 'A warmly expressive city hotel with a neighbourhood kitchen and rooms grounded in the colours of the coast.',
    address: '18 Ranade Road, Dadar West, Mumbai', amenities: ['Neighbourhood kitchen', 'Art wall', 'Family rooms', 'Laundry'],
    rooms: [['Queen Classic Room', 10100, 'INR', 8, 2], ['Family Studio', 16200, 'INR', 3, 4]],
  },
  {
    slug: 'cedar-cuffe', name: 'Cedar Cuffe', neighborhood: 'Cuffe Parade', rating: 4.8, featured: false,
    description: 'An elegant, understated base at the southern tip of the city, with sea breezes and a considered little library.',
    address: '2 Jamanlal Bajaj Road, Cuffe Parade, Mumbai', amenities: ['Sea view', 'Library', 'Restaurant', 'Valet parking'],
    rooms: [['Harbour View King', 195, 'USD', 4, 2], ['Classic King Room', 14300, 'INR', 5, 2]],
  },
];

const guestNames = ['Aarav Mehta', 'Mira Shah', 'Kabir Iyer', 'Ananya Rao', 'Devika Nair', 'Rohan Kapoor', 'Tara Desai', 'Ishaan Kulkarni', 'Naina D’Souza', 'Vihaan Malhotra', 'Zoya Merchant', 'Arjun Bhat'];
const reviewLines = [
  ['A little pocket of calm', 'The team made the whole stay feel personal. Beautiful details, a lovely breakfast, and the location was perfect.'],
  ['Thoughtful from start to finish', 'A room with real character and a genuinely warm welcome. We would happily come back.'],
  ['Exactly the Bombay stay we wanted', 'Walkable, comfortable and full of small local touches. The concierge recommendations were excellent.'],
  ['A lovely home base', 'Impeccably clean, quietly stylish and very easy to settle into.'],
  ['A memorable weekend', 'The light in the room, the coffee in the morning and the attentive service all stood out.'],
];

export function buildSeedData({ fxUsdInr = Number(process.env.FX_USD_INR || 83.5) } = {}) {
  const createdAt = new Date().toISOString();
  const admin = { id: id(), name: 'Serein Front Desk', email: 'admin@sereinstays.demo', passwordHash: '', role: 'admin', createdAt };
  const guest = { id: id(), name: 'Aanya Guest', email: 'guest@sereinstays.demo', passwordHash: '', role: 'user', createdAt };
  const properties = propertyBlueprints.map((p) => ({
    id: id(), slug: p.slug, name: p.name, description: p.description, address: p.address,
    neighborhood: p.neighborhood, city: 'Mumbai', country: 'India', rating: p.rating,
    amenities: p.amenities, heroImage: '/hotel-hero.jpg', featured: p.featured, createdAt,
  }));

  const roomTypes = [];
  const sourceLabelByNormalizedName = new Map();
  propertyBlueprints.forEach((p, propertyIndex) => {
    p.rooms.forEach(([sourceLabel, sourcePrice, currency, inventory, maxGuests], roomIndex) => {
      const name = normalizeRoomName(sourceLabel);
      if (name !== sourceLabel) sourceLabelByNormalizedName.set(name, (sourceLabelByNormalizedName.get(name) || 0) + 1);
      const priceInr = Math.round((currency === 'USD' ? sourcePrice * fxUsdInr : sourcePrice) / 100) * 100;
      roomTypes.push({
        id: id(), propertyId: properties[propertyIndex].id, name, sourceLabel,
        description: roomIndex === 0 ? 'An inviting, well-appointed room with locally made details and a restful king or queen bed.' : 'A little more room to unwind, with considered comforts and a view worth lingering over.',
        maxGuests, inventory, basePrice: sourcePrice, currency, priceInr,
        amenities: roomIndex === 0 ? ['King or queen bed', 'Rain shower', 'High-speed Wi-Fi'] : ['Lounge corner', 'Rain shower', 'High-speed Wi-Fi', 'Breakfast for two'],
        createdAt,
      });
    });
  });

  const today = todayISO();
  const bookings = [];
  const invalidStayRecords = [];
  let bookingSequence = 0;
  propertyBlueprints.forEach((_blueprint, propertyIndex) => {
    const property = properties[propertyIndex];
    const propertyRooms = roomTypes.filter((room) => room.propertyId === property.id);
    propertyRooms.forEach((room, roomIndex) => {
      for (let unit = 0; unit < room.inventory; unit += 1) {
        // Fourteen staggered legacy stays per sellable room unit, five days apart;
        // a unit is never double-booked by the imported sample data.
        for (let slot = 0; slot < 14; slot += 1) {
          bookingSequence += 1;
          const checkIn = addDays(new Date(`${today}T00:00:00Z`), -38 + slot * 5 + (unit % 5));
          const nights = 2 + ((slot + unit + roomIndex) % 3);
          const checkOut = addDays(new Date(`${checkIn}T00:00:00Z`), nights);
          const sampleGuestBooking = propertyIndex === 0 && roomIndex === 0 && unit === 0 && slot >= 8;
          const createdAtMs = Math.min(Date.now(), Date.parse(`${checkIn}T00:00:00Z`) - 14 * 86400000);
          const raw = {
            sourceRecord: `legacy-stay-${String(bookingSequence).padStart(5, '0')}`,
            propertyId: property.id, roomTypeId: room.id,
            guestName: sampleGuestBooking ? guest.name : guestNames[bookingSequence % guestNames.length],
            guestEmail: sampleGuestBooking ? guest.email : `guest${(bookingSequence % 79) + 1}@example.test`,
            guestPhone: sampleGuestBooking ? '+91 98765 01010' : `+91 98${String(11000000 + bookingSequence).slice(-8)}`,
            checkIn, checkOut, guests: 1 + (bookingSequence % Math.min(room.maxGuests, 3)),
            status: 'confirmed', totalPrice: room.priceInr * nights, currency: 'INR',
            userId: sampleGuestBooking ? guest.id : null,
            createdAt: new Date(createdAtMs).toISOString(),
          };
          if (!isValidStay(raw.checkIn, raw.checkOut)) {
            invalidStayRecords.push({ sourceRecord: raw.sourceRecord, property: property.name, checkIn, checkOut, reason: 'checkOut must be after checkIn' });
            continue;
          }
          if (bookingSequence % 19 === 0 && !sampleGuestBooking) raw.status = 'cancelled';
          else if (raw.checkOut <= today) raw.status = 'completed';
          else if (raw.checkIn <= today) raw.status = 'checked_in';
          else raw.status = 'confirmed';
          bookings.push({ id: id(), confirmation: `SRN-${String(410000 + bookingSequence)}`, ...raw });
        }
      }
    });
  });
  // Two malformed source rows are retained as import issues, never as live stays.
  for (const [index, propertyIndex] of [3, 10].entries()) {
    const property = properties[propertyIndex];
    const checkIn = addDays(new Date(`${today}T00:00:00Z`), 18 + index * 9);
    const checkOut = addDays(new Date(`${checkIn}T00:00:00Z`), -1);
    invalidStayRecords.push({
      sourceRecord: `legacy-anomaly-${String(index + 1).padStart(4, '0')}`,
      property: property.name, checkIn, checkOut, reason: 'checkOut must be after checkIn',
    });
  }

  const reviews = [];
  for (let i = 0; i < 40; i += 1) {
    const [title, comment] = reviewLines[i % reviewLines.length];
    const property = properties[i % properties.length];
    reviews.push({
      id: id(), propertyId: property.id, userId: null, guestName: guestNames[(i * 3) % guestNames.length],
      rating: i % 9 === 0 ? 4 : 5, title, comment,
      createdAt: new Date(`${addDays(new Date(`${today}T00:00:00Z`), -(i * 2 + 1))}T12:00:00Z`).toISOString(),
    });
  }

  const inquiries = [
    { name: 'Riya Bhandari', email: 'riya.b@example.test', phone: '+91 98765 43210', message: 'We are planning a long weekend near Colaba in December. Could you suggest a room with a little extra space?', status: 'new' },
    { name: 'Oliver Grant', email: 'oliver.g@example.test', phone: '', message: 'Please share details about an airport transfer for a late arrival.', status: 'in_progress' },
    { name: 'Neha Prasad', email: 'neha.p@example.test', phone: '+91 99887 76655', message: 'Looking for a small family stay in Bandra for four nights.', status: 'new' },
  ].map((inquiry, index) => ({ id: id(), ...inquiry, createdAt: new Date(`${addDays(new Date(`${today}T00:00:00Z`), -index)}T08:00:00Z`).toISOString() }));
  const importIssues = invalidStayRecords.map((issue, index) => ({
    id: id(), sourceRecord: issue.sourceRecord, entity: 'booking', issue: issue.reason,
    payload: issue, resolved: false, createdAt: new Date(`${today}T06:00:00Z`).toISOString(),
  }));

  return {
    users: [admin, guest], properties, roomTypes, bookings, reviews, inquiries, refreshTokens: [], importIssues,
    dataQuality: {
      sourcePropertyCount: properties.length,
      importedRoomTypeCount: roomTypes.length,
      roomLabelVariantsNormalized: [...sourceLabelByNormalizedName.values()].reduce((sum, value) => sum + value, 0),
      usdRatesConverted: roomTypes.filter((room) => room.currency === 'USD').length,
      invalidStaysQuarantined: invalidStayRecords.length,
      invalidStayRecords,
      fxUsdInr,
    },
  };
}
