const fetch = require('node-fetch');

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

/**
* No YouTube Data API key involved anywhere in this file. Everything
* here uses YouTube's public, unauthenticated endpoints (the same ones
* a browser uses), so there's no API quota, no Google Cloud project,
* and no compliance review tied to this server's YouTube access.
*/

/**
* Detects whether the channel is live right now using YouTube's public
* "/live" vanity URL. When a channel is live, youtube.com/channel/<id>/live
* redirects to that video's watch page; when nothing is live, it stays
* on the channel page (no "v=" in the final URL).
*
* That redirect alone isn't 100% reliable on its own - it can briefly
* keep pointing at a broadcast that just ended, or at an upcoming
* premiere's waiting-room page. So as a second check, we fetch the
* watch page itself and only report "live" if it actually contains
* YouTube's own isLive marker, which YouTube only sets while
* a broadcast is actively streaming.
*/
async function getCurrentLiveVideo() {
  const liveUrl = `https://www.youtube.com/channel/${CHANNEL_ID}/live`;
  const res = await fetch(liveUrl, { redirect: 'follow' });
  const finalUrl = res.url || '';
  const match = finalUrl.match(/[?&]v=([^&]+)/);
  if (!match) return null;

const videoId = match[1];
  const isActuallyLive = await confirmIsLive(videoId);
  if (!isActuallyLive) return null;

const details = await getVideoDetails(videoId);
  if (!details) return null;

return {
  id: videoId,
  title: details.title,
  description: details.description,
  thumbnail: details.thumbnail,
  publishedAt: new Date().toISOString(),
};
}

/**
* Confirms a video is actively live (not just associated with the
* channel's /live slot) by checking the raw watch page HTML for
* YouTube's own live marker. No API key involved - just reading the
* same public page a browser loads.
*/
async function confirmIsLive(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('"isLive":true');
  } catch {
    return false;
  }
}

/**
* Public oEmbed endpoint. Works for any public YouTube video, no API
* key required. Gives us title + thumbnail, which is all the app shows.
*/
async function getVideoDetails(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return {
    title: json.title || '',
    description: '',
    thumbnail: json.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
* Pulls the channel's recent uploads from YouTube's public RSS/Atom
* feed. No API key, no quota. YouTube caps this feed at the ~15 most
* recent videos, which is plenty for a "past streams" list.
*/
async function getPastStreams(maxResults = 15) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube RSS feed failed: ${res.status}`);
  const xml = await res.text();

const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);

return entries
  .slice(0, maxResults)
  .map((entry) => {
    const id = firstMatch(entry, /<yt:videoId>(.*?)<\/yt:videoId>/);
    const title = decodeXml(firstMatch(entry, /<title>(.*?)<\/title>/));
    const published = firstMatch(entry, /<published>(.*?)<\/published>/);
    const description = decodeXml(
      firstMatch(entry, /<media:description>([\s\S]*?)<\/media:description>/)
      );
    const thumbnail =
      firstMatch(entry, /<media:thumbnail url="(.*?)"/) ||
      (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

       return { id, title, description, thumbnail, publishedAt: published };
  })
  .filter((item) => item.id);
}

function firstMatch(str, regex) {
  const m = str.match(regex);
  return m ? m[1] : '';
}

function decodeXml(str) {
  return str
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");
}

module.exports = { getCurrentLiveVideo, getPastStreams };
