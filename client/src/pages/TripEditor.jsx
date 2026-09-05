import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import MapView from '../components/MapView.jsx';

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];
const emptyDraft = { title: '', time: '', cost: '', notes: '', lat: null, lng: null, location_label: '' };

export default function TripEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [totalDays, setTotalDays] = useState(3);
  const [currency, setCurrency] = useState('TRY');
  const [destination, setDestination] = useState({ lat: null, lng: null, label: '' });
  const [items, setItems] = useState([]);
  const [activeDay, setActiveDay] = useState(1);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [myRole, setMyRole] = useState('owner');

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data } = await api.get(`/trips/${id}`);
      setName(data.name);
      setTotalDays(data.total_days);
      setCurrency(data.currency);
      setDestination({ lat: data.destination_lat, lng: data.destination_lng, label: data.destination_label });
      setItems(data.items || []);
      setMyRole(data.my_role);
      setLoading(false);
    })();
  }, [id]);

  const canEdit = myRole !== 'viewer';

  const dayItems = items.filter((it) => it.day_number === activeDay).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const addItem = () => {
    if (!draft.title.trim()) {
      setError('Etkinlik başlığı girin.');
      return;
    }
    setError('');
    setItems((prev) => [
      ...prev,
      {
        ...draft,
        cost: Number(draft.cost) || 0,
        day_number: activeDay,
        id: `local-${Date.now()}-${Math.random()}`,
      },
    ]);
    setDraft(emptyDraft);
  };

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const onDestinationPick = (lat, lng, label) => setDestination({ lat, lng, label });
  const onItemLocationPick = (lat, lng, label) => setDraft((d) => ({ ...d, lat, lng, location_label: label || d.location_label }));

  const save = async () => {
    if (!name.trim()) {
      setError('Plan adı girin.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let tripId = id;
      const payload = {
        name,
        total_days: totalDays,
        currency,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        destination_label: destination.label,
      };
      if (isNew) {
        const { data } = await api.post('/trips', payload);
        tripId = data.id;
      } else {
        await api.put(`/trips/${id}`, payload);
      }
      await api.put(`/trips/${tripId}/items`, { items });
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container">Yükleniyor...</div>;

  const mapMarkers = items
    .filter((it) => it.lat && it.lng)
    .map((it) => ({ lat: it.lat, lng: it.lng, label: it.title, dayNumber: it.day_number }));

  return (
    <div className="container">
      <h2>{isNew ? 'Yeni tatil planı' : 'Planı düzenle'}</h2>
      {!canEdit && <p className="error-text">Bu planı sadece görüntüleyebilirsiniz, düzenleme yetkiniz yok.</p>}

      <div className="two-col">
        <div className="card">
          <div className="field">
            <label>Plan adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} placeholder="Örn. Yaz Tatili - Kaş" />
          </div>
          <div className="field" style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Toplam gün</label>
              <input
                type="number"
                min={1}
                value={totalDays}
                disabled={!canEdit}
                onChange={(e) => setTotalDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Para birimi</label>
              <select value={currency} disabled={!canEdit} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Genel konum (ör. gidilecek şehir/bölge)</label>
            <MapView
              editable={canEdit}
              center={destination.lat ? { lat: destination.lat, lng: destination.lng } : undefined}
              markers={destination.lat ? [{ lat: destination.lat, lng: destination.lng, label: destination.label, dayNumber: null }] : mapMarkers}
              onPick={onDestinationPick}
              height={280}
            />
            {destination.label && <p style={{ fontSize: 13, marginTop: 6 }}>📍 {destination.label}</p>}
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>Gün gün plan</h4>
          <div className="day-tabs">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <div key={d} className={`day-tab ${activeDay === d ? 'active' : ''}`} onClick={() => setActiveDay(d)}>
                Gün {d}
              </div>
            ))}
          </div>

          {dayItems.length === 0 && <p style={{ color: '#6b7280', fontSize: 14 }}>Bu gün için henüz etkinlik eklenmedi.</p>}

          {dayItems.map((it) => (
            <div className="item-row" key={it.id}>
              <div>
                <strong>{it.title}</strong>
                {it.location_label && <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {it.location_label}</div>}
                {it.notes && <div style={{ fontSize: 12, color: '#6b7280' }}>{it.notes}</div>}
              </div>
              <div>{it.time || '-'}</div>
              <div>{Number(it.cost).toLocaleString('tr-TR')} {currency}</div>
              <div />
              {canEdit && (
                <button className="btn danger small" onClick={() => removeItem(it.id)}>
                  Sil
                </button>
              )}
            </div>
          ))}

          {canEdit && (
            <div style={{ marginTop: 18, borderTop: '1px solid #e3e6ee', paddingTop: 16 }}>
              <h5 style={{ margin: '0 0 10px' }}>Gün {activeDay} için etkinlik ekle</h5>
              <div className="field">
                <label>Başlık</label>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Örn. Kaleiçi turu" />
              </div>
              <div className="field" style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Saat</label>
                  <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Ücret ({currency})</label>
                  <input type="number" min={0} value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Not (opsiyonel)</label>
                <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <div className="field">
                <label>Konum</label>
                <MapView editable markers={draft.lat ? [{ lat: draft.lat, lng: draft.lng, label: draft.location_label, dayNumber: activeDay }] : []} onPick={onItemLocationPick} height={220} />
                {draft.location_label && <p style={{ fontSize: 13, marginTop: 6 }}>📍 {draft.location_label}</p>}
              </div>
              <button className="btn secondary" onClick={addItem} type="button">
                + Etkinliği ekle
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        {canEdit && (
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Planı kaydet'}
          </button>
        )}
        <button className="btn secondary" onClick={() => navigate(-1)}>
          İptal
        </button>
      </div>
    </div>
  );
}
