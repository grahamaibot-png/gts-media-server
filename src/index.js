require('dotenv').config();
const express = require('express');
const { addToken, removeToken } = require('./store');
const { startWatching } = require('./watcher');
const { getCache } = require('./cache');
const { getNextBroadcast, setNextBroadcast, clearNextBroadcast } = require('./schedule');

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

// Simple browser page for setting the next scheduled broadcast - this
// replaces YouTube's "upcoming broadcasts" API (which has no no-key
// public equivalent) so the 15-minute "starting soon" push still works
// with zero Google API involvement. Bookmark this page on your phone
// or computer: <your-server-url>/admin?secret=YOUR_ADMIN_SECRET
app.get('/admin', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized. Add ?secret=YOUR_ADMIN_SECRET to the URL.');
  }

        const next = getNextBroadcast();
  res.send(`<!DOCTYPE html>
  <html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GTS Media - Set Next Broadcast</title>
  <style>
  body { font-family: -apple-system, sans-serif; max-width: 420px; margin: 40px auto; padding: 0 16px; background: #0b0b0d; color: #fff; }
  h1 { font-size: 20px; }
  label { display: block; margin-top: 16px; font-size: 14px; color: #ccc; }
  input { width: 100%; box-sizing: border-box; padding: 10px; margin-top: 6px; border-radius: 8px; border: 1px solid #444; background: #1a1a1c; color: #fff; font-size: 16px; }
  button { margin-top: 20px; width: 100%; padding: 12px; border-radius: 8px; border: none; background: #e63946; color: #fff; font-size: 16px; font-weight: 600; }
  .current { margin-top: 24px; padding: 12px; background: #1a1a1c; border-radius: 8px; font-size: 14px; }
  a { color: #e63946; }
  </style>
  </head>
  <body>
  <h1>Set next broadcast</h1>
  <p>Fill this in when you schedule a stream, and the app will push a "starting soon" notification 15 minutes before kickoff - no YouTube API involved.</p>
  <form method="POST" action="/admin/schedule?secret=${encodeURIComponent(req.query.secret || '')}">
  <label>Game title
  <input type="text" name="title" placeholder="GTS Media vs. Example High" required>
  </label>
  <label>Start time
  <input type="datetime-local" name="scheduledStartTime" required>
  </label>
  <button type="submit">Save</button>
  </form>
  ${
    next
    ? `<div class="current">Currently scheduled: <strong>${next.title}</strong> at ${new Date(
      next.scheduledStartTime
      ).toLocaleString()}. <form method="POST" action="/admin/schedule/clear?secret=${encodeURIComponent(
      req.query.secret || ''
      )}" style="display:inline"><button type="submit" style="width:auto;padding:6px 12px;background:#333;">Clear</button></form></div>`
    : '<div class="current">Nothing scheduled right now.</div>'
  }
  </body>
  </html>`);
});

app.post('/admin/schedule', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  const { title, scheduledStartTime } = req.body || {};
  if (!title || !scheduledStartTime) {
    return res.status(400).send('title and scheduledStartTime are required');
  }
  setNextBroadcast({ title, scheduledStartTime: new Date(scheduledStartTime).toISOString() });
  res.redirect(`/admin?secret=${encodeURIComponent(req.query.secret || '')}`);
});

app.post('/admin/schedule/clear', (req, res) => {
  if (ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  clearNextBroadcast();
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
