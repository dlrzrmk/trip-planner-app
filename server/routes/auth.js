const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { client } = require('../db');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'İsim, e-posta ve şifre zorunlu.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await client.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [normalizedEmail] });
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
    }
    const id = uuid();
    const password_hash = bcrypt.hashSync(password, 10);
    await client.execute({
      sql: 'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      args: [id, name.trim(), normalizedEmail, password_hash],
    });

    // Auto-attach any pending trip invites sent to this email before they signed up
    await client.execute({
      sql: 'UPDATE trip_members SET user_id = ? WHERE invited_email = ? AND user_id IS NULL',
      args: [id, normalizedEmail],
    });

    const user = { id, name: name.trim(), email: normalizedEmail };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre zorunlu.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [normalizedEmail] });
    const row = result.rows[0];
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }
    const user = { id: row.id, name: row.name, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

module.exports = router;
