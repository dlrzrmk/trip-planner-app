const express = require('express');
const { v4: uuid } = require('uuid');
const { client } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();
router.use(requireAuth);

// --- helpers -------------------------------------------------------------

async function getAccess(tripId, userId, userEmail) {
  const tripRes = await client.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [tripId] });
  const trip = tripRes.rows[0];
  if (!trip) return { trip: null, role: null };
  if (trip.owner_id === userId) return { trip, role: 'owner' };
  const memberRes = await client.execute({
    sql: 'SELECT * FROM trip_members WHERE trip_id = ? AND (user_id = ? OR invited_email = ?)',
    args: [tripId, userId, userEmail],
  });
  const member = memberRes.rows[0];
  if (member) return { trip, role: member.role };
  return { trip, role: null };
}

async function loadFullTrip(tripId) {
  const tripRes = await client.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [tripId] });
  const trip = tripRes.rows[0];
  if (!trip) return null;
  const itemsRes = await client.execute({
    sql: 'SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number ASC, sort_order ASC, created_at ASC',
    args: [tripId],
  });
  const photosRes = await client.execute({
    sql: `SELECT p.* FROM trip_item_photos p
          JOIN trip_items ti ON ti.id = p.trip_item_id
          WHERE ti.trip_id = ?
          ORDER BY p.sort_order ASC, p.created_at ASC`,
    args: [tripId],
  });
  const photosByItem = {};
  for (const p of photosRes.rows) {
    (photosByItem[p.trip_item_id] ||= []).push(p);
  }
  const membersRes = await client.execute({
    sql: `SELECT tm.id, tm.invited_email as email, tm.role, u.name as user_name, tm.user_id
          FROM trip_members tm LEFT JOIN users u ON u.id = tm.user_id
          WHERE tm.trip_id = ?`,
    args: [tripId],
  });
  const ownerRes = await client.execute({ sql: 'SELECT id, name, email FROM users WHERE id = ?', args: [trip.owner_id] });
  const items = itemsRes.rows.map((it) => ({
    ...it,
    is_favorite: !!it.is_favorite,
    photos: photosByItem[it.id] || [],
  }));
  const totalCost = items.reduce((sum, it) => sum + (Number(it.cost) || 0), 0);
  return { ...trip, items, members: membersRes.rows, owner: ownerRes.rows[0], total_cost: totalCost };
}

// --- trip list -------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const { id: userId, email } = req.user;
    const ownedRes = await client.execute({
      sql: 'SELECT * FROM trips WHERE owner_id = ? ORDER BY updated_at DESC',
      args: [userId],
    });
    const sharedRes = await client.execute({
      sql: `SELECT t.*, tm.role as my_role FROM trips t
            JOIN trip_members tm ON tm.trip_id = t.id
            WHERE (tm.user_id = ? OR tm.invited_email = ?) AND t.owner_id != ?
            ORDER BY t.updated_at DESC`,
      args: [userId, email, userId],
    });

    async function withCost(t) {
      const r = await client.execute({
        sql: 'SELECT COALESCE(SUM(cost),0) as total FROM trip_items WHERE trip_id = ?',
        args: [t.id],
      });
      return { ...t, total_cost: r.rows[0].total };
    }

    const owned = await Promise.all(ownedRes.rows.map(async (t) => ({ ...(await withCost(t)), my_role: 'owner' })));
    const shared = await Promise.all(sharedRes.rows.map(withCost));

    res.json({ owned, shared });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- create trip -----------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const { name, total_days, destination_lat, destination_lng, destination_label, currency } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Plan adı zorunlu.' });
    const days = Math.max(1, parseInt(total_days, 10) || 1);
    const id = uuid();
    await client.execute({
      sql: `INSERT INTO trips (id, owner_id, name, total_days, destination_lat, destination_lng, destination_label, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user.id,
        name.trim(),
        days,
        destination_lat ?? null,
        destination_lng ?? null,
        destination_label ?? null,
        currency || 'TRY',
      ],
    });
    res.status(201).json(await loadFullTrip(id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- get single trip ---------------------------------------------------

router.get('/:id', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    const full = await loadFullTrip(req.params.id);
    res.json({ ...full, my_role: role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- update trip meta ----------------------------------------------------

router.put('/:id', async (req, res) => {
  try {
    const { role, trip } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

    const { name, total_days, destination_lat, destination_lng, destination_label, currency, status } = req.body || {};
    await client.execute({
      sql: `UPDATE trips SET
              name = COALESCE(?, name),
              total_days = COALESCE(?, total_days),
              destination_lat = ?,
              destination_lng = ?,
              destination_label = ?,
              currency = COALESCE(?, currency),
              status = COALESCE(?, status),
              updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        name?.trim() || null,
        total_days ? Math.max(1, parseInt(total_days, 10)) : null,
        destination_lat ?? trip.destination_lat,
        destination_lng ?? trip.destination_lng,
        destination_label ?? trip.destination_label,
        currency || null,
        status || null,
        req.params.id,
      ],
    });
    res.json(await loadFullTrip(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi silebilir.' });
    await client.execute({ sql: 'DELETE FROM trips WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- replace all day items in one go (used by the day-by-day editor) ------
//
// This upserts rather than blanket delete+insert: an item whose id already
// exists in the trip is UPDATEd in place (so its photos and memory note,
// which reference trip_items.id via ON DELETE CASCADE, survive re-saving
// the plan), a new item is INSERTed, and only items that were actually
// removed by the user are deleted.

router.put('/:id/items', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const existingRes = await client.execute({ sql: 'SELECT id FROM trip_items WHERE trip_id = ?', args: [req.params.id] });
    const existingIds = new Set(existingRes.rows.map((r) => r.id));
    const incomingIds = new Set();

    const statements = [];
    items.forEach((it, idx) => {
      // Locally-created rows use a client-side placeholder id (e.g. "local-...")
      // until they're persisted for the first time; give those a real uuid.
      const id = it.id && existingIds.has(it.id) ? it.id : uuid();
      incomingIds.add(id);
      if (existingIds.has(id)) {
        statements.push({
          sql: `UPDATE trip_items SET
                  day_number = ?, title = ?, time = ?, cost = ?, lat = ?, lng = ?,
                  location_label = ?, notes = ?, sort_order = ?
                WHERE id = ?`,
          args: [
            Math.max(1, parseInt(it.day_number, 10) || 1),
            (it.title || '').trim() || 'Etkinlik',
            it.time || null,
            Number(it.cost) || 0,
            it.lat ?? null,
            it.lng ?? null,
            it.location_label ?? null,
            it.notes ?? null,
            idx,
            id,
          ],
        });
      } else {
        statements.push({
          sql: `INSERT INTO trip_items (id, trip_id, day_number, title, time, cost, lat, lng, location_label, notes, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            req.params.id,
            Math.max(1, parseInt(it.day_number, 10) || 1),
            (it.title || '').trim() || 'Etkinlik',
            it.time || null,
            Number(it.cost) || 0,
            it.lat ?? null,
            it.lng ?? null,
            it.location_label ?? null,
            it.notes ?? null,
            idx,
          ],
        });
      }
    });

    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (toDelete.length) {
      statements.push({
        sql: `DELETE FROM trip_items WHERE id IN (${toDelete.map(() => '?').join(',')})`,
        args: toDelete,
      });
    }
    statements.push({ sql: "UPDATE trips SET updated_at = datetime('now') WHERE id = ?", args: [req.params.id] });

    await client.batch(statements, 'write');
    res.json(await loadFullTrip(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- memories: favorite flag + short personal note on a day item ----------

router.put('/:id/items/:itemId/memory', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

    const itemRes = await client.execute({
      sql: 'SELECT id FROM trip_items WHERE id = ? AND trip_id = ?',
      args: [req.params.itemId, req.params.id],
    });
    if (!itemRes.rows[0]) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

    const { is_favorite, memory_note } = req.body || {};
    await client.execute({
      sql: 'UPDATE trip_items SET is_favorite = ?, memory_note = ? WHERE id = ?',
      args: [is_favorite ? 1 : 0, (memory_note ?? '').trim() || null, req.params.itemId],
    });
    res.json(await loadFullTrip(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- memories: photos on a day item ----------------------------------------

router.post('/:id/items/:itemId/photos', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

    const itemRes = await client.execute({
      sql: 'SELECT id FROM trip_items WHERE id = ? AND trip_id = ?',
      args: [req.params.itemId, req.params.id],
    });
    if (!itemRes.rows[0]) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

    const { dataUri, caption } = req.body || {};
    if (!dataUri || !String(dataUri).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Geçerli bir fotoğraf gerekli.' });
    }

    let uploaded;
    try {
      uploaded = await uploadImage(dataUri, `voyago/${req.params.id}`);
    } catch (uploadErr) {
      console.error('Fotoğraf yüklenemedi:', uploadErr);
      return res.status(502).json({ error: 'Fotoğraf yüklenemedi, lütfen tekrar deneyin.' });
    }

    const countRes = await client.execute({
      sql: 'SELECT COUNT(*) as n FROM trip_item_photos WHERE trip_item_id = ?',
      args: [req.params.itemId],
    });
    const id = uuid();
    await client.execute({
      sql: `INSERT INTO trip_item_photos (id, trip_item_id, url, public_id, caption, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, req.params.itemId, uploaded.url, uploaded.public_id, (caption || '').trim() || null, countRes.rows[0].n],
    });
    res.status(201).json(await loadFullTrip(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.delete('/:id/items/:itemId/photos/:photoId', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu planı düzenleme yetkiniz yok.' });

    const photoRes = await client.execute({
      sql: `SELECT p.* FROM trip_item_photos p
            JOIN trip_items ti ON ti.id = p.trip_item_id
            WHERE p.id = ? AND p.trip_item_id = ? AND ti.trip_id = ?`,
      args: [req.params.photoId, req.params.itemId, req.params.id],
    });
    const photo = photoRes.rows[0];
    if (!photo) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });

    await client.execute({ sql: 'DELETE FROM trip_item_photos WHERE id = ?', args: [photo.id] });
    deleteImage(photo.public_id); // best-effort, don't block the response on Cloudinary

    res.json(await loadFullTrip(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// --- sharing / members -----------------------------------------------------

router.get('/:id/members', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (!role) return res.status(404).json({ error: 'Plan bulunamadı ya da erişiminiz yok.' });
    const result = await client.execute({
      sql: `SELECT tm.id, tm.invited_email as email, tm.role, u.name as user_name
            FROM trip_members tm LEFT JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = ?`,
      args: [req.params.id],
    });
    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi arkadaş davet edebilir.' });
    const { email, memberRole } = req.body || {};
    if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Geçerli bir e-posta girin.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUserRes = await client.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [normalizedEmail] });
    const existingUser = existingUserRes.rows[0];
    const id = uuid();
    try {
      await client.execute({
        sql: `INSERT INTO trip_members (id, trip_id, user_id, invited_email, role)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          id,
          req.params.id,
          existingUser ? existingUser.id : null,
          normalizedEmail,
          memberRole === 'viewer' ? 'viewer' : 'editor',
        ],
      });
    } catch (err) {
      return res.status(409).json({ error: 'Bu kişi zaten davetli.' });
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi rol değiştirebilir.' });
    const { memberRole } = req.body || {};
    await client.execute({
      sql: 'UPDATE trip_members SET role = ? WHERE id = ? AND trip_id = ?',
      args: [memberRole === 'viewer' ? 'viewer' : 'editor', req.params.memberId, req.params.id],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const { role } = await getAccess(req.params.id, req.user.id, req.user.email);
    if (role !== 'owner') return res.status(403).json({ error: 'Sadece plan sahibi kişi çıkarabilir.' });
    await client.execute({
      sql: 'DELETE FROM trip_members WHERE id = ? AND trip_id = ?',
      args: [req.params.memberId, req.params.id],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

module.exports = router;
