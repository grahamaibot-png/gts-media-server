require('dotenv').config();
const express = require('express');
const { addToken, removeToken } = require('./store');
const { startWatching } = require('./watcher');
const { getCache } = require('./cache');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SHARED_SECRET = process.env.REGISTER_SHARED_SECRET;

if (!process.env.YOUTUBE_API_KEY || !process.env.YOUTUBE_CHANNEL_ID) {
  console.error('Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID in environment. See .env.example.');
  process.exit(1);
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// The app polls these two endpoints instead of calling YouTube directly.
// This server is the only thing that ever talks to YouTube's API, so
// quota usage stays flat no matter how many people have the app open.
app.get('/live-status', (req, res) => {
  res.json(getCache().liveStatus);
});

app.get('/past-streams', (req, res) => {
  res.json({ items: getCache().pastStreams });
});

app.post('/register-token', (req, res) => {
  const { token, secret } = req.body || {};

  if (SHARED_SECRET && secret !== SHARED_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  addToken(token);
  res.json({ ok: true });
});

app.post('/unregister-token', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  removeToken(token);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
  const intervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS) || 60;
  startWatching(intervalSeconds);
  console.log(`[watcher] polling YouTube every ${intervalSeconds}s`);
});
