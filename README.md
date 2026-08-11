# Mediager

Mediager is a single-user movie and TV queue designed for frontend-only hosting. It runs entirely in the browser, stores your library in local storage, and optionally enriches entries with TMDB metadata.

## Stack

- React + TypeScript + Vite frontend
- localStorage for persistence
- TMDB for optional metadata search and enrichment

## Setup

1. Install dependencies with `npm install` in the project root.
2. Copy `client/.env.example` to `client/.env`.
3. Add `VITE_TMDB_READ_ACCESS_TOKEN` or `VITE_TMDB_API_KEY` if you want metadata search.
4. Start the app with `npm run dev`.

## Alternative Commands

- `npm run dev` starts the frontend only.
- `npm run build` creates a production build for the frontend only.
- `npm run lint` runs frontend lint checks.

## Features

- Add, edit, and delete movies and TV shows
- Poster-first browsing UI
- Trailer playback from a stored or TMDB-provided YouTube URL
- Digital release date tracking
- External download/provider page button
- Compact localStorage persistence with stable IDs and timestamps
- In-memory plus persisted TMDB response caching with TTL and entry limits

## Vercel Deployment

1. Import this repository in Vercel.
2. Set the project root to `client`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add `VITE_TMDB_READ_ACCESS_TOKEN` or `VITE_TMDB_API_KEY` in Vercel environment variables.

If TMDB credentials are not configured, queue management still works and users can add entries manually.

## Notes

- Data is stored per browser and device. Clearing browser storage removes saved entries.
- Download buttons open the saved external provider page; the app does not fetch torrents directly.
