import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type MovieStatus = 'planned' | 'released' | 'downloaded'
export type MediaType = 'movie' | 'tv'

export interface MovieRecord {
  id: number
  mediaType: MediaType
  title: string
  year: number | null
  overview: string
  posterUrl: string
  backdropUrl: string
  trailerUrl: string
  digitalReleaseDate: string | null
  providerPageUrl: string
  status: MovieStatus
  notes: string
  priority: number
  tmdbId: number | null
  createdAt: string
  updatedAt: string
}

export interface MovieInput {
  mediaType?: MediaType
  title: string
  year?: number | null
  overview?: string
  posterUrl?: string
  backdropUrl?: string
  trailerUrl?: string
  digitalReleaseDate?: string | null
  providerPageUrl?: string
  status?: MovieStatus
  notes?: string
  priority?: number
  tmdbId?: number | null
}

const dataDir = path.join(process.cwd(), 'data')
const databasePath = path.join(dataDir, 'mediager.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const database = new Database(databasePath)

database.pragma('journal_mode = WAL')

database.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL DEFAULT 'movie',
    title TEXT NOT NULL,
    year INTEGER,
    overview TEXT NOT NULL DEFAULT '',
    poster_url TEXT NOT NULL DEFAULT '',
    backdrop_url TEXT NOT NULL DEFAULT '',
    trailer_url TEXT NOT NULL DEFAULT '',
    digital_release_date TEXT,
    provider_page_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 2,
    tmdb_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

try {
  database.exec("ALTER TABLE movies ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'")
} catch {
  // Column already exists on databases created after media type support.
}

const movieSelect = `
  SELECT
    id,
    media_type AS mediaType,
    title,
    year,
    overview,
    poster_url AS posterUrl,
    backdrop_url AS backdropUrl,
    trailer_url AS trailerUrl,
    digital_release_date AS digitalReleaseDate,
    provider_page_url AS providerPageUrl,
    status,
    notes,
    priority,
    tmdb_id AS tmdbId,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM movies
`

const listStatement = database.prepare(`${movieSelect} ORDER BY updated_at DESC`)
const getStatement = database.prepare(`${movieSelect} WHERE id = ?`)
const insertStatement = database.prepare(`
  INSERT INTO movies (
    media_type,
    title,
    year,
    overview,
    poster_url,
    backdrop_url,
    trailer_url,
    digital_release_date,
    provider_page_url,
    status,
    notes,
    priority,
    tmdb_id,
    created_at,
    updated_at
  ) VALUES (
    @mediaType,
    @title,
    @year,
    @overview,
    @posterUrl,
    @backdropUrl,
    @trailerUrl,
    @digitalReleaseDate,
    @providerPageUrl,
    @status,
    @notes,
    @priority,
    @tmdbId,
    @createdAt,
    @updatedAt
  )
`)
const updateStatement = database.prepare(`
  UPDATE movies
  SET
    media_type = @mediaType,
    title = @title,
    year = @year,
    overview = @overview,
    poster_url = @posterUrl,
    backdrop_url = @backdropUrl,
    trailer_url = @trailerUrl,
    digital_release_date = @digitalReleaseDate,
    provider_page_url = @providerPageUrl,
    status = @status,
    notes = @notes,
    priority = @priority,
    tmdb_id = @tmdbId,
    updated_at = @updatedAt
  WHERE id = @id
`)
const deleteStatement = database.prepare('DELETE FROM movies WHERE id = ?')

function normalizeMovieInput(input: MovieInput) {
  const timestamp = new Date().toISOString()

  return {
    mediaType: input.mediaType ?? 'movie',
    title: input.title.trim(),
    year: input.year ?? null,
    overview: input.overview?.trim() ?? '',
    posterUrl: input.posterUrl?.trim() ?? '',
    backdropUrl: input.backdropUrl?.trim() ?? '',
    trailerUrl: input.trailerUrl?.trim() ?? '',
    digitalReleaseDate: input.digitalReleaseDate || null,
    providerPageUrl: input.providerPageUrl?.trim() ?? '',
    status: input.status ?? 'planned',
    notes: input.notes?.trim() ?? '',
    priority: input.priority ?? 2,
    tmdbId: input.tmdbId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function listMovies(): MovieRecord[] {
  return listStatement.all() as MovieRecord[]
}

export function getMovie(id: number): MovieRecord | undefined {
  return getStatement.get(id) as MovieRecord | undefined
}

export function createMovie(input: MovieInput): MovieRecord {
  const record = normalizeMovieInput(input)
  const result = insertStatement.run(record)

  return getMovie(Number(result.lastInsertRowid)) as MovieRecord
}

export function updateMovie(id: number, input: MovieInput): MovieRecord | undefined {
  const existing = getMovie(id)

  if (!existing) {
    return undefined
  }

  const merged = {
    id,
    mediaType: input.mediaType ?? existing.mediaType,
    title: input.title.trim(),
    year: input.year ?? null,
    overview: input.overview?.trim() ?? '',
    posterUrl: input.posterUrl?.trim() ?? '',
    backdropUrl: input.backdropUrl?.trim() ?? '',
    trailerUrl: input.trailerUrl?.trim() ?? '',
    digitalReleaseDate: input.digitalReleaseDate || null,
    providerPageUrl: input.providerPageUrl?.trim() ?? '',
    status: input.status ?? 'planned',
    notes: input.notes?.trim() ?? '',
    priority: input.priority ?? 2,
    tmdbId: input.tmdbId ?? null,
    updatedAt: new Date().toISOString(),
  }

  updateStatement.run(merged)

  return getMovie(id)
}

export function deleteMovie(id: number): boolean {
  const result = deleteStatement.run(id)
  return result.changes > 0
}
