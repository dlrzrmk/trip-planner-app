import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import MapView from '../components/MapView.jsx';
import { bookingSearchUrl, getYourGuideSearchUrl } from '../affiliateConfig';
import { useLang } from '../i18n/LanguageContext.jsx';
import { resizeImageFile } from '../utils/imageResize.js';

const LOCALE_MAP = { tr: 'tr-TR', en: 'en-US', de: 'de-DE' };

function ShareModal({ tripId, members, onClose, onChanged }) {
  const { t } = useLang();
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
      setError(err.response?.data?.error || t('tripView.inviteFailed'));
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
        <h3 style={{ marginTop: 0 }}>{t('tripView.shareTitle')}</h3>
        <form onSubmit={invite}>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="friend@example.com" />
          </div>
          <div className="field">
            <label>{t('tripView.shareRole')}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">{t('tripView.shareRoleEditor')}</option>
              <option value="viewer">{t('tripView.shareRoleViewer')}</option>
            </select>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
            {t('tripView.inviteButton')}
          </button>
        </form>

        {members.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 6px' }}>{t('tripView.accessList')}</h4>
            {members.map((m) => (
              <div className="member-row" key={m.id}>
                <span>{m.user_name || m.email}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} style={{ width: 'auto', padding: '4px 8px' }}>
                    <option value="editor">{t('tripView.shareRoleEditor')}</option>
                    <option value="viewer">{t('tripView.shareRoleViewerShort')}</option>
                  </select>
                  <button className="btn danger small" onClick={() => removeMember(m.id)}>
                    {t('tripView.remove')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn secondary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

function DeleteTripModal({ onCancel, onConfirm, busy, error }) {
  const { t } = useLang();
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{t('tripView.deleteTitle')}</h3>
        <p style={{ color: '#6b7280' }}>{t('tripView.deleteConfirm')}</p>
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn danger" style={{ flex: 1 }} onClick={onConfirm} disabled={busy}>
            {busy ? t('tripView.deleting') : t('tripView.deleteConfirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryModal({ tripId, item, canEdit, onClose, onChanged }) {
  const { t } = useLang();
  const [note, setNote] = useState(item.memory_note || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const saveMemory = async (nextFavorite) => {
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/trips/${tripId}/items/${item.id}/memory`, {
        is_favorite: nextFavorite,
        memory_note: note,
      });
      onChanged();
    } catch (err) {
      setSaveError(err.response?.data?.error || t('tripView.memorySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    try {
      for (const file of files) {
        const dataUri = await resizeImageFile(file);
        await api.post(`/trips/${tripId}/items/${item.id}/photos`, { dataUri });
      }
      onChanged();
    } catch (err) {
      setUploadError(err.response?.data?.error || t('tripView.memoryUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    setUploadError('');
    try {
      await api.delete(`/trips/${tripId}/items/${item.id}/photos/${photoId}`);
      onChanged();
    } catch (err) {
      setUploadError(err.response?.data?.error || t('tripView.memoryUploadFailed'));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {item.title} — {t('tripView.memoryTitle')}
        </h3>

        {canEdit ? (
          <button className="btn secondary" style={{ marginBottom: 14 }} onClick={() => saveMemory(!item.is_favorite)} disabled={saving}>
            {item.is_favorite ? `❤️ ${t('tripView.memoryFavoriteRemove')}` : `🤍 ${t('tripView.memoryFavoriteAdd')}`}
          </button>
        ) : (
          item.is_favorite && <p>❤️ {t('tripView.memoryFavoriteAdd')}</p>
        )}

        <div className="field">
          <label>{t('tripView.memoryNoteLabel')}</label>
          {canEdit ? (
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('tripView.memoryNotePlaceholder')} />
          ) : (
            note && <p style={{ fontStyle: 'italic', color: '#6b7280' }}>&ldquo;{note}&rdquo;</p>
          )}
        </div>
        {canEdit && (
          <button className="btn" onClick={() => saveMemory(item.is_favorite)} disabled={saving} style={{ width: '100%', marginBottom: 16 }}>
            {saving ? t('tripView.memorySaving') : t('tripView.memorySave')}
          </button>
        )}
        {saveError && <div className="error-text">{saveError}</div>}

        <div style={{ marginTop: 8 }}>
          <h5 style={{ margin: '0 0 8px' }}>📷 {t('tripView.memoryTitle')}</h5>
          {(!item.photos || item.photos.length === 0) && (
            <p style={{ color: '#6b7280', fontSize: 13 }}>{t('tripView.memoryNoPhotos')}</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(item.photos || []).map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <img
                  src={p.url}
                  alt=""
                  style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
                {canEdit && (
                  <button
                    className="btn danger small"
                    onClick={() => deletePhoto(p.id)}
                    title={t('tripView.memoryDeletePhoto')}
                    style={{ position: 'absolute', top: -6, right: -6, padding: '2px 6px', borderRadius: 999, fontSize: 11, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFilesSelected} style={{ display: 'none' }} />
              <button className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? t('tripView.memoryUploading') : `+ ${t('tripView.memoryAddPhoto')}`}
              </button>
              {uploadError && <div className="error-text" style={{ marginTop: 8 }}>{uploadError}</div>}
            </div>
          )}
        </div>

        <button className="btn secondary" style={{ width: '100%', marginTop: 18 }} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [trip, setTrip] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [memoryItemId, setMemoryItemId] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/trips/${id}`);
    setTrip(data);
  };

  useEffect(() => {
    load();
    // light polling so collaborators see fairly-fresh updates without a manual refresh
    const intervalId = setInterval(load, 8000);
    return () => clearInterval(intervalId);
  }, [id]);

  if (!trip) return <div className="container">{t('common.loading')}</div>;

  const isOwner = trip.my_role === 'owner';
  const canEdit = trip.my_role !== 'viewer';
  const dayItems = trip.items.filter((it) => it.day_number === activeDay);
  const mapMarkers = trip.items.filter((it) => it.lat && it.lng).map((it) => ({ lat: it.lat, lng: it.lng, label: it.title, dayNumber: it.day_number }));
  const locale = LOCALE_MAP[lang] || 'en-US';
  const memoryItem = trip.items.find((it) => it.id === memoryItemId) || null;

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
      setDeleteError(err.response?.data?.error || t('tripView.deleteFailed'));
      setDeleteBusy(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span className={`badge ${trip.status === 'finished' ? 'finished' : ''}`}>
            {trip.status === 'finished' ? t('dashboard.finished') : t('dashboard.draft')}
          </span>
          <h2 style={{ margin: '6px 0' }}>{trip.name}</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            {t('dashboard.totalDays', trip.total_days)} {trip.destination_label ? `· ${trip.destination_label}` : ''} · {t('tripView.owner')}: {trip.owner?.name}
          </p>
        </div>
        <div className="top-actions">
          {canEdit && (
            <button className="btn secondary" onClick={() => navigate(`/trips/${id}/edit`)}>
              {t('common.edit')}
            </button>
          )}
          {isOwner && (
            <button className="btn secondary" onClick={() => setShowShare(true)}>
              {t('tripView.share')}
            </button>
          )}
          {canEdit && (
            <button className="btn secondary" onClick={markFinished}>
              {trip.status === 'finished' ? t('tripView.markDraft') : t('tripView.markFinished')}
            </button>
          )}
          {isOwner && (
            <button className="btn danger" onClick={() => setShowDeleteConfirm(true)}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 20 }}>
        <div className="card">
          <MapView markers={mapMarkers} height={340} />
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>{t('tripView.budgetSummary')}</h4>
          <div className="summary-row">
            <span>{t('tripView.itemCount')}</span>
            <span>{trip.items.length}</span>
          </div>
          <div className="summary-row total">
            <span>{t('tripView.totalCost')}</span>
            <span>
              {trip.total_cost.toLocaleString(locale)} {trip.currency}
            </span>
          </div>

          {trip.members?.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h5 style={{ margin: '0 0 6px' }}>{t('tripView.sharedWith')}</h5>
              {trip.members.map((m) => (
                <div key={m.id} style={{ fontSize: 13, color: '#6b7280' }}>
                  {m.user_name || m.email} — {m.role === 'viewer' ? t('dashboard.viewer') : t('dashboard.editor')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {trip.destination_label && (
        <div className="card" style={{ marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>{t('tripView.reservationSuggestions')}</h4>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            {t('tripView.reservationIntro', trip.destination_label)}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              className="btn secondary"
              href={bookingSearchUrl(trip.destination_label)}
              target="_blank"
              rel="noopener noreferrer sponsored"
            >
              🏨 {t('tripView.findHotel')}
            </a>
            <a
              className="btn secondary"
              href={getYourGuideSearchUrl(trip.destination_label)}
              target="_blank"
              rel="noopener noreferrer sponsored"
            >
              🎟️ {t('tripView.findTour')}
            </a>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h4 style={{ marginTop: 0 }}>{t('tripView.dayProgram', activeDay)}</h4>
        <div className="day-tabs">
          {Array.from({ length: trip.total_days }, (_, i) => i + 1).map((d) => (
            <div key={d} className={`day-tab ${activeDay === d ? 'active' : ''}`} onClick={() => setActiveDay(d)}>
              {t('common.day')} {d}
            </div>
          ))}
        </div>
        {dayItems.length === 0 && <p style={{ color: '#6b7280' }}>{t('tripView.noItemsForDay')}</p>}
        {dayItems
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          .map((it) => (
            <div className="item-block" key={it.id}>
              <div className="item-row" style={{ gridTemplateColumns: '1.4fr 0.6fr 0.6fr 1.2fr auto' }}>
                <div>
                  <strong>{it.title}</strong>
                  {it.is_favorite && <span style={{ marginLeft: 6 }}>❤️</span>}
                  {it.notes && <div style={{ fontSize: 12, color: '#6b7280' }}>{it.notes}</div>}
                </div>
                <div>{it.time || '-'}</div>
                <div>
                  {Number(it.cost).toLocaleString(locale)} {trip.currency}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{it.location_label && `📍 ${it.location_label}`}</div>
                <div>
                  <button className="btn secondary small" onClick={() => setMemoryItemId(it.id)}>
                    {t('tripView.memoryOpen', it.photos?.length || 0)}
                  </button>
                </div>
              </div>
              {(it.photos?.length > 0 || it.memory_note) && (
                <div className="memory-preview">
                  {it.photos?.slice(0, 4).map((p) => (
                    <img key={p.id} src={p.url} alt="" className="memory-thumb" onClick={() => setMemoryItemId(it.id)} />
                  ))}
                  {it.photos?.length > 4 && (
                    <span style={{ fontSize: 12, color: '#6b7280' }}>+{it.photos.length - 4}</span>
                  )}
                  {it.memory_note && <p className="memory-note-preview">&ldquo;{it.memory_note}&rdquo;</p>}
                </div>
              )}
            </div>
          ))}
      </div>

      {memoryItem && (
        <MemoryModal
          tripId={id}
          item={memoryItem}
          canEdit={canEdit}
          onClose={() => setMemoryItemId(null)}
          onChanged={load}
        />
      )}

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
