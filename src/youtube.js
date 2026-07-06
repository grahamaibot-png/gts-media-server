const fetch = require('node-fetch');

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

/** Returns the currently-live video for the channel, or null. */
async function getCurrentLiveVideo() {
  const url = `${BASE_URL}/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube live search failed: ${res.status}`);
  const json = await res.json();
  const item = json.items && json.items[0];
  if (!item) return null;
  return { id: item.id.videoId, title: item.snippet.title };
}

/**
 * Returns upcoming scheduled broadcasts for the channel (streams you've
 * scheduled a start time for on YouTube), with their scheduled start time.
 */
async function getUpcomingBroadcasts() {
  const url = `${BASE_URL}/search?part=snippet&channelId=${CHANNEL_ID}&eventType=upcoming&type=video&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube upcoming search failed: ${res.status}`);
  const json = await res.json();
  const items = json.items || [];

  // The search endpoint doesn't return scheduledStartTime directly —
  // need a follow-up call to videos.list with liveStreamingDetails.
  if (items.length === 0) return [];
  const ids = items.map((i) => i.id.videoId).join(',');
  const detailsUrl = `${BASE_URL}/videos?part=liveStreamingDetails,snippet&id=${ids}&key=${API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) throw new Error(`YouTube video details failed: ${detailsRes.status}`);
  const detailsJson = await detailsRes.json();

  return (detailsJson.items || [])
    .filter((v) => v.liveStreamingDetails && v.liveStreamingDetails.scheduledStartTime)
    .map((v) => ({
      id: v.id,
      title: v.snippet.title,
      scheduledStartTime: v.liveStreamingDetails.scheduledStartTime,
    }));
}

module.exports = { getCurrentLiveVideo, getUpcomingBroadcasts };
