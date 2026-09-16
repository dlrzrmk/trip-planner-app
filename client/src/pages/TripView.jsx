import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import MapView from '../components/MapView.jsx';
import { bookingSearchUrl, getYourGuideSearchUrl } from '../affiliateConfig';

function ShareModal({ tripId, members, onClose, onChanged }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/trips/${tripId}/members`, { email, memberRole: role });
      setEmail('');
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Davet gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId) => {
    await api.delete(`/trips/${tripId}/members/${memberId}`);
    onChanged();
  };

  const changeRole = async (memberId, newRole) => {
    await api.put(`/trips/${tripId}/members/${memberId}`, { memberRole: newRole });
    onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Arkadaşlarınla paylaş</h3>
        <form onSubmit={invite}>
          <div className="field">
            <label>E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="arkadas@ornek.com" />
          </div>
          <div className="field">
            <label>Yetki</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Düzenleyebilir</option>
              <option value="viewer">Sadece görüntüleyebilir</option>
            </select>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
            Davet et
          </button>
        </form>

        {members.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 6px' }}>Erişimi olanlar</h4>
            {members.map((m) => (
              <div className="member-row" key={m.id}>
                <span>{m.user_name || m.email}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px' }}>
                    <option value="editor">Düzenleyebilir</option>
                    <option value="viewer">Görüntüleyebilir</option>
                  </select>
                  <button className="btn danger small" onClick={() => removeMember(m.id)}>
                    Kaldır
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn secondary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}

function DeleteTripModal({ onCancel, onConfirm, busy, error }) {
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Planı sil</h3>
        <p style={{ color: '#6b7280' }}>
          Bu planı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </p>
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>
            Vazgeç
          </button>
          <button className="btn danger" style={{ flex: 1 }} onClick={onConfirm} disabled={busy}>
            {busy ? 'Siliniyor...' : 'Evet, sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    const { data } = await api.get(`/trips/${id}`);
    setTrip(data);
  };

  useEffect(() => {
    load();
    // light polling so collaborators see fairly-fresh updates without a manual refresh
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]);

  if (!trip) return <div className="container">Yükleniyor...</div>;

  const isOwner = trip.my_role === 'owner';
  const canEdit = trip.my_role !== 'viewer';
  const dayItems = trip.items.filter((it) => it.day_number === activeDay);
  const mapMarkers = trip.items.filter((it) => it.lat && it.lng).map((it) => ({ lat: it.lat, lng: it.lng, label: it.title, dayNumber: it.day_number }));

  const markFinished = async () => {
    await api.put(`/trips/${id}`, { status: trip.status === 'finished' ? 'draft' : 'finished' });
    load();
  };

  const deleteTrip = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.delete(`/trips/${id}`);
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Plan silinemedi, lütfen tekrar deneyin.');
      setDeleteBusy(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span className={`badge ${trip.status === 'finished' ? 'finished' : ''}`}>{trip.status === 'finished' ? 'Tamamlandı' : 'Taslak'}</span>
          <h2 style={{ margin: '6px 0' }}>{trip.name}</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            {trip.total_days} gün {trip.destination_label ? `· ${trip.destination_label}` : ''} · Plan sahibi: {trip.owner?.name}
          </p>
        </div>
        <div className="top-actions">
          {canEdit && (
            <button className="btn secondary" onClick={() => navigate(`/trips/${id}/edit`)}>
              Düzenle
            </button>
          )}
          {isOwner && (
            <button className="btn secondary" onClick={() => setShowShare(true)}>
              Paylaş
            </button>
          )}
          {canEdit && (
            <button className="btn secondary" onClick={markFinished}>
              {trip.status === 'finished' ? 'Taslağa al' : 'Tamamlandı olarak işaretle'}
            </button>
          )}
          {isOwner && (
            <button className="btn danger" onClick={() => setShowDeleteConfirm(true)}>
              Sil
            </button>
          )}
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 20 }}>
        <div className="card">
          <MapView markers={mapMarkers} height={340} />
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Bütçe özeti</h4>
          <div className="summary-row">
            <span>Etkinlik sayısı</span>
            <span>{trip.items.length}</span>
          </div>
          <div className="summary-row total">
            <span>Toplam maliyet</span>
            <span>
              {trip.total_cost.toLocaleString('tr-TR')} {trip.currency}
            </span>
          </div>

          {trip.members?.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h5 style={{ margin: '0 0 6px' }}>Paylaşılanlar</h5>
              {trip.members.map((m) => (
                <div key={m.id} style={{ fontSize: 13, color: '#6b7280' }}>
                  {m.user_name || m.email} — {m.role === 'viewer' ? 'görüntüleyici' : 'düzenleyici'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {trip.destination_label && (
        <div className="card" style={{ marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>Rezervasyon önerileri</h4>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            {trip.destination_label} için otel, uçak ve tur seçeneklerine göz atın.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              className="btn secondary"
              href={bookingSearchUrl(trip.destination_label)}
              target="_blank"
              rel="noopener noreferrer sponsored"
            >
              🏨 Otel bul
            </a>
            <a
              className="btn secondary"
              href={getYourGuideSearchUrl(trip.destination_label)}
              target="_blank"
              rel="noopener noreferrer sponsored"
            >
              🎟️ Tur &amp; aktivite bul
            </a>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h4 style={{ marginTop: 0 }}>Gün gün program</h4>
        <div className="day-tabs">
          {Array.from({ length: trip.total_days }, (_, i) => i + 1).map((d) => (
            <div key={d} className={`day-tab ${activeDay === d ? 'active' : ''}`} onClick={() => setActiveDay(d)}>
              Gün {d}
            </div>
          ))}
        </div>
        {dayItems.length === 0 && <p style={{ color: '#6b7280' }}>Bu gün için henüz plan yok.</p>}
        {dayItems
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          .map((it) => (
            <div className="item-row" key={it.id} style={{ gridTemplateColumns: '1.4fr 0.6fr 0.6fr 1.4fr' }}>
              <div>
                <strong>{it.title}</strong>
                {it.notes && <div style={{ fontSize: 12, color: '#6b7280' }}>{it.notes}</div>}
              </div>
              <div>{it.time || '-'}</div>
              <div>
                {Number(it.cost).toLocaleString('tr-TR')} {trip.currency}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{it.location_label && `📍 ${it.location_label}`}</div>
            </div>
          ))}
      </div>

      {showShare && (
        <ShareModal tripId={id} members={trip.members || []} onClose={() => setShowShare(false)} onChanged={load} />
      )}

      {showDeleteConfirm && (
        <DeleteTripModal
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteError('');
          }}
          onConfirm={deleteTrip}
        />
      )}
    </div>
  );
}
