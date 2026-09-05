import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function TripCard({ trip }) {
  return (
    <Link to={`/trips/${trip.id}`} className="trip-card" style={{ color: 'inherit' }}>
      <span className={`badge ${trip.status === 'finished' ? 'finished' : ''}`}>
        {trip.status === 'finished' ? 'Tamamlandı' : 'Taslak'}
      </span>
      <h3>{trip.name}</h3>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        {trip.total_days} gün{trip.destination_label ? ` · ${trip.destination_label}` : ''}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Toplam bütçe: {trip.total_cost?.toLocaleString('tr-TR')} {trip.currency}
      </div>
      {trip.my_role && trip.my_role !== 'owner' && (
        <span className="badge">Paylaşılan · {trip.my_role === 'viewer' ? 'görüntüleyici' : 'düzenleyici'}</span>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState({ owned: [], shared: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/trips');
    setData(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Tatil planlarım</h2>
        <button className="btn" onClick={() => navigate('/trips/new')}>
          + Yeni tatil planı
        </button>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          {data.owned.length === 0 && data.shared.length === 0 && (
            <div className="empty-state">
              <p>Henüz bir tatil planın yok. Haritada nereye gideceğini işaretleyerek başla!</p>
            </div>
          )}

          {data.owned.length > 0 && (
            <>
              <h4>Benim planlarım</h4>
              <div className="grid-trips">
                {data.owned.map((t) => (
                  <TripCard trip={t} key={t.id} />
                ))}
              </div>
            </>
          )}

          {data.shared.length > 0 && (
            <>
              <h4 style={{ marginTop: 28 }}>Benimle paylaşılanlar</h4>
              <div className="grid-trips">
                {data.shared.map((t) => (
                  <TripCard trip={t} key={t.id} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
