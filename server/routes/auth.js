const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { client } = require('../db');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeExpiry() {
  return new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'İsim, e-posta, telefon ve şifre zorunlu.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    }
    const normalizedPhone = String(phone).trim();
    if (normalizedPhone.replace(/[^0-9]/g, '').length < 10) {
      return res.status(400).json({ error: 'Geçerli bir telefon numarası girin.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await client.execute({ sql: 'SELECT id, email_verified FROM users WHERE email = ?', args: [normalizedEmail] });
    if (existing.rows.length) {
      const row = existing.rows[0];
      if (!row.email_verified) {
        return res.status(409).json({
          error: 'Bu e-posta ile bir hesap var ama doğrulanmamış.',
          needsVerification: true,
          email: normalizedEmail,
        });
      }
      return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
    }

    const id = uuid();
    const password_hash = bcrypt.hashSync(password, 10);
    const code = generateCode();

    await client.execute({
      sql: `INSERT INTO users (id, name, email, password_hash, phone, verification_code, verification_code_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name.trim(), normalizedEmail, password_hash, normalizedPhone, code, codeExpiry()],
    });

    // Auto-attach any pending trip invites sent to this email before they signed up
    await client.execute({
      sql: 'UPDATE trip_members SET user_id = ? WHERE invited_email = ? AND user_id IS NULL',
      args: [id, normalizedEmail],
    });

    try {
      await sendVerificationEmail(normalizedEmail, code);
    } catch (mailErr) {
      console.error('Doğrulama e-postası gönderilemedi:', mailErr);
    }

    res.json({ needsVerification: true, email: normalizedEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'E-posta ve kod zorunlu.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [normalizedEmail] });
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Hesap bulunamadı.' });
    }
    if (row.email_verified) {
      const user = { id: row.id, name: row.name, email: row.email };
      return res.json({ token: signToken(user), user });
    }
    if (!row.verification_code || String(row.verification_code) !== String(code).trim()) {
      return res.status(400).json({ error: 'Doğrulama kodu hatalı.' });
    }
    if (row.verification_code_expires_at && new Date(row.verification_code_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Doğrulama kodunun süresi dolmuş, yeni kod isteyin.' });
    }
    await client.execute({
      sql: 'UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires_at = NULL WHERE id = ?',
      args: [row.id],
    });
    const user = { id: row.id, name: row.name, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'E-posta zorunlu.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [normalizedEmail] });
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Hesap bulunamadı.' });
    }
    if (row.email_verified) {
      return res.status(400).json({ error: 'Hesap zaten doğrulanmış.' });
    }
    const code = generateCode();
    await client.execute({
      sql: 'UPDATE users SET verification_code = ?, verification_code_expires_at = ? WHERE id = ?',
      args: [code, codeExpiry(), row.id],
    });
    try {
      await sendVerificationEmail(normalizedEmail, code);
    } catch (mailErr) {
      console.error('Doğrulama e-postası gönderilemedi:', mailErr);
    }
    res.json({ ok: true });
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
    if (!row.email_verified) {
      return res.status(403).json({
        error: 'Hesabınız henüz doğrulanmamış.',
        needsVerification: true,
        email: row.email,
      });
    }
    const user = { id: row.id, name: row.name, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

module.exports = router;
