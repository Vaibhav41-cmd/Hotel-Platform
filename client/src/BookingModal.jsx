import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, ShieldCheck, X } from 'lucide-react';
import { api, assetUrl } from './api.js';
import { bookingSchema } from './validation.js';

const nights = (start, end) => Math.max(0, Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000));
const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function BookingModal({ property, room, user, token, defaultDates, onClose, onSuccess }) {
  const [values, setValues] = useState({
    checkIn: defaultDates.checkIn,
    checkOut: defaultDates.checkOut,
    guests: Math.min(Number(defaultDates.guests || 2), room.maxGuests),
    guestName: user.name,
    guestPhone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const totalNights = useMemo(() => nights(values.checkIn, values.checkOut), [values.checkIn, values.checkOut]);
  const total = totalNights * Number(room.priceInr);

  const change = (event) => {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    const parsed = bookingSchema.safeParse({ ...values, guests: Number(values.guests) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message || 'Please check your stay details.');
    setBusy(true);
    setError('');
    try {
      const booking = await api('/bookings', { token, method: 'POST', body: { ...parsed.data, roomTypeId: room.id } });
      onSuccess(booking);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal modal-card" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="booking-summary-image" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(20,34,28,.5)), url("${assetUrl(property.heroImage)}")` }}>
          <span className="image-kicker"><span /> YOUR STAY, THOUGHTFULLY FOUND</span>
          <h2>{property.name}</h2>
          <p>{property.neighborhood} · Mumbai</p>
        </div>
        <div className="booking-content">
          <div className="booking-room-heading"><div><span className="eyebrow">RESERVATION DETAILS</span><h3 id="booking-title">{room.name}</h3><p className="muted">Up to {room.maxGuests} guests · {room.description}</p></div><div className="room-rate"><strong>{formatINR(room.priceInr)}</strong><span>per night</span></div></div>
          <form className="stack-form booking-form" onSubmit={submit}>
            <div className="form-grid two">
              <label className="field-label">Check-in<span className="field-with-icon"><CalendarDays size={15} /><input type="date" name="checkIn" min={defaultDates.today || defaultDates.checkIn} value={values.checkIn} onChange={change} required /></span></label>
              <label className="field-label">Check-out<span className="field-with-icon"><CalendarDays size={15} /><input type="date" name="checkOut" min={values.checkIn} value={values.checkOut} onChange={change} required /></span></label>
            </div>
            <div className="form-grid two">
              <label className="field-label">Guests<select name="guests" value={values.guests} onChange={change}>{Array.from({ length: room.maxGuests }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index ? 'guests' : 'guest'}</option>)}</select></label>
              <label className="field-label">Guest name<input name="guestName" value={values.guestName} onChange={change} autoComplete="name" required /></label>
            </div>
            <label className="field-label">Phone (optional)<input name="guestPhone" type="tel" value={values.guestPhone} onChange={change} placeholder="+91" autoComplete="tel" /></label>
            <div className="booking-total-row"><div><span>{formatINR(room.priceInr)} × {totalNights} {totalNights === 1 ? 'night' : 'nights'}</span><strong>Total due at the property</strong></div><b>{formatINR(total)}</b></div>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <button className="button button-dark full-width" disabled={busy}>{busy ? 'Checking availability…' : 'Confirm this stay'}<ArrowRight size={17} /></button>
            <div className="secure-note"><ShieldCheck size={15} /> No charge now · Your booking is held securely</div>
          </form>
        </div>
      </section>
    </div>
  );
}
