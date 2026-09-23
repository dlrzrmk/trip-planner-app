import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useLang } from '../i18n/LanguageContext.jsx';

const LOCALE_MAP = { tr: 'tr-TR', en: 'en-US', de: 'de-DE' };

function TripCard({ trip }) {
  const { t, lang } = useLang();
  return (
    <Link to={`/trips/${trip.id}`} className="trip-card" style={{ color: 'inherit' }}>
      <span className={`badge ${trip.status === 'finished' ? 'finished' : ''}`}>
        {trip.status === 'finished' ? t('dashboard.finished') : t('dashboard.draft')}
      </span>
      <h3>{trip.name}</h3>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        {t('dashboard.totalDays', trip.total_days)}
        {trip.destination_label ? ` · ${trip.destination_label}` : ''}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        {t('dashboard.totalBudget')}: {trip.total_cost?.toLocaleString(LOCALE_MAP[lang] || 'en-US')} {trip.currency}
      </div>
      {trip.my_role && trip.my_role !== 'owner' && (
        <span className="badge">
          {t('dashboard.shared')} · {trip.my_role === 'viewer' ? t('dashboard.viewer') : t('dashboard.editor')}
        </span>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState({ owned: [], shared: [] });
  const [loading, setLoading] = useState(true);
  const { t } = useLang();
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
        <h2 style={{ margin: 0 }}>{t('dashboard.title')}</h2>
        <button className="btn" onClick={() => navigate('/trips/new')}>
          + {t('dashboard.newTrip')}
        </button>
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <>
          {data.owned.length === 0 && data.shared.length === 0 && (
            <div className="empty-state">
              <p>{t('dashboard.empty')}</p>
            </div>
          )}

          {data.owned.length > 0 && (
            <>
              <h4>{t('dashboard.mine')}</h4>
              <div className="grid-trips">
                {data.owned.map((trip) => (
                  <TripCard trip={trip} key={trip.id} />
                ))}
              </div>
            </>
          )}

          {data.shared.length > 0 && (
            <>
              <h4 style={{ marginTop: 28 }}>{t('dashboard.sharedWithMe')}</h4>
              <div className="grid-trips">
                {data.shared.map((trip) => (
                  <TripCard trip={trip} key={trip.id} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
