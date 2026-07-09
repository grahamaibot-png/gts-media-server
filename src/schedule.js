/**
* Manual stand-in for YouTube's "upcoming broadcasts" API. YouTube
* doesn't expose scheduled-stream info through any public/no-key
* endpoint, so instead you tell the server directly when your next
* stream starts using the simple form at /admin (see index.js).
*
* No Google API, no key, no quota, no compliance review - just a small
* file this server keeps for itself.
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

function getNextBroadcast() {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function setNextBroadcast({ title, scheduledStartTime }) {
  ensureDataDir();
  const data = {
    id: `manual-${Date.now()}`,
    title,
    scheduledStartTime,
  };
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
  return data;
}

function clearNextBroadcast() {
  ensureDataDir();
  if (fs.existsSync(SCHEDULE_FILE)) {
    fs.unlinkSync(SCHEDULE_FILE);
  }
}

module.exports = { getNextBroadcast, setNextBroadcast, clearNextBroadcast };
