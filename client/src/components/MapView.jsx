import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useLang } from '../i18n/LanguageContext.jsx';

const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 }; // Istanbul
const MARKER_COLORS = ['#2f6fed', '#e0523f', '#1c8b4c', '#c9a227', '#8a4fd6', '#0fb5ae'];

function dayIcon(dayNumber) {
  const color = MARKER_COLORS[((dayNumber || 1) - 1) % MARKER_COLORS.length];
  return L.divIcon({
    className: 'trip-marker-wrapper',
    html: '<div class="trip-marker" style="background:' + color + '">' + (dayNumber || '') + '</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function ClickHandler({ editable, onPick }) {
  useMapEvents({
    click(e) {
      if (editable && onPick) onPick(e.latlng.lat, e.latlng.lng, '');
    },
  });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 13);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Reusable OpenStreetMap (Leaflet) map. No API key required.
 * - markers: [{ lat, lng, label, dayNumber }]
 * - onPick(lat, lng, label): called when the user clicks the map or picks a search result (editable mode only)
 * - editable: whether clicking/searching is allowed
 */
export default function MapView({ markers = [], center, onPick, editable = false, height = 360 }) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);

  const mapCenter = center || (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : DEFAULT_CENTER);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(query)
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onPick && onPick(lat, lng, r.display_name);
    setFlyTarget({ lat, lng });
    setResults([]);
    setQuery(r.display_name);
  };

  return (
    <div>
      {editable && (
        <form onSubmit={runSearch} style={{ marginBottom: 10, position: 'relative' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('map.searchPlaceholder')}
          />
          {searching && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{t('map.searching')}</p>}
          {results.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 1000,
                background: 'white',
                border: '1px solid #e3e6ee',
                borderRadius: 8,
                marginTop: 4,
                width: '100%',
                maxHeight: 220,
                overflowY: 'auto',
                boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
              }}
            >
              {results.map((r) => (
                <div
                  key={r.place_id}
                  onClick={() => pickResult(r)}
                  style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f2f8' }}
                >
                  {r.display_name}
                </div>
              ))}
            </div>
          )}
        </form>
      )}
      <div className="map-box" style={{ height }}>
        <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={markers.length ? 12 : 6} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler editable={editable} onPick={onPick} />
          <FlyTo target={flyTarget} />
          {markers.map((m, idx) => (
            <Marker key={idx} position={[m.lat, m.lng]} icon={dayIcon(m.dayNumber)}>
              {m.label && <Popup>{m.label}</Popup>}
            </Marker>
          ))}
        </MapContainer>
      </div>
      {editable && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{t('map.clickHint')}</p>}
    </div>
  );
}
