require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { init } = require('./db');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
// Higher limit than the default 100kb: memory photos arrive as base64 data
// URIs in the JSON body (client-side resized to ~1600px before upload, but
// base64 still inflates the raw byte size by ~33%).
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

const PORT = process.env.PORT || 4000;
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Trip planner API http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Veritabanı başlatılamadı', err);
    process.exit(1);
  });
