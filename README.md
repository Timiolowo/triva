# Tivra

Tivra is a lightweight, remote-friendly movie and TV interface designed for Smart TV browsers.

The home screen refreshes from TMDB's daily trending feed every 24 hours and falls back to its saved picks when the feed is unavailable.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your TMDB API key as `TMDB_API_KEY`.
3. Run `npm run dev`.

The local server opens on `http://localhost:3000` by default. The browser never receives the TMDB key.

## Deploy to Vercel

1. Import this directory into Vercel using the **Other** framework preset.
2. Leave Build Command and Output Directory empty.
3. Add `TMDB_API_KEY` under Project Settings → Environment Variables.
4. Enable the variable for Production, Preview, and Development.
5. Deploy a Preview first and verify search, TV seasons, episodes, playback, and remote Back/OK behavior.
6. Promote the verified Preview to Production.

The root HTML, CSS, and JavaScript deploy as static CDN assets. `api/search.js` and `api/tv.js` deploy automatically as Vercel Functions.

## Required environment variables

| Name | Scope | Exposure |
| --- | --- | --- |
| `TMDB_API_KEY` | Production, Preview, Development | Server only |

Never prefix the key with `NEXT_PUBLIC_` and never place it in `app.js`.
# triva
