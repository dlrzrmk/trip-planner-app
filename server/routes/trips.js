const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// --- helpers -------------------------------------------------------------

function getAccess(tripId, userId, userEmail) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return { trip: null, role: null };
  if (trip.owner_id === userId) return { trip, role: 'owner' };
  const member = db
    .prepare('SELECT * FROM trip_members WHERE trip_id = ? AND (user_id = ? OR invited_email = ?)')
    .get(tripId, userId, userEmail);
  if (member) return { trip, role: member.role };
  return { trip, role: null };
}

function loadFullTrip(tripId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) return null;
  const items = db
    .prepare('SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number ASC, sort_order ASC, created_at ASC')
    .all(tripId);
  const members = db
    .prepare(
      `SELECT tm.id, tm.invited_email as email, tm.role, u.name as user_name, tm.user_id
       FROM trip_members tm LEFT JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = ?`
    )
    .all(tripId);
  const owner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(trip.owner_id);
  const totalCost = items.reduce((sum, it) => sum + (it.cost || 0), 0);
  return { ...trip, items, members, owner, total_cost: totalCost };
}

// --- trip list -------------------------------------------------------------

router.get('/', (req, res) => {
  const { id: userId, email } = req.user;
  const owned = db.prepare('SELECT * FROM trips WHERE owner_id = ? ORDER BY updated_at DESC').all(userId);
  const shared = db
    .prepare(
      `SELECT t.*, tm.role as my_role FROM trips t
       JOIN trip_members tm ON tm.trip_id = t.id
       WHERE (tm.user_id = ? OR tm.invited_email = ?) AND t.owner_id != ?
       ORDER BY t.updated_at DESC`
    )
    .all(userId, email, userId);

  const withCost = (t) => {
    const row = db
      .prepare('SELECT COALESCE(SUM(cost),0) as total FROM trip_items WHERE trip_id = ?')
      .get(t.id);
    return { ...t, total_cost: row.total };
  };

  res.json({
    owned: owned.map((t) => ({ ...withCost(t), my_role: 'owner' })),
    shared: shared.map(withCost),
  });
});

// --- create trip -----------------------------------------------------------

router.post('/', (req, res) => {
  const { name, total_days, destination_lat, destination_lng, destination_label, currency } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Plan adı zorunlu.' });
  const days = Math.max(1, parseInt(total_days, 10) || 1);
  const id = uuid();
  db.prepare(
    `INSERT INTO trips (id, owner_id, name, total_days, destination_lat, destination_lng, destination_label, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    name.trim(),
    days,
    destination_lat ?? null,
    destination_lng ?? null,
    destination_label ?? null,
    currency || 'TRY'
  );
  res.status(201).json(loadFullTrip(id));
});

// --- get single trip ---------------------------------------------------

router.get('/:id', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
  const full = loadFullTrip(req.params.id);
  res.json({ ...full, my_role: role });
});

// --- update trip meta ----------------------------------------------------

router.put('/:id', (req, res) => {
  const { role, trip } = getAccess(req.params.id, req.user.id, req.user.email);
  if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
  if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

  const { name, total_days, destination_lat, destination_lng, destination_label, currency, status } = req.body || {};
  db.prepare(
    `UPDATE trips SET
       name = COALESCE(?, name),
       total_days = COALESCE(?, total_days),
       destination_lat = ?,
       destination_lng = ?,
       destination_label = ?,
       currency = COALESCE(?, currency),
       status = COALESCE(?, status),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name?.trim() || null,
    total_days ? Math.max(1, parseInt(total_days, 10)) : null,
    destination_lat ?? trip.destination_lat,
    destination_lng ?? trip.destination_lng,
    destination_label ?? trip.destination_label,
    currency || null,
    status || null,
    req.params.id
  );
  res.json(loadFullTrip(req.params.id));
});

router.delete('/:id', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi silebilir.' });
  db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- replace all day items in one go (used by the day-by-day editor) ------

router.put('/:id/items', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
  if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const insert = db.prepare(
    `INSERT INTO trip_items (id, trip_id, day_number, title, time, cost, lat, lng, location_label, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const replaceAll = db.transaction((rows) => {
    db.prepare('DELETE FROM trip_items WHERE trip_id = ?').run(req.params.id);
    rows.forEach((it, idx) => {
      insert.run(
        it.id || uuid(),
        req.params.id,
        Math.max(1, parseInt(it.day_number, 10) || 1),
        (it.title || '').trim() || 'Etkinlik',
        it.time || null,
        Number(it.cost) || 0,
        it.lat ?? null,
        it.lng ?? null,
        it.location_label ?? null,
        it.notes ?? null,
        idx
      );
    });
    db.prepare("UPDATE trips SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  });
  replaceAll(items);
  res.json(loadFullTrip(req.params.id));
});

// --- sharing / members -----------------------------------------------------

router.get('/:id/members', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
  const members = db
    .prepare(
      `SELECT tm.id, tm.invited_email as email, tm.role, u.name as user_name
       FROM trip_members tm LEFT JOIN users u ON u.id = tm.user_id
       WHERE tm.trip_id = ?`
    )
    .all(req.params.id);
  res.json({ members });
});

router.post('/:id/members', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi arkadaş davet edebilir.' });
  const { email, memberRole } = req.body || {};
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Geçerli bir e-posta girin.' });
  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  const id = uuid();
  try {
    db.prepare(
      `INSERT INTO trip_members (id, trip_id, user_id, invited_email, role)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, req.params.id, existingUser ? existingUser.id : null, normalizedEmail, memberRole === 'viewer' ? 'viewer' : 'editor');
  } catch (err) {
    return res.status(409).json({ error: 'Bu kişi zaten davetli.' });
  }
  res.status(201).json({ ok: true });
});

router.put('/:id/members/:memberId', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi rol değiştirebilir.' });
  const { memberRole } = req.body || {};
  db.prepare('UPDATE trip_members SET role = ? WHERE id = ? AND trip_id = ?').run(
    memberRole === 'viewer' ? 'viewer' : 'editor',
    req.params.memberId,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id/members/:memberId', (req, res) => {
  const { role } = getAccess(req.params.id, req.user.id, req.user.email);
  if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi kişi çıkarabilir.' });
  db.prepare('DELETE FROM trip_members WHERE id = ? AND trip_id = ?').run(req.params.memberId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
