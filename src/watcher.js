const { getCurrentLiveVideo, getUpcomingBroadcasts, getPastStreams } = require('./youtube');
const { getState, setState } = require('./store');
const { broadcastPush } = require('./push');
const { setLiveStatus, setPastStreams } = require('./cache');

const WARNING_WINDOW_MAX_MS = 16 * 60 * 1000; // outer edge of the ~15-min window

// Past streams rarely change (only when a broadcast ends), so we refresh
// that cache far less often than the live-now check to keep YouTube API
// quota usage low. Every 10th tick is plenty.
const PAST_STREAMS_REFRESH_EVERY_N_TICKS = 10;
let tickCount = 0;

/**
 * One polling tick: checks "are we live right now" and "is anything
 * scheduled to start in ~15 minutes", and sends pushes for whichever
 * just became true. Also refreshes the shared cache that /live-status
 * and /past-streams serve to every phone, so individual devices never
 * need to call YouTube's API themselves. Designed to be called on a
 * fixed interval.
 */
async function tick() {
  const state = getState();
  tickCount += 1;

  // 1. Live-now check.
  try {
    const live = await getCurrentLiveVideo();
    setLiveStatus(live ? { isLive: true, video: live } : { isLive: false });

    if (live && state.lastNotifiedLiveVideoId !== live.id) {
      await broadcastPush('🔴 GTS Media is LIVE', live.title, { type: 'live', videoId: live.id });
      state.lastNotifiedLiveVideoId = live.id;
      setState(state);
      console.log(`[watcher] Sent live notification for ${live.id}`);
    } else if (!live && state.lastNotifiedLiveVideoId) {
      // Stream ended — reset so the next stream can trigger a fresh push.
      state.lastNotifiedLiveVideoId = null;
      setState(state);
    }
  } catch (err) {
    console.error('[watcher] live check failed:', err.message);
  }

  // 1b. Past streams refresh (infrequent — see comment above). Also runs
  // on the very first tick (tickCount === 1) so the cache isn't empty
  // for the ~10 ticks it would otherwise take to first populate.
  if (tickCount === 1 || tickCount % PAST_STREAMS_REFRESH_EVERY_N_TICKS === 0) {
    try {
      const pastStreams = await getPastStreams();
      setPastStreams(pastStreams);
    } catch (err) {
      console.error('[watcher] past streams refresh failed:', err.message);
    }
  }

  // 2. 15-minutes-out check for scheduled broadcasts.
  try {
    const upcoming = await getUpcomingBroadcasts();
    const now = Date.now();

    for (const broadcast of upcoming) {
      if (state.notifiedUpcomingIds.includes(broadcast.id)) continue;

      const startsAt = new Date(broadcast.scheduledStartTime).getTime();
      const msUntilStart = startsAt - now;

      // Fire once we're inside the ~15 minute window (up to 16 min out,
      // to tolerate the poll interval not landing exactly on 15:00).
      if (msUntilStart > 0 && msUntilStart <= WARNING_WINDOW_MAX_MS) {
        await broadcastPush(
          'Starting soon',
          `GTS Media goes live in about 15 minutes: ${broadcast.title}`,
          { type: 'upcoming', videoId: broadcast.id }
        );
        state.notifiedUpcomingIds.push(broadcast.id);
        setState(state);
        console.log(`[watcher] Sent 15-min warning for ${broadcast.id}`);
      }
    }

    // Housekeeping: drop old ids for broadcasts that already started/passed
    // so the state file doesn't grow forever.
    const stillRelevant = new Set(upcoming.map((b) => b.id));
    const trimmed = state.notifiedUpcomingIds.filter((id) => stillRelevant.has(id));
    if (trimmed.length !== state.notifiedUpcomingIds.length) {
      state.notifiedUpcomingIds = trimmed;
      setState(state);
    }
  } catch (err) {
    console.error('[watcher] upcoming check failed:', err.message);
  }
}

function startWatching(intervalSeconds) {
  tick(); // run once immediately on boot
  return setInterval(tick, intervalSeconds * 1000);
}

module.exports = { startWatching, tick };
