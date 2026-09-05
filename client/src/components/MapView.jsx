import React, { useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, Autocomplete, useJsApiLoader } from '@react-google-maps/api';

const LIBRARIES = ['places'];
const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 }; // Istanbul

const MARKER_COLORS = ['#2f6fed', '#e0523f', '#1c8b4c', '#c9a227', '#8a4fd6', '#0fb5ae'];

/**
 * Reusable Google Map.
 * - markers: [{ lat, lng, label, dayNumber }]
 * - onPick(lat, lng, label): called when user clicks the map or picks a place (editable mode only)
 * - editable: whether clicking/searching is allowed
 */
export default function MapView({ markers = [], center, onPick, editable = false, height = 360 }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: LIBRARIES,
  });
  const [autocomplete, setAutocomplete] = useState(null);
  const mapRef = useRef(null);

  const onMapClick = useCallback(
    (e) => {
      if (!editable || !onPick) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onPick(lat, lng, '');
    },
    [editable, onPick]
  );

  const onPlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    onPick && onPick(lat, lng, place.formatted_address || place.name || '');
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(13);
    }
  };

  if (!apiKey) {
    return (
      <div className="map-box" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', color: '#6b7280' }}>
        Google Maps API anahtarı ayarlanmamış. <br />
        <code>client/.env</code> dosyasına <code>VITE_GOOGLE_MAPS_API_KEY</code> ekleyin.
      </div>
    );
  }

  if (loadError) {
    return <div className="map-box" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Harita yüklenemedi.</div>;
  }

  if (!isLoaded) {
    return <div className="map-box" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Harita yükleniyor...</div>;
  }

  const mapCenter = center || (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : DEFAULT_CENTER);

  return (
    <div>
      {editable && (
        <div style={{ marginBottom: 10 }}>
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
            <input placeholder="Konum ara (otel, şehir, mekan adı...)" />
          </Autocomplete>
        </div>
      )}
      <div className="map-box" style={{ height }}>
        <GoogleMap
          onLoad={(map) => (mapRef.current = map)}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapCenter}
          zoom={markers.length ? 12 : 6}
          onClick={onMapClick}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {markers.map((m, idx) => (
            <Marker
              key={idx}
              position={{ lat: m.lat, lng: m.lng }}
              label={{
                text: m.dayNumber ? String(m.dayNumber) : '',
                color: 'white',
                fontSize: '11px',
                fontWeight: '700',
              }}
              title={m.label}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: MARKER_COLORS[(m.dayNumber - 1) % MARKER_COLORS.length] || '#2f6fed',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2,
              }}
            />
          ))}
        </GoogleMap>
      </div>
      {editable && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Haritaya tıklayarak da konum seçebilirsiniz.</p>}
    </div>
  );
}
