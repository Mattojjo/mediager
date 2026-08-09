# Mediager

Mediager is a single-user movie queue for titles you want to download later. It stores your watchlist locally, shows posters and release dates, lets you rewatch trailers, and opens a saved external provider page when you are ready.

## Stack

- React + TypeScript + Vite frontend
- Express + TypeScript backend
- SQLite for local persistence
- TMDB for optional metadata search and enrichment

## Setup

1. Install dependencies in both apps.
2. Copy `server/.env.example` to `server/.env` and add a TMDB API key if you want metadata search.
3. Run `npm install` in the project root to install the shared dev runner.
4. Start both services with `npm run dev`.

## Alternative Commands

- `npm run dev` starts both the backend and frontend in one terminal.
- `npm run dev:server` starts only the backend.
- `npm run dev:client` starts only the frontend.

## Features

- Add, edit, and delete movies
- Poster-first browsing UI
- Trailer playback from a stored or TMDB-provided YouTube URL
- Digital release date tracking
- External download/provider page button
- Local SQLite persistence

## Notes

- If no TMDB API key is configured, manual entry still works.
- Download buttons open the saved external provider page; the app does not fetch torrents directly.
