/**
* Manual stand-in for YouTube's "upcoming broadcasts" API. YouTube
* doesn't expose scheduled-stream info through any public/no-key
* endpoint, so instead you tell the server directly when each game
* starts using the simple form at /admin (see index.js).
*
* Holds a *list* of upcoming broadcasts (not just one), so you can
* queue up an entire season's worth of games in advance. No Google
* API, no key, no quota, no compliance review - just a small file
* this server keeps for itself.
*/
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getBroadcasts() {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveBroadcasts(list) {
  ensureDataDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(list, null, 2));
}

function addBroadcast({ title, scheduledStartTime }) {
  const list = getBroadcasts();
  const entry = {
    id: `manual-${Date.now()}`,
    title,
    scheduledStartTime,
  };
  list.push(entry);
  list.sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime));
  saveBroadcasts(list);
  return entry;
}

function removeBroadcast(id) {
  const list = getBroadcasts().filter((b) => b.id !== id);
  saveBroadcasts(list);
}

/**
* Drops any broadcast whose start time is more than a day in the past,
* so the list (and the admin page) doesn't accumulate old games
* forever. Called on every watcher tick.
*/
function pruneOldBroadcasts() {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const list = getBroadcasts();
  const kept = list.filter((b) => new Date(b.scheduledStartTime).getTime() > now - ONE_DAY_MS);
  if (kept.length !== list.length) {
    saveBroadcasts(kept);
  }
  return kept;
}

module.exports = { getBroadcasts, addBroadcast, removeBroadcast, pruneOldBroadcasts };
