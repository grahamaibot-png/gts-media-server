const fetch = require('node-fetch');
const { getTokens, removeToken } = require('./store');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // Expo's per-request limit

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Sends the same title/body notification to every registered device. */
async function broadcastPush(title, body, data = {}) {
  const tokens = getTokens();
  if (tokens.length === 0) return;

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    const messages = batch.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
      channelId: 'live-alerts',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json = await res.json().catch(() => null);
    if (json && Array.isArray(json.data)) {
      json.data.forEach((ticket, idx) => {
        // Prune tokens Expo says are dead (app uninstalled, etc.)
        if (
          ticket.status === 'error' &&
          ticket.details &&
          ticket.details.error === 'DeviceNotRegistered'
        ) {
          removeToken(batch[idx]);
        }
      });
    }
  }
}

module.exports = { broadcastPush };
