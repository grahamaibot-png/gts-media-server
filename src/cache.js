/**
 * Simple in-memory cache of YouTube data. The server refreshes this on
 * a timer (see watcher.js) and every phone using the app reads from
 * here via the /live-status and /past-streams endpoints — instead of
 * every phone calling YouTube's API directly, which burns through the
 * daily quota almost instantly once more than a couple people are using
 * the app at the same time.
 */
let cache = {
  liveStatus: { isLive: false },
  pastStreams: [],
  lastLiveCheck: null,
  lastPastStreamsCheck: null,
};

function getCache() {
  return cache;
}

function setLiveStatus(liveStatus) {
  cache.liveStatus = liveStatus;
  cache.lastLiveCheck = new Date().toISOString();
}

function setPastStreams(pastStreams) {
  cache.pastStreams = pastStreams;
  cache.lastPastStreamsCheck = new Date().toISOString();
}

module.exports = { getCache, setLiveStatus, setPastStreams };
