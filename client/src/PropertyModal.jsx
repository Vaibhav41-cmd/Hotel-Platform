import { ArrowRight, BadgeCheck, BedDouble, CalendarDays, Check, MapPin, Sparkles, Star, X } from 'lucide-react';
import { assetUrl } from './api.js';

const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function PropertyModal({ property, onClose, onBook, dates }) {
  if (!property) return null;
  return (
    <div className="modal-backdrop property-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="property-modal modal-card" role="dialog" aria-modal="true" aria-labelledby="property-title">
        <button className="icon-button modal-close property-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="property-detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(23,38,31,.6), rgba(23,38,31,.08)), linear-gradient(0deg, rgba(13,28,22,.32), transparent 60%), url("${assetUrl(property.heroImage)}")` }}>
          <div className="detail-hero-copy"><span className="image-kicker"><span /> A SEREIN ORIGINAL</span><h2 id="property-title">{property.name}</h2><p><MapPin size={15} /> {property.neighborhood}, Mumbai</p></div>
          <div className="detail-score"><Star size={15} fill="currentColor" /><b>{Number(property.rating).toFixed(1)}</b><span> · {property.reviewCount} guest notes</span></div>
        </div>
        <div className="property-detail-body">
          <div className="detail-main-column">
            <div className="detail-intro"><div><span className="eyebrow">THE NEIGHBOURHOOD, AT YOUR PACE</span><p>{property.description}</p></div><div className="detail-location-chip"><MapPin size={15} /><span>{property.address}</span></div></div>
            <div className="detail-amenities"><span className="eyebrow">THE LITTLE EXTRAS</span><div className="amenities-grid">{property.amenities.map((amenity) => <span key={amenity}><Check size={14} />{amenity}</span>)}</div></div>
            <div className="room-selection">
              <div className="section-heading-inline"><div><span className="eyebrow">MAKE IT YOURS</span><h3>Choose a room</h3></div><span className="date-chip"><CalendarDays size={14} />{dates.checkIn} — {dates.checkOut}</span></div>
              <div className="detail-room-list">
                {property.roomTypes.map((room) => <article className="detail-room-card" key={room.id}>
                  <div className="room-icon"><BedDouble size={19} /></div>
                  <div className="room-info"><h4>{room.name}</h4><p>{room.description}</p><div className="room-meta"><span>Up to {room.maxGuests} guests</span><span>{room.availableRooms > 0 ? `${room.availableRooms} available` : 'Sold out for these dates'}</span></div></div>
                  <div className="room-choose"><strong>{formatINR(room.priceInr)}</strong><span>per night</span><button className="button button-outline compact" disabled={!room.availableRooms} onClick={() => onBook(room)}>{room.availableRooms ? 'Choose room' : 'Unavailable'}<ArrowRight size={14} /></button></div>
                </article>)}
                {!property.roomTypes.length && <div className="empty-room">There are no rooms available for these dates. Try adjusting your stay.</div>}
              </div>
            </div>
          </div>
          <aside className="review-rail">
            <div className="review-rail-top"><Sparkles size={17} /><span>FROM OUR GUESTBOOK</span></div>
            {(property.reviews || []).slice(0, 3).map((review) => <blockquote className="guest-quote" key={review.id}><div className="review-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={11} fill={index < review.rating ? 'currentColor' : 'none'} />)}</div><p>“{review.comment}”</p><footer><span className="review-avatar">{review.guestName.slice(0, 1)}</span><span><b>{review.guestName}</b><small>Stayed with us</small></span><BadgeCheck size={14} /></footer></blockquote>)}
            {(!property.reviews || !property.reviews.length) && <p className="muted">A stay worth remembering is waiting to be written.</p>}
            <div className="rail-note"><Check size={15} /><span>Every Serein stay is handpicked for its feeling, not just its finish.</span></div>
          </aside>
        </div>
      </section>
    </div>
  );
}
