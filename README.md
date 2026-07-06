# GTS Media Notification Server

Small always-on Node service that:

1. Polls YouTube every ~60 seconds to check if the channel is live, and sends a push ("GTS Media is LIVE") the moment it goes live.
2. Checks for scheduled/upcoming broadcasts and sends a "starting in ~15 minutes" push when one is in that window.
3. Uses [Expo's push notification service](https://docs.expo.dev/push-notifications/overview/) to deliver to phones — no Apple/Google push certificates to manage yourself.

The app doesn't need this to function for browsing streams — it's only needed for the push notification features. If you don't deploy it, the app still works, it just won't send "going live" alerts when closed.

## Deploy it (works on basically any Node host)

This is plain Node + Express with no host-specific code, so pick whatever you're comfortable with. A few common free/cheap options:

### Render.com (free tier, easiest)
1. Push this `gts-media-server` folder to a GitHub repo (or a repo containing it as a subfolder).
2. In Render: **New > Web Service** → connect the repo.
3. Root directory: `gts-media-server` (if it's part of a bigger repo).
4. Build command: `npm install`. Start command: `npm start`.
5. Add the environment variables from `.env.example` under **Environment**.
6. Deploy. Render gives you a URL like `https://gts-media-notify.onrender.com`.

### Railway.app (also easy, usage-based free credits)
Same idea: connect repo, set root directory, set env vars from `.env.example`, deploy.

### Your own VPS / existing hosting
```bash
cd gts-media-server
npm install
cp .env.example .env   # then fill in real values
npm start
```
Run it under `pm2` or a systemd service so it restarts if the process dies or the box reboots.

**Important for free tiers:** some free hosts spin services down after inactivity and wipe local disk on redeploy. This server stores tokens/state in a local `data/` folder — if your host does either of those, you'll lose registered devices or get a duplicate "you're live" push after a redeploy. Render/Railway's free web services stay up fine for this use case (constant HTTP server), but if you ever add a persistent volume or swap to a real database, this is the reason.

## After deploying

1. Copy the URL your host gives you (e.g. `https://gts-media-notify.onrender.com`).
2. In the app project, open `gts-media-app/src/config.ts` and set:
   ```ts
   export const NOTIFICATION_BACKEND_URL = 'https://gts-media-notify.onrender.com';
   ```
3. Make sure `NOTIFICATION_SHARED_SECRET` in the app matches `REGISTER_SHARED_SECRET` in the server's `.env` — this is just a shared password so strangers can't spam your `/register-token` endpoint.
4. Rebuild the app (or reload in Expo Go) — it'll register the device's push token with the server on launch.

## Testing it works

```bash
curl https://YOUR-BACKEND-URL/health
# → {"ok":true}
```

To force-test a live push without actually waiting to go live, you can temporarily call `broadcastPush` from a one-off script, or just go live for a moment on Switcher/YouTube and watch the server logs for `[watcher] Sent live notification for ...`.

## Environment variables

See `.env.example` for the full list: `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, `POLL_INTERVAL_SECONDS`, `PORT`, `REGISTER_SHARED_SECRET`.
