# Mediager Client

Frontend-only React app for managing a personal movie/TV queue.

## Run Locally

1. Copy `.env.example` to `.env`.
2. Add `VITE_TMDB_READ_ACCESS_TOKEN` or `VITE_TMDB_API_KEY` for metadata search (optional).
3. Install dependencies: `npm install`.
4. Start development server: `npm run dev`.

## Build

- `npm run build`
- `npm run preview`

## Storage Model

- Queue data is stored in browser `localStorage`.
- The app uses a compact serialized format to reduce storage size.
- TMDB responses are cached with TTL and a max entry cap to prevent unbounded growth.

## Vercel

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `client`
