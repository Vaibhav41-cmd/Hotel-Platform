import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, MessageCircle, X } from 'lucide-react';
import { api } from './api.js';
import { inquirySchema } from './validation.js';

const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const formatDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function TripsModal({ token, onClose, onChanged }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = async () => {
    setLoading(true);
    try { setBookings(await api('/bookings/mine', { token })); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [token]);
  const cancel = async (booking) => {
    if (!window.confirm(`Cancel your stay at ${booking.propertyName}?`)) return;
    setBusyId(booking.id);
    setError('');
    try {
      await api(`/bookings/${booking.id}/cancel`, { token, method: 'PATCH', body: {} });
      await load();
      onChanged?.('Your reservation has been cancelled.');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(''); }
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="side-modal modal-card" role="dialog" aria-modal="true" aria-labelledby="trips-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <span className="eyebrow">YOUR SEREIN JOURNAL</span><h2 id="trips-title">My stays</h2><p className="muted">All the little moments, in one place.</p>
        {loading ? <div className="loading-state small-loader">Loading your stays…</div> : error && !bookings.length ? <div className="inline-error">{error}</div> : !bookings.length ? <div className="empty-state compact-empty"><CalendarDays size={24} /><h3>Nothing on the calendar yet.</h3><p>When you book a stay, you’ll find it here.</p><button className="button button-outline" onClick={onClose}>Explore stays<ArrowRight size={15} /></button></div> : <div className="trip-list">{bookings.map((booking) => <article className="trip-card" key={booking.id}><div className="trip-card-top"><span className={`status-pill status-${booking.status}`}>{booking.status.replace('_', ' ')}</span><span className="tiny-muted">{booking.confirmation}</span></div><h3>{booking.propertyName}</h3><p className="muted"><MapPin size={13} /> {booking.neighborhood} · {booking.roomName}</p><div className="trip-dates"><span><small>CHECK IN</small><b>{formatDate(booking.checkIn)}</b></span><span className="trip-arrow">→</span><span><small>CHECK OUT</small><b>{formatDate(booking.checkOut)}</b></span></div><div className="trip-card-bottom"><span>{booking.guests} guests · {formatINR(booking.totalPrice)}</span>{booking.status === 'confirmed' && <button className="text-button danger-text" disabled={busyId === booking.id} onClick={() => cancel(booking)}>{busyId === booking.id ? 'Cancelling…' : 'Cancel stay'}</button>}</div></article>)}</div>}
        {error && bookings.length > 0 && <div className="inline-error trips-error">{error}</div>}
      </section>
    </div>
  );
}

export function InquiryModal({ onClose, onSuccess }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', checkIn: '', checkOut: '', message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const change = (event) => { setValues((previous) => ({ ...previous, [event.target.name]: event.target.value })); setError(''); };
  const submit = async (event) => {
    event.preventDefault();
    const parsed = inquirySchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message || 'Please check your details.');
    setBusy(true);
    try {
      await api('/inquiries', { method: 'POST', body: parsed.data });
      setComplete(true);
      onSuccess?.();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inquiry-modal modal-card" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="inquiry-art"><MessageCircle size={22} /><span className="eyebrow">A NOTE TO OUR CONCIERGE</span><h2>Tell us what<br />you have in mind.</h2><p>Odd dates, a little celebration, a favourite corner of town — we’re listening.</p><div className="concierge-mark">SEREIN · HERE FOR YOU</div></div>
        <div className="inquiry-form-wrap">
          {complete ? <div className="inquiry-success"><span className="success-icon"><Check size={21} /></span><span className="eyebrow">NOTE RECEIVED</span><h2 id="inquiry-title">We’ll take it from here.</h2><p className="muted">A member of our front desk team will be in touch soon. Thank you for thinking of Serein.</p><button className="button button-dark" onClick={onClose}>Lovely, thanks<ArrowRight size={16} /></button></div> : <><span className="eyebrow">WE’RE ALL EARS</span><h2 id="inquiry-title">How can we help?</h2><form className="stack-form" onSubmit={submit}><div className="form-grid two"><label className="field-label">Your name<input name="name" value={values.name} onChange={change} required placeholder="Aanya Mehta" /></label><label className="field-label">Email<input name="email" type="email" value={values.email} onChange={change} required placeholder="you@example.com" /></label></div><div className="form-grid two"><label className="field-label">Check-in (optional)<input type="date" name="checkIn" value={values.checkIn} onChange={change} /></label><label className="field-label">Check-out (optional)<input type="date" name="checkOut" value={values.checkOut} onChange={change} /></label></div><label className="field-label">A number to reach you (optional)<input name="phone" type="tel" value={values.phone} onChange={change} placeholder="+91" /></label><label className="field-label">Your note<textarea name="message" value={values.message} onChange={change} rows="4" required placeholder="I’m looking for a quiet room near…" /></label>{error && <div className="inline-error" role="alert">{error}</div>}<button className="button button-dark full-width" disabled={busy}>{busy ? 'Sending your note…' : 'Send to the concierge'}<ArrowRight size={16} /></button><p className="tiny-muted form-footnote"><Clock3 size={13} /> Usually back to you within one working day.</p></form></>}
        </div>
      </section>
    </div>
  );
}
