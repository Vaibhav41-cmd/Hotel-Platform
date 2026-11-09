import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, Clock3, DoorOpen, FileText, ImagePlus, LayoutDashboard, LoaderCircle, LogOut, Mail, MapPin, Pencil, Plus, ReceiptText, Search, ShieldCheck, Sparkles, TrendingUp, Upload, Users, X } from 'lucide-react';
import { api } from './api.js';

const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
const shortDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const toSlug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tabs = [
  ['overview', 'Overview', LayoutDashboard],
  ['stays', 'Stays', ClipboardList],
  ['properties', 'Properties', Building2],
  ['enquiries', 'Enquiries', Mail],
  ['data', 'Data quality', Activity],
];

export default function AdminPanel({ token, user, onClose, onToast }) {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState(30);
  const [metrics, setMetrics] = useState(null);
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [propertyForm, setPropertyForm] = useState({ name: '', slug: '', neighborhood: '', address: '', description: '', amenities: '', heroImage: '/hotel-hero.jpg', rating: '4.7', featured: false });
  const [propertyBusy, setPropertyBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [roomForm, setRoomForm] = useState({ propertyId: '', name: '', description: '', maxGuests: 2, inventory: 2, priceInr: '' });
  const [roomBusy, setRoomBusy] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomEditValues, setRoomEditValues] = useState({});
  const [actionId, setActionId] = useState('');

  const load = async (selectedRange = range) => {
    setError('');
    try {
      const [metricData, propertyData, bookingData, inquiryData, issueData] = await Promise.all([
        api(`/admin/metrics?days=${selectedRange}`, { token }),
        api('/admin/properties', { token }),
        api('/admin/bookings', { token }),
        api('/admin/inquiries', { token }),
        api('/admin/import-issues', { token }),
      ]);
      setMetrics(metricData);
      setProperties(propertyData);
      setBookings(bookingData);
      setInquiries(inquiryData);
      setIssues(issueData);
      setRoomForm((previous) => ({ ...previous, propertyId: previous.propertyId || propertyData[0]?.id || '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(range); }, [token]);
  const refresh = async () => { await load(range); };
  const updateRange = (value) => { setRange(value); void load(value); };
  const filteredBookings = useMemo(() => bookings.filter((booking) => `${booking.guestName} ${booking.propertyName} ${booking.confirmation}`.toLowerCase().includes(searchTerm.toLowerCase())), [bookings, searchTerm]);

  const startPropertyForm = (property = null) => {
    setEditingProperty(property);
    setPropertyForm(property ? {
      name: property.name, slug: property.slug, neighborhood: property.neighborhood, address: property.address,
      description: property.description, amenities: (property.amenities || []).join(', '), heroImage: property.heroImage || '/hotel-hero.jpg',
      rating: String(property.rating || '4.7'), featured: Boolean(property.featured),
    } : { name: '', slug: '', neighborhood: '', address: '', description: '', amenities: '', heroImage: '/hotel-hero.jpg', rating: '4.7', featured: false });
    setPropertyFormOpen(true);
  };
  const submitProperty = async (event) => {
    event.preventDefault();
    setPropertyBusy(true);
    setError('');
    const body = { ...propertyForm, slug: propertyForm.slug || toSlug(propertyForm.name), rating: Number(propertyForm.rating), amenities: propertyForm.amenities.split(',').map((item) => item.trim()).filter(Boolean) };
    try {
      await api(editingProperty ? `/admin/properties/${editingProperty.id}` : '/admin/properties', { token, method: editingProperty ? 'PATCH' : 'POST', body });
      setPropertyFormOpen(false);
      await refresh();
      onToast(editingProperty ? 'Property details updated.' : 'Property added to your portfolio.');
    } catch (requestError) { setError(requestError.message); }
    finally { setPropertyBusy(false); }
  };
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const result = await api('/admin/upload', { token, method: 'POST', formData });
      setPropertyForm((previous) => ({ ...previous, heroImage: result.url }));
      onToast('Image uploaded and ready to use.');
    } catch (requestError) { setError(requestError.message); }
    finally { setUploadBusy(false); event.target.value = ''; }
  };
  const deleteProperty = async (property) => {
    if (!window.confirm(`Delete ${property.name}? This is only allowed when it has no stay history.`)) return;
    setActionId(property.id);
    try { await api(`/admin/properties/${property.id}`, { token, method: 'DELETE' }); await refresh(); onToast('Property removed.'); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const submitRoom = async (event) => {
    event.preventDefault();
    setRoomBusy(true);
    setError('');
    try {
      await api('/admin/room-types', { token, method: 'POST', body: { ...roomForm, maxGuests: Number(roomForm.maxGuests), inventory: Number(roomForm.inventory), priceInr: Number(roomForm.priceInr), amenities: ['Wi-Fi', 'Rain shower'] } });
      setRoomForm((previous) => ({ ...previous, name: '', description: '', priceInr: '' }));
      await refresh();
      onToast('Room type added to inventory.');
    } catch (requestError) { setError(requestError.message); }
    finally { setRoomBusy(false); }
  };
  const saveRoom = async (room) => {
    setActionId(room.id);
    try {
      await api(`/admin/room-types/${room.id}`, { token, method: 'PATCH', body: { inventory: Number(roomEditValues.inventory), priceInr: Number(roomEditValues.priceInr) } });
      setEditingRoom(null);
      await refresh();
      onToast('Room inventory and rate updated.');
    } catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const deleteRoom = async (room) => {
    if (!window.confirm(`Remove ${room.name}? Stay history may prevent removal.`)) return;
    setActionId(room.id);
    try { await api(`/admin/room-types/${room.id}`, { token, method: 'DELETE' }); await refresh(); onToast('Room type removed.'); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const changeBooking = async (booking, status) => {
    setActionId(booking.id);
    try { await api(`/admin/bookings/${booking.id}`, { token, method: 'PATCH', body: { status } }); await refresh(); onToast(`Reservation ${booking.confirmation} updated.`); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const changeInquiry = async (inquiry, status) => {
    setActionId(inquiry.id);
    try { await api(`/admin/inquiries/${inquiry.id}`, { token, method: 'PATCH', body: { status } }); await refresh(); onToast('Enquiry status updated.'); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const resolveIssue = async (issue) => {
    setActionId(issue.id);
    try { await api(`/admin/import-issues/${issue.id}`, { token, method: 'PATCH', body: { resolved: !issue.resolved } }); await refresh(); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };
  const deleteBooking = async (booking) => {
    if (!window.confirm(`Permanently delete ${booking.confirmation}? This removes the booking record.`)) return;
    setActionId(booking.id);
    try { await api(`/admin/bookings/${booking.id}`, { token, method: 'DELETE' }); await refresh(); onToast('Booking record deleted.'); }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(''); }
  };

  const period = metrics?.period;
  const dataQuality = metrics?.summary?.dataQuality || {};
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand"><button className="admin-back" onClick={onClose} aria-label="Return to website"><ArrowLeft size={18} /></button><span className="brand-mark small-mark">S<span>.</span></span><span className="admin-brand-name">Serein <small>FRONT DESK</small></span></div>
        <div className="admin-top-actions"><span className="admin-user-chip"><span className="admin-avatar">{user.name.slice(0, 1)}</span>{user.name}<ChevronDown size={14} /></span><button className="button button-outline admin-view-site" onClick={onClose}>View website<ArrowRight size={14} /></button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="desk-label">WORKSPACE</div>
          <nav className="admin-nav">{tabs.map(([key, label, Icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setError(''); }}><Icon size={17} /><span>{label}</span>{key === 'enquiries' && metrics?.summary.newInquiries > 0 && <em>{metrics.summary.newInquiries}</em>}</button>)}</nav>
          <div className="sidebar-bottom"><div className="support-mini"><div className="support-icon"><ShieldCheck size={16} /></div><span><b>All systems calm</b><small>Live demo workspace</small></span><span className="online-dot" /></div><div className="desk-profile"><span className="admin-avatar">{user.name.slice(0, 1)}</span><span><b>{user.name}</b><small>{user.email}</small></span></div></div>
        </aside>
        <main className="admin-main">
          <div className="admin-page-heading"><div><span className="eyebrow">SEREIN STAYS · MUMBAI</span><h1>{tabs.find(([key]) => key === tab)?.[1] || 'Overview'}</h1><p>{tab === 'overview' ? 'A considered view of your properties and people.' : tab === 'properties' ? 'The places guests remember, and the rooms within them.' : tab === 'stays' ? 'Bookings, arrivals and the rhythm of each stay.' : tab === 'enquiries' ? 'Every note deserves a thoughtful reply.' : 'Legacy records, gently cleaned and made useful.'}</p></div><div className="admin-heading-actions"><span className="live-pill"><span /> LIVE DATA</span><span className="admin-today">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div></div>
          {error && <div className="admin-alert" role="alert"><CircleAlert size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {loading ? <div className="admin-loading"><LoaderCircle className="spin" size={26} /><span>Gathering the day’s details…</span></div> : <>
            {tab === 'overview' && <section className="admin-section overview-pane">
              <div className="overview-toolbar"><div><span className="eyebrow">PERFORMANCE</span><h2>How the house is doing</h2></div><div className="range-control">{[7, 30, 90].map((days) => <button key={days} className={range === days ? 'active' : ''} onClick={() => updateRange(days)}>{days} days</button>)}</div></div>
              <div className="metric-grid">
                <MetricCard label="Occupancy" value={`${period?.occupancyRate ?? 0}%`} change={metrics?.delta?.occupancyRate} icon={DoorOpen} detail={`${period?.occupiedRoomNights ?? 0} room nights`} />
                <MetricCard label="Average daily rate" value={money(period?.adr)} change={metrics?.delta?.adr} icon={ReceiptText} detail="ADR · per occupied room" currency />
                <MetricCard label="Revenue per room" value={money(period?.revpar)} change={metrics?.delta?.revpar} icon={TrendingUp} detail="RevPAR · per available room" currency />
                <MetricCard label="Room revenue" value={money(period?.revenue)} change={metrics?.delta?.revenue} icon={Sparkles} detail={`${metrics?.summary?.activeBookings ?? 0} active reservations`} currency />
              </div>
              <div className="overview-columns">
                <section className="admin-card revenue-card"><div className="card-heading-row"><div><span className="eyebrow">BY PROPERTY</span><h3>Revenue at a glance</h3></div><button className="link-button" onClick={() => setTab('properties')}>View all <ArrowRight size={14} /></button></div><div className="bar-list">{(period?.byProperty || []).slice(0, 7).map((property, index) => <div className="bar-row" key={property.propertyId}><div className="bar-label"><span className="bar-index">{String(index + 1).padStart(2, '0')}</span><b>{property.propertyName}</b><strong>{money(property.revenue)}</strong></div><div className="bar-track"><span style={{ width: `${Math.max(2, (property.revenue / Math.max(...(period?.byProperty || []).map((item) => item.revenue), 1)) * 100)}%` }} /></div></div>)}</div><div className="chart-foot"><span><span className="chart-dot" /> Revenue</span><span>Last {range} days · INR</span></div></section>
                <section className="admin-card recent-card"><div className="card-heading-row"><div><span className="eyebrow">THE LATEST</span><h3>Recent reservations</h3></div><button className="icon-link" onClick={() => setTab('stays')} aria-label="See all stays"><ArrowRight size={16} /></button></div><div className="recent-list">{(metrics?.recentBookings || []).slice(0, 6).map((booking) => <div className="recent-booking" key={booking.id}><span className="recent-avatar">{booking.guestName?.slice(0, 1) || 'G'}</span><span className="recent-booking-name"><b>{booking.guestName}</b><small>{booking.propertyId ? properties.find((item) => item.id === booking.propertyId)?.name : 'Serein stay'}</small></span><span className={`status-dot status-dot-${booking.status}`} title={booking.status} /></div>)}{!(metrics?.recentBookings || []).length && <p className="muted">No reservations yet.</p>}</div><button className="recent-footer" onClick={() => setTab('stays')}>Open reservation book <ArrowRight size={14} /></button></section>
              </div>
              <div className="data-quality-strip"><div className="quality-icon"><Activity size={18} /></div><div><b>Records, made a little cleaner.</b><span>{dataQuality.sourcePropertyCount ?? properties.length} properties · {dataQuality.importedRoomTypeCount ?? 0} imported room labels · {dataQuality.usdRatesConverted ?? 0} USD rates converted · {dataQuality.invalidStaysQuarantined ?? issues.length} invalid stays quarantined</span></div><button className="link-button" onClick={() => setTab('data')}>Review data <ArrowRight size={14} /></button></div>
            </section>}
            {tab === 'stays' && <section className="admin-section">
              <div className="section-toolbar"><div><span className="eyebrow">RESERVATION BOOK</span><h2>{bookings.length} stays across the group</h2></div><label className="table-search"><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find a guest or stay" /></label></div>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>GUEST / REFERENCE</th><th>PROPERTY & ROOM</th><th>STAY DATES</th><th>VALUE</th><th>STATUS</th><th></th></tr></thead><tbody>{filteredBookings.slice(0, 100).map((booking) => <tr key={booking.id}><td><div className="table-primary">{booking.guestName}</div><div className="table-secondary">{booking.confirmation} · {booking.guestEmail}</div></td><td><div className="table-primary">{booking.propertyName}</div><div className="table-secondary">{booking.roomName}</div></td><td><div className="table-primary">{shortDate(booking.checkIn)} — {shortDate(booking.checkOut)}</div><div className="table-secondary">{booking.guests} guests</div></td><td><div className="table-primary">{money(booking.totalPrice)}</div><div className="table-secondary">INR</div></td><td><select className={`status-select status-${booking.status}`} value={booking.status} disabled={actionId === booking.id} onChange={(event) => changeBooking(booking, event.target.value)}><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td><td><button className="table-icon danger-icon" title="Delete booking" onClick={() => deleteBooking(booking)}><X size={15} /></button></td></tr>)}</tbody></table>{!filteredBookings.length && <div className="empty-state compact-empty"><Search size={23} /><h3>No stays found.</h3><p>Try another guest name or confirmation code.</p></div>}</div>
            </section>}
            {tab === 'properties' && <section className="admin-section">
              <div className="section-toolbar"><div><span className="eyebrow">THE PORTFOLIO</span><h2>{properties.length} properties · {metrics?.summary?.totalRooms ?? 0} rooms</h2></div><button className="button button-dark" onClick={() => startPropertyForm()}><Plus size={16} /> Add property</button></div>
              {propertyFormOpen && <div className="admin-card edit-property-card"><div className="card-heading-row"><div><span className="eyebrow">{editingProperty ? 'EDIT DETAILS' : 'A NEW SEREIN ADDRESS'}</span><h3>{editingProperty ? editingProperty.name : 'Add a property'}</h3></div><button className="icon-button" onClick={() => setPropertyFormOpen(false)} aria-label="Close form"><X size={18} /></button></div><form className="admin-form-grid" onSubmit={submitProperty}><label>Property name<input required value={propertyForm.name} onChange={(event) => setPropertyForm((prev) => ({ ...prev, name: event.target.value, slug: editingProperty ? prev.slug : toSlug(event.target.value) }))} placeholder="Harbor House" /></label><label>URL slug<input required value={propertyForm.slug} onChange={(event) => setPropertyForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))} placeholder="harbor-house" /></label><label>Neighbourhood<input required value={propertyForm.neighborhood} onChange={(event) => setPropertyForm((prev) => ({ ...prev, neighborhood: event.target.value }))} placeholder="Fort" /></label><label>Street address<input required value={propertyForm.address} onChange={(event) => setPropertyForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="14 Ropewalk Lane, Fort, Mumbai" /></label><label className="span-two">Description<textarea required minLength="20" rows="3" value={propertyForm.description} onChange={(event) => setPropertyForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="What makes this stay feel like itself?" /></label><label className="span-two">Amenities, comma separated<input value={propertyForm.amenities} onChange={(event) => setPropertyForm((prev) => ({ ...prev, amenities: event.target.value }))} placeholder="Breakfast, Garden, Concierge" /></label><label>Guest rating<input type="number" min="1" max="5" step="0.1" value={propertyForm.rating} onChange={(event) => setPropertyForm((prev) => ({ ...prev, rating: event.target.value }))} /></label><label className="featured-toggle"><input type="checkbox" checked={propertyForm.featured} onChange={(event) => setPropertyForm((prev) => ({ ...prev, featured: event.target.checked }))} /> Feature this property</label><div className="image-upload-field span-two"><div><b>Property image</b><small>{propertyForm.heroImage || 'Use the Serein house image, or upload a custom one.'}</small></div><label className="button button-outline upload-button"><Upload size={15} />{uploadBusy ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploadBusy} /></label></div><div className="span-two form-actions"><button type="button" className="button button-ghost" onClick={() => setPropertyFormOpen(false)}>Cancel</button><button className="button button-dark" disabled={propertyBusy}>{propertyBusy ? 'Saving…' : editingProperty ? 'Save changes' : 'Add property'}<ArrowRight size={15} /></button></div></form></div>}
              <div className="property-admin-grid">{properties.map((property) => <article className="property-admin-card" key={property.id}><div className="property-admin-card-head"><div><span className="property-neighborhood">{property.neighborhood.toUpperCase()} · MUMBAI</span><h3>{property.name}</h3></div><div className="property-card-actions"><button className="table-icon" title="Edit property" onClick={() => startPropertyForm(property)}><Pencil size={15} /></button>{!bookings.some((booking) => booking.propertyId === property.id) && <button className="table-icon danger-icon" title="Delete property" disabled={actionId === property.id} onClick={() => deleteProperty(property)}><X size={15} /></button>}</div></div><p>{property.description}</p><div className="property-admin-meta"><span><DoorOpen size={14} />{property.roomTypes.reduce((sum, room) => sum + room.inventory, 0)} rooms across {property.roomTypes.length} types</span><span className="property-rating">★ {Number(property.rating).toFixed(1)}</span></div><div className="room-inventory-list">{property.roomTypes.map((room) => <div className="inventory-row" key={room.id}>{editingRoom === room.id ? <><div className="inventory-name"><b>{room.name}</b><small>{money(room.priceInr)}/night</small></div><label className="inline-number">Rooms<input type="number" min="1" value={roomEditValues.inventory ?? room.inventory} onChange={(event) => setRoomEditValues((prev) => ({ ...prev, inventory: event.target.value }))} /></label><label className="inline-number">Rate<input type="number" min="1" value={roomEditValues.priceInr ?? room.priceInr} onChange={(event) => setRoomEditValues((prev) => ({ ...prev, priceInr: event.target.value }))} /></label><button className="save-icon" disabled={actionId === room.id} onClick={() => saveRoom(room)} aria-label="Save room"><Check size={15} /></button></> : <><div className="inventory-name"><b>{room.name}</b><small>{money(room.priceInr)}/night · {room.maxGuests} guests</small></div><span className="inventory-count">{room.inventory} keys</span><button className="table-icon" title="Edit room type" onClick={() => { setEditingRoom(room.id); setRoomEditValues({ inventory: room.inventory, priceInr: room.priceInr }); }}><Pencil size={14} /></button><button className="table-icon danger-icon" title="Delete room type" onClick={() => deleteRoom(room)}><X size={14} /></button></>}</div>)}</div></article>)}</div>
              <div className="admin-card add-room-card"><div className="card-heading-row"><div><span className="eyebrow">ROOM INVENTORY</span><h3>Add a room type</h3></div><span className="inventory-pulse"><span /> updates availability instantly</span></div><form className="room-form" onSubmit={submitRoom}><label>Property<select required value={roomForm.propertyId} onChange={(event) => setRoomForm((prev) => ({ ...prev, propertyId: event.target.value }))}><option value="">Choose a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label>Room name<input required value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Sea View Suite" /></label><label>Rate / night (INR)<input type="number" required min="1" value={roomForm.priceInr} onChange={(event) => setRoomForm((prev) => ({ ...prev, priceInr: event.target.value }))} placeholder="14500" /></label><label>Room count<input type="number" required min="1" max="500" value={roomForm.inventory} onChange={(event) => setRoomForm((prev) => ({ ...prev, inventory: event.target.value }))} /></label><label>Max guests<input type="number" required min="1" max="8" value={roomForm.maxGuests} onChange={(event) => setRoomForm((prev) => ({ ...prev, maxGuests: event.target.value }))} /></label><label className="room-description-field">Short description<input required minLength="10" value={roomForm.description} onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="A little more room to unwind…" /></label><button className="button button-dark" disabled={roomBusy}><Plus size={15} />{roomBusy ? 'Adding…' : 'Add room type'}</button></form></div>
            </section>}
            {tab === 'enquiries' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">THE CONCIERGE INBOX</span><h2>{inquiries.length} guest notes</h2></div><span className="inbox-count"><Mail size={15} />{inquiries.filter((item) => item.status === 'new').length} waiting for a reply</span></div><div className="inquiry-admin-list">{inquiries.map((inquiry) => <article className="inquiry-admin-card" key={inquiry.id}><div className="inquiry-admin-avatar">{inquiry.name.slice(0, 1)}</div><div className="inquiry-admin-body"><div className="inquiry-admin-head"><div><h3>{inquiry.name}</h3><span>{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ''}</span></div><span className={`status-pill status-${inquiry.status}`}>{inquiry.status.replace('_', ' ')}</span></div><p>{inquiry.message}</p><div className="inquiry-admin-footer"><span><Clock3 size={13} /> {new Date(inquiry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><div className="inquiry-actions"><a className="text-button" href={`mailto:${inquiry.email}?subject=${encodeURIComponent('Your note to Serein')}`}><Mail size={13} /> Reply by email</a><select className={`status-select status-${inquiry.status}`} value={inquiry.status} disabled={actionId === inquiry.id} onChange={(event) => changeInquiry(inquiry, event.target.value)}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div></div></div></article>)}{!inquiries.length && <div className="empty-state"><Mail size={24} /><h3>A quiet inbox.</h3><p>New guest enquiries will land here.</p></div>}</div></section>}
            {tab === 'data' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">IMPORT HEALTH</span><h2>Good data makes good stays.</h2></div><span className="data-badge"><Activity size={14} />{issues.filter((issue) => !issue.resolved).length} open records</span></div><div className="quality-metric-grid"><QualityStat value={dataQuality.sourcePropertyCount ?? properties.length} label="Properties imported" /><QualityStat value={dataQuality.importedRoomTypeCount ?? 0} label="Room types mapped" /><QualityStat value={dataQuality.roomLabelVariantsNormalized ?? 0} label="Room labels normalized" /><QualityStat value={dataQuality.usdRatesConverted ?? 0} label={`USD rates · FX ${dataQuality.fxUsdInr ?? '—'}`} /><QualityStat value={issues.length} label="Invalid stays quarantined" /></div><div className="quality-info"><div className="quality-icon"><CircleAlert size={18} /></div><div><b>Imported records are preserved, not quietly discarded.</b><p>Room labels retain their source names for audit, USD rates are normalized using the import-time FX rate, and invalid stays stay out of occupancy and revenue calculations until they are reviewed.</p></div></div><div className="issues-list">{issues.map((issue) => <article className={`issue-row ${issue.resolved ? 'resolved' : ''}`} key={issue.id}><div className="issue-symbol">{issue.resolved ? <Check size={15} /> : <CircleAlert size={15} />}</div><div className="issue-copy"><b>{issue.sourceRecord}</b><span>{issue.issue}</span><small>{issue.payload?.property || 'Legacy booking'} · check-in {issue.payload?.checkIn} · check-out {issue.payload?.checkOut}</small></div><button className={`button ${issue.resolved ? 'button-outline' : 'button-dark'} issue-action`} disabled={actionId === issue.id} onClick={() => resolveIssue(issue)}>{issue.resolved ? 'Reopen' : 'Mark reviewed'}</button></article>)}{!issues.length && <div className="empty-state compact-empty"><BadgeCheck size={24} /><h3>All clear.</h3><p>There are no quarantined records to review.</p></div>}</div></section>}
          </>}
          <footer className="admin-footer"><span>© 2026 Serein Stays · Front desk workspace</span><span><span className="online-dot" /> Protected with role-based access</span></footer>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, icon: Icon, detail, currency }) {
  const positive = Number(change) >= 0;
  return <article className="metric-card"><div className="metric-card-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div><div className="metric-value">{value}</div><div className="metric-card-bottom"><span className={Number(change) === 0 ? 'neutral-change' : positive ? 'positive-change' : 'negative-change'}>{Number(change) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{currency ? money(Math.abs(change || 0)) : `${Math.abs(change || 0)}${label === 'Occupancy' ? ' pts' : ''}`}</span><span>{detail}</span></div></article>;
}
function QualityStat({ value, label }) { return <div className="quality-stat"><b>{value}</b><span>{label}</span></div>; }
