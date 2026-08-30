# Mediager

Mediager is a single-user movie queue for titles you want to download later. It stores your watchlist locally using browser localStorage, shows posters and release dates, lets you rewatch trailers, and opens a saved external provider page when you are ready.

## Stack

- React + TypeScript + Vite frontend
- LocalStorage for data persistence (no backend required)
- TMDB API for optional metadata search and enrichment

## Setup

1. Run `npm install` in the project root to install dependencies.
2. Optionally, add a TMDB API key via environment variables if you want real metadata search.
3. Start the frontend with `npm run dev`.

### Development Commands

- `npm run dev` starts only the frontend (recommended)
- Build and deploy: `npm run build`

## Features

- Add, edit, and delete movies from your queue
- Poster-first browsing UI
- Trailer playback from a stored or TMDB-provided YouTube URL
- Digital release date tracking
- External download/provider page button
- Local browser storage (data persists across browser sessions)
- Optional TMDB metadata search for movie information

## How It Works

Mediager uses browser `localStorage` to persist your movie queue. All data is stored in a single key called `movies` with JSON array format. The entire application runs in the frontend bundle - no backend server is needed.

## Notes

- If no TMDB API key is configured, manual entry still works
- Download buttons open the saved external provider page; the app does not fetch torrents directly
- Movie data is stored per-browser (clearing browser data removes your queue)
