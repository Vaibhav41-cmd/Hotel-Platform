import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BedDouble, CalendarDays, Check, ChevronDown, Clock3, Compass, Heart, Leaf, MapPin, Menu, MessageCircle, Search, ShieldCheck, Sparkles, Star, Sun, Users, Wind, X } from 'lucide-react';
import { api, assetUrl, setAccessToken, subscribeAccessToken } from './api.js';
import AuthModal from './AuthModal.jsx';
import BookingModal from './BookingModal.jsx';
import PropertyModal from './PropertyModal.jsx';
import AdminPanel from './AdminPanel.jsx';
import { InquiryModal, TripsModal } from './GuestPanels.jsx';

const todayLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};
const addDays = (value, days) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Choose date';

const palette = [
  'linear-gradient(135deg,rgba(15,45,37,.04),rgba(110,72,48,.25))',
  'linear-gradient(135deg,rgba(26,54,41,.08),rgba(61,89,72,.35))',
  'linear-gradient(135deg,rgba(63,43,33,.02),rgba(120,58,43,.3))',
  'linear-gradient(135deg,rgba(35,52,60,.02),rgba(39,83,90,.3))',
];

export default function App() {
  const today = useMemo(todayLocal, []);
  const [filters, setFilters] = useState({ q: '', checkIn: today, checkOut: addDays(today, 2), guests: 2, minPrice: '', maxPrice: '', sort: 'recommended', amenity: '' });
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [apiError, setApiError] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [tripOpen, setTripOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [amenityFilter, setAmenityFilter] = useState('');

  const loadProperties = useCallback(async (values = filters) => {
    setLoadingProperties(true);
    setApiError('');
    try {
      const params = new URLSearchParams();
      if (values.q) params.set('q', values.q);
      if (values.checkIn) params.set('checkIn', values.checkIn);
      if (values.checkOut) params.set('checkOut', values.checkOut);
      params.set('guests', String(values.guests || 1));
      params.set('sort', values.sort || 'recommended');
      if (values.minPrice) params.set('minPrice', values.minPrice);
      if (values.maxPrice) params.set('maxPrice', values.maxPrice);
      if (values.amenity) params.set('amenities', values.amenity);
      const data = await api(`/properties?${params.toString()}`);
      setProperties(data);
    } catch (error) {
      setApiError(error.message);
      setProperties([]);
    } finally {
      setLoadingProperties(false);
    }
  }, [filters]);

  useEffect(() => { void loadProperties(filters); }, []);
  useEffect(() => subscribeAccessToken((nextToken) => {
    setToken(nextToken);
    if (!nextToken) setUser(null);
  }), []);
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const session = await api('/auth/refresh', { method: 'POST' });
        if (mounted) { setAccessToken(session.accessToken); setUser(session.user); }
      } catch { /* a guest has no refresh cookie */ }
      finally { if (mounted) setSessionReady(true); }
    };
    void restoreSession();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const search = (event) => {
    event?.preventDefault();
    if (filters.checkIn && filters.checkOut && filters.checkOut <= filters.checkIn) {
      setApiError('Check-out must be after check-in.');
      return;
    }
    void loadProperties(filters);
    document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const updateFilter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  const openProperty = async (slug) => {
    setApiError('');
    try {
      const params = new URLSearchParams({ checkIn: filters.checkIn, checkOut: filters.checkOut, guests: String(filters.guests) });
      const detail = await api(`/properties/${slug}?${params.toString()}`);
      setSelectedProperty(detail);
    } catch (error) { setToast(error.message); }
  };
  const bookRoom = (room) => {
    if (!user) {
      setPendingRoom({ property: selectedProperty, room });
      setAuthOpen(true);
      return;
    }
    setBookingRoom(room);
  };
  const onAuthSuccess = (session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setAuthOpen(false);
    setToast(`Welcome in, ${session.user.name.split(' ')[0]}.`);
    if (pendingRoom) {
      setBookingRoom(pendingRoom.room);
      setPendingRoom(null);
    }
  };
  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* local sign out should still work */ }
    setAccessToken(''); setUser(null); setTripOpen(false); setAdminOpen(false); setToast('You’ve signed out. See you soon.');
  };
  const bookingSuccess = (booking) => {
    setBookingRoom(null);
    setSelectedProperty(null);
    setToast(`Your stay is confirmed · ${booking.confirmation}`);
    setTripOpen(true);
  };
  const doInquirySuccess = () => {
    setToast('Your note is with our concierge. We’ll be in touch soon.');
  };
  const propertyCountLabel = loadingProperties ? 'Finding your corner of Mumbai…' : `${properties.length} thoughtful ${properties.length === 1 ? 'stay' : 'stays'} to come home to`;

  if (adminOpen && user?.role === 'admin') return <AdminPanel token={token} user={user} onClose={() => setAdminOpen(false)} onToast={setToast} />;

  return (
    <div className="site-shell">
      <div className="announcement"><span className="announce-spark">✳</span> A softer way to see Mumbai <span className="announcement-sep">·</span> <span>14 little addresses, one thoughtful welcome.</span> <a href="#stays">Find yours <ArrowRight size={13} /></a></div>
      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="Serein Stays home"><span className="brand-mark">S<span>.</span></span><span className="brand-type">Serein <small>STAYS IN MUMBAI</small></span></a>
        <nav className={`main-nav ${mobileMenuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          <a href="#stays" onClick={() => setMobileMenuOpen(false)}>The stays</a>
          <a href="#our-way" onClick={() => setMobileMenuOpen(false)}>Our way</a>
          <a href="#neighbourhoods" onClick={() => setMobileMenuOpen(false)}>The city</a>
          <button className="mobile-contact-link" onClick={() => { setInquiryOpen(true); setMobileMenuOpen(false); }}>Ask our concierge</button>
        </nav>
        <div className="header-actions">
          {user ? <><button className="header-user-button" onClick={() => setTripOpen(true)}><span className="mini-avatar">{user.name.slice(0, 1)}</span><span>My stays</span></button>{user.role === 'admin' && <button className="front-desk-link" onClick={() => setAdminOpen(true)}><Compass size={15} /> Front desk</button>}<button className="header-signin" onClick={signOut} title="Sign out">Sign out</button></> : <><button className="header-signin" onClick={() => setAuthOpen(true)}>Sign in <ArrowUpRight size={14} /></button><button className="button button-dark header-cta" onClick={() => setInquiryOpen(true)}>Plan a stay <ArrowRight size={15} /></button></>}
        </div>
        <button className="mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenuOpen((value) => !value)}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </header>

      <main id="top">
        <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(21,39,32,.72) 0%,rgba(23,40,34,.49) 48%,rgba(21,35,30,.08) 100%),linear-gradient(0deg,rgba(19,35,29,.35),transparent 45%),url("${assetUrl('/hotel-hero.jpg')}")` }}>
          <div className="hero-inner">
            <div className="hero-content"><div className="hero-overline"><span className="eyebrow-line" /> BOUTIQUE STAYS, BY SEREIN <span className="eyebrow-light-dot">✳</span></div><h1>Find your<br />own <em>Bombay.</em></h1><p>Small, soulful stays in the neighbourhoods that make this city feel like nowhere else.</p><a href="#stays" className="hero-discovery"><span className="discovery-icon"><ArrowDown size={15} /></span><span>Come find your corner</span><span className="hero-discovery-line" /></a></div>
            <div className="hero-side-note"><span>19° 04' N<br />72° 52' E</span><span className="side-note-rule" /><span>MUMBAI, INDIA<br />ALWAYS A GOOD IDEA</span></div>
            <div className="hero-index"><span>01</span><i /> A CITY THAT NEVER STAYS STILL</div>
          </div>
          <form className="search-panel" onSubmit={search}>
            <label className="search-field destination-field"><span className="search-icon"><MapPin size={17} /></span><span className="search-field-content"><small>WHERE TO?</small><input value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} placeholder="Neighbourhood or stay" aria-label="Neighbourhood or stay" /></span></label>
            <span className="search-divider" />
            <label className="search-field"><span className="search-icon"><CalendarDays size={17} /></span><span className="search-field-content"><small>CHECK IN</small><input type="date" min={today} value={filters.checkIn} onChange={(event) => updateFilter('checkIn', event.target.value)} aria-label="Check-in date" /></span></label>
            <span className="search-divider" />
            <label className="search-field"><span className="search-icon"><CalendarDays size={17} /></span><span className="search-field-content"><small>CHECK OUT</small><input type="date" min={filters.checkIn} value={filters.checkOut} onChange={(event) => updateFilter('checkOut', event.target.value)} aria-label="Check-out date" /></span></label>
            <span className="search-divider" />
            <label className="search-field guests-field"><span className="search-icon"><Users size={17} /></span><span className="search-field-content"><small>WHO’S COMING?</small><select value={filters.guests} onChange={(event) => updateFilter('guests', Number(event.target.value))} aria-label="Number of guests">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}</select></span></label>
            <button type="submit" className="button search-submit" disabled={loadingProperties}><Search size={17} /><span>Find a stay</span></button>
          </form>
        </section>

        <section className="intro-strip" id="our-way"><div className="intro-ornament">S<span>.</span></div><p><span>More than a room.</span> A rooftop for the last light, a lane you’ll want to get lost on, someone at the front desk who remembers how you take your coffee.</p><div className="intro-signature">THAT’S THE SEREIN WAY <span>↗</span></div></section>

        <section className="stays-section content-width" id="stays">
          <div className="section-heading stays-heading"><div className="section-heading-copy"><span className="eyebrow"><span className="heading-star">✳</span> THE SEREIN COLLECTION</span><h2>One city.<br className="mobile-break" /> <em>Many ways to stay.</em></h2><p>{propertyCountLabel}</p></div><div className="stays-side-note"><span>CURATED FOR THE CURIOUS</span><i />Every stay has its own point of view.<br />All of them feel a little like yours.</div></div>
          <div className="filter-toolbar"><div className="filter-summary"><span className="filter-pin"><MapPin size={15} /></span><span><b>{filters.q || 'Mumbai, India'}</b><small>{dateLabel(filters.checkIn)} — {dateLabel(filters.checkOut)} · {filters.guests} guests</small></span></div><div className="filter-options"><label className="compact-filter"><span>Price</span><select value={filters.maxPrice} onChange={(event) => { const next = { ...filters, maxPrice: event.target.value }; setFilters(next); void loadProperties(next); }} aria-label="Maximum nightly price"><option value="">Any</option><option value="12000">Under ₹12k</option><option value="18000">Under ₹18k</option><option value="25000">Under ₹25k</option></select></label><label className="compact-filter amenity-filter"><span>Style</span><select value={filters.amenity} onChange={(event) => { const next = { ...filters, amenity: event.target.value }; setFilters(next); void loadProperties(next); }} aria-label="Filter by style"><option value="">Any little extra</option><option value="garden">Garden</option><option value="sea view">Sea view</option><option value="breakfast">Breakfast</option><option value="rooftop">Rooftop</option></select></label><label className="compact-filter sort-filter"><span>Sort by</span><select value={filters.sort} onChange={(event) => { const next = { ...filters, sort: event.target.value }; setFilters(next); void loadProperties(next); }} aria-label="Sort stays"><option value="recommended">Recommended</option><option value="price-asc">Price: low to high</option><option value="rating">Guest favourite</option><option value="name">Name</option></select></label></div></div>
          {apiError && <div className="site-error"><span>{apiError}</span><button onClick={() => { setApiError(''); void loadProperties(filters); }}>Try again <ArrowRight size={14} /></button></div>}
          {loadingProperties ? <div className="stay-skeleton-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div> : properties.length ? <div className="stay-grid">{properties.map((property, index) => <StayCard key={property.id} property={property} index={index} onOpen={() => openProperty(property.slug)} />)}</div> : !apiError && <div className="empty-stays"><div className="empty-illustration"><Compass size={26} /></div><span className="eyebrow">A LITTLE PLOT TWIST</span><h3>No stays for those dates — just yet.</h3><p>Try a nearby neighbourhood, or change your dates. Mumbai is full of lovely surprises.</p><button className="button button-outline" onClick={() => { const next = { ...filters, q: '', minPrice: '', maxPrice: '', amenity: '', checkIn: today, checkOut: addDays(today, 2) }; setFilters(next); void loadProperties(next); }}>Start fresh <ArrowRight size={15} /></button></div>}
          <div className="collection-footnote"><span><ShieldCheck size={15} /> Every stay personally visited by our little team</span><span>PRICES SHOWN IN INR <span className="footnote-sep">·</span> NO HIDDEN SURPRISES</span></div>
        </section>

        <section className="city-story" id="neighbourhoods"><div className="story-stamp"><span>THE</span><b>बॉम्बे</b><span>WE LOVE</span></div><div className="story-copy"><span className="eyebrow">A CITY OF SMALL WORLDS</span><h2>Take the long way.<br /><em>You’re in Mumbai.</em></h2><p>From the old stone facades of Fort to the little all-night kitchens of Bandra, Mumbai is best found one lane at a time. Our stays put you right in the middle of the good stuff.</p><div className="neighbourhood-list"><span><i>01</i> Fort & Colaba</span><span><i>02</i> Bandra & Khar</span><span><i>03</i> Juhu & Versova</span><span><i>04</i> The Southern Curve</span></div><button className="text-arrow" onClick={() => { setFilters((previous) => ({ ...previous, q: '' })); document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore the collection <ArrowRight size={15} /></button></div><div className="story-photo" style={{ backgroundImage: `linear-gradient(0deg,rgba(24,45,36,.3),transparent 62%),url("${assetUrl('/hotel-hero.jpg')}")` }}><div className="story-photo-note"><span>THE CITY, IN THE DETAILS</span><i />Locally loved.<br />Never ordinary.</div></div></section>

        <section className="values-section content-width"><div className="values-heading"><span className="eyebrow">A FEW THINGS WE BELIEVE</span><h2>Good stays leave<br /><em>room for feeling.</em></h2></div><div className="values-grid"><ValueCard number="01" icon={Leaf} title="Rooted, not replicated" text="Each address belongs to its neighbourhood — the makers, the morning rituals, the people who know the best table." /><ValueCard number="02" icon={Heart} title="Little things, remembered" text="A slower check-in. Your tea, just so. The kind of welcome that feels less like service and more like being expected." /><ValueCard number="03" icon={Wind} title="Space to exhale" text="Thoughtful rooms, honest comfort and a point of view that leaves the noise of the day at the door." /></div></section>

        <section className="concierge-cta"><div className="cta-orbit orbit-one" /><div className="cta-orbit orbit-two" /><div className="cta-leaf"><Sparkles size={18} /></div><span className="eyebrow">SOME THINGS ARE BETTER PLANNED TOGETHER</span><h2>Tell us the kind<br />of trip you’re <em>dreaming of.</em></h2><p>A long weekend, a late landing, somewhere to celebrate. Our concierge knows the city — and loves a good plan.</p><button className="button button-light" onClick={() => setInquiryOpen(true)}>Ask our concierge <ArrowRight size={16} /></button><span className="cta-note">A REAL PERSON, ALWAYS.</span></section>
      </main>

      <footer className="site-footer"><div className="footer-top"><a className="brand-lockup footer-brand" href="#top"><span className="brand-mark">S<span>.</span></span><span className="brand-type">Serein <small>STAYS IN MUMBAI</small></span></a><p>Thoughtful little stays.<br />A city that stays with you.</p><div className="footer-links"><div><span>FIND YOUR WAY</span><a href="#stays">The stays</a><a href="#our-way">Our way</a><a href="#neighbourhoods">The city</a></div><div><span>HERE FOR YOU</span><button onClick={() => setInquiryOpen(true)}>Ask our concierge</button><button onClick={() => user ? setTripOpen(true) : setAuthOpen(true)}>My stays</button><button onClick={() => setAuthOpen(true)}>Guest account</button></div></div><div className="footer-social"><span>COME SAY HELLO</span><a href="mailto:hello@sereinstays.example">hello@sereinstays.example <ArrowUpRight size={14} /></a><small>MUMBAI, INDIA · 19° 04' N</small></div></div><div className="footer-bottom"><span>© 2026 SEREIN STAYS · MADE WITH A LITTLE HEART IN MUMBAI</span><span>PRIVACY · GUEST TERMS · THE GOOD STUFF</span><a href="#top">BACK TO THE TOP ↑</a></div></footer>

      {selectedProperty && <PropertyModal property={selectedProperty} dates={filters} onClose={() => setSelectedProperty(null)} onBook={bookRoom} />}
      {bookingRoom && selectedProperty && user && <BookingModal property={selectedProperty} room={bookingRoom} user={user} token={token} defaultDates={{ ...filters, today }} onClose={() => setBookingRoom(null)} onSuccess={bookingSuccess} />}
      {authOpen && <AuthModal onClose={() => { setAuthOpen(false); setPendingRoom(null); }} onSuccess={onAuthSuccess} />}
      {tripOpen && token && <TripsModal token={token} onClose={() => setTripOpen(false)} onChanged={setToast} />}
      {inquiryOpen && <InquiryModal onClose={() => setInquiryOpen(false)} onSuccess={doInquirySuccess} />}
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={14} /></button></div>}
      {!sessionReady && <div className="session-indicator" aria-hidden="true" />}
    </div>
  );
}

function StayCard({ property, index, onOpen }) {
  const imageStyle = { backgroundImage: `${palette[index % palette.length]},url("${assetUrl(property.heroImage || '/hotel-hero.jpg')}")`, backgroundPosition: `${50 + (index % 4) * 9}% ${48 + (index % 3) * 10}%` };
  const price = property.minPriceInr || Math.min(...(property.roomTypes || []).map((room) => Number(room.priceInr)), 0);
  return <article className="stay-card">
    <button className="stay-image-button" onClick={onOpen} aria-label={`Explore ${property.name}`}><div className="stay-card-image" style={imageStyle}><span className="stay-tag">{property.featured ? <><Sparkles size={12} /> A SEREIN FAVOURITE</> : <><MapPin size={12} /> {property.neighborhood.toUpperCase()}</>}</span><span className="stay-image-number">{String(index + 1).padStart(2, '0')} <i /> MUMBAI</span><span className="stay-image-arrow"><ArrowUpRight size={19} /></span></div></button>
    <div className="stay-card-content"><div className="stay-card-overline"><span>{property.neighborhood} <i>·</i> Mumbai</span><span className="stay-rating"><Star size={12} fill="currentColor" /> {Number(property.rating).toFixed(1)} <small>({property.reviewCount})</small></span></div><h3>{property.name}</h3><p className="stay-description">{property.description}</p><div className="stay-amenities">{(property.amenities || []).slice(0, 3).map((amenity) => <span key={amenity}>{amenity}</span>)}</div><div className="stay-card-footer"><span className="stay-price"><small>From</small><b>{formatINR(price)}</b><small>/ night</small></span><button className="text-arrow card-explore" onClick={onOpen}>Explore stay <ArrowRight size={14} /></button></div></div>
  </article>;
}

function ValueCard({ number, icon: Icon, title, text }) {
  return <article className="value-card"><div className="value-number">{number}</div><div className="value-icon"><Icon size={18} /></div><h3>{title}</h3><p>{text}</p><span className="value-dash" /></article>;
}
