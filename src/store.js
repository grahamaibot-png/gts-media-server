/**
* Minimal file-based storage for device push tokens and "already
* notified" state, so restarts don't spam duplicate notifications.
*
* Good enough for one channel's worth of traffic. If you outgrow this
* (thousands of users, or your host wipes disk on restart/redeploy -
* common on free tiers) swap this for a real database (Postgres,
* SQLite on a persistent volume, Redis, etc.) - the rest of the code
* only touches the functions below, so the swap is contained here.
*/
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getTokens() {
  return readJson(TOKENS_FILE, []);
}

function addToken(token) {
  const tokens = getTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    writeJson(TOKENS_FILE, tokens);
  }
}

function removeToken(token) {
  const tokens = getTokens().filter((t) => t !== token);
  writeJson(TOKENS_FILE, tokens);
}

function getState() {
  return readJson(STATE_FILE, {
    lastNotifiedLiveVideoId: null,
    lastNotifiedUpcomingId: null,
  });
}

function setState(state) {
  writeJson(STATE_FILE, state);
}

module.exports = { getTokens, addToken, removeToken, getState, setState };
