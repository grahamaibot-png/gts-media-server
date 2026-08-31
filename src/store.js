/**
* Device push token and "already notified" state storage, backed by
* Upstash Redis (REST API) instead of local files.
*
* Local JSON files here got wiped every time this free-tier host
* redeployed or spun down from inactivity, which silently
* un-registered every phone. Upstash's free tier persists forever and
* survives redeploys, so this swap fixes that for good.
*
* Needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set in
* the environment (free database at upstash.com, no credit card).
*/
const fetch = require('node-fetch');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in environment.');
}

async function redis(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`Upstash error: ${json.error}`);
  }
  return json.result;
}

function getTokens() {
  return redis(['SMEMBERS', 'tokens']).then((tokens) => tokens || []);
}

function addToken(token) {
  return redis(['SADD', 'tokens', token]);
}

function removeToken(token) {
  return redis(['SREM', 'tokens', token]);
}

const DEFAULT_STATE = {
  lastNotifiedLiveVideoId: null,
  notifiedUpcomingIds: [],
};

async function getState() {
  const raw = await redis(['GET', 'state']);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function setState(state) {
  return redis(['SET', 'state', JSON.stringify(state)]);
}

module.exports = { getTokens, addToken, removeToken, getState, setState };
