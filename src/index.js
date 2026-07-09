require('dotenv').config();
const express = require('express');
const { addToken, removeToken } = require('./store');
const { startWatching } = require('./watcher');
const { getCache } = require('./cache');
const { getBroadcasts, addBroadcast, removeBroadcast } = require('./schedule');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const SHARED_SECRET = process.env.REGISTER_SHARED_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// No YOUTUBE_API_KEY needed anymore - youtube.js only uses YouTube's
// public, no-key endpoints (the /live redirect + oEmbed + RSS feed).
if (!process.env.YOUTUBE_CHANNEL_ID) {
  console.error('Missing YOUTUBE_CHANNEL_ID in environment. See .env.example.');
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

// Simple browser page for queueing up scheduled broadcasts - this
// replaces YouTube's "upcoming broadcasts" API (which has no no-key
// public equivalent) so the 15-minute "starting soon" push still works
// with zero Google API involvement. Add as many games as you want in
// advance. Bookmark this page: <your-server-url>/admin?secret=YOUR_ADMIN_SECRET
app.get('/admin', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized. Add ?secret=YOUR_ADMIN_SECRET to the URL.');
  }

        const secretParam = encodeURIComponent(req.query.secret || '');
  const upcoming = getBroadcasts();

        const rows = upcoming
  .map(
    (b) => `
    <div class="game">
    <div>
    <strong>${escapeHtml(b.title)}</strong>
    <div class="when">${new Date(b.scheduledStartTime).toLocaleString()}</div>
    </div>
    <form method="POST" action="/admin/schedule/remove?secret=${secretParam}">
    <input type="hidden" name="id" value="${b.id}">
    <button type="submit" class="remove">Remove</button>
    </form>
    </div>`
    )
  .join('');

        res.send(`<!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>GTS Media - Game Schedule</title>
        <style>
        body { font-family: -apple-system, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; background: #0b0b0d; color: #fff; }
        h1 { font-size: 20px; }
        h2 { font-size: 16px; margin-top: 32px; color: #ccc; }
        label { display: block; margin-top: 16px; font-size: 14px; color: #ccc; }
        input { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 6px; border-radius: 8px; border: 1px solid #444; background: #1a1a1c; color: #fff; font-size: 16px; }
        button { margin-top: 20px; width: 100%; padding: 12px; border-radius: 8px; border: none; background: #e63946; color: #fff; font-size: 16px; font-weight: 600; }
        .game { margin-top: 12px; padding: 12px; background: #1a1a1c; border-radius: 8px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .when { color: #999; margin-top: 4px; }
        .remove { margin-top: 0; width: auto; padding: 8px 12px; background: #333; font-size: 13px; }
        .empty { margin-top: 12px; color: #999; font-size: 14px; }
        </style>
        </head>
        <body>
        <h1>Add a game</h1>
        <p>Add every upcoming game here. The app will push a "starting soon" notification 15 minutes before each one kicks off - no YouTube API involved.</p>
        <form method="POST" action="/admin/schedule?secret=${secretParam}">
        <label>Game title
        <input type="text" name="title" placeholder="GTS Media vs. Example High" required>
        </label>
        <label>Start time
        <input type="datetime-local" name="scheduledStartTime" required>
        </label>
        <button type="submit">Add game</button>
        </form>

        <h2>Upcoming games (${upcoming.length})</h2>
        ${upcoming.length ? rows : '<div class="empty">Nothing queued up yet.</div>'}
        </body>
        </html>`);
});

function escapeHtml(str) {
  return String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}

app.post('/admin/schedule', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  const { title, scheduledStartTime } = req.body || {};
  if (!title || !scheduledStartTime) {
    return res.status(400).send('title and scheduledStartTime are required');
  }
  addBroadcast({ title, scheduledStartTime: new Date(scheduledStartTime).toISOString() });
  res.redirect(`/admin?secret=${encodeURIComponent(req.query.secret || '')}`);
});

app.post('/admin/schedule/remove', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  const { id } = req.body || {};
  if (id) removeBroadcast(id);
  res.redirect(`/admin?secret=${encodeURIComponent(req.query.secret || '')}`);
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
