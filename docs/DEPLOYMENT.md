# Deploying SONARA (Vercel)

No database is needed. Likes, playlists, history and recent searches are stored on the
user's device (localStorage), so they work on Vercel out of the box.

1. Push this folder to GitHub.
2. Import the repo in Vercel (framework: Next.js, nothing else to configure).
3. Add Environment Variables (Production **and** Preview):
   - `YOUTUBE_API_KEY`
   - `NEXT_PUBLIC_YOUTUBE_API_KEY`
4. Deploy. Optional: `SAAVN_API_URL` to use your own JioSaavn API server first.

## Music sources (all full-length)
- JioSaavn (320kbps) via community mirrors, tried one after another
- YouTube Data API v3 (embeddable music videos, official player) with a keyless fallback
- Audius, plus Apple / Deezer metadata (their 30s previews are upgraded to full songs)
