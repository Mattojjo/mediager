import { localstorage } from 'local-storage'

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

let nextId = 0

// Helper function to trim strings while keeping null/undefined as-is
function normalizeMovieInput(input: MovieInput): Omit<MovieRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    mediaType: input.mediaType ?? 'movie',
    title: input.title.trim(),
    year: input.year,
    overview: input.overview?.trim() ?? '',
    posterUrl: input.posterUrl?.trim() ?? '',
    backdropUrl: input.backdropUrl?.trim() ?? '',
    trailerUrl: input.trailerUrl?.trim() ?? '',
    digitalReleaseDate: input.digitalReleaseDate || null,
    providerPageUrl: input.providerPageUrl?.trim() ?? '',
    status: input.status ?? 'planned',
    notes: input.notes?.trim() ?? '',
    priority: input.priority ?? 2,
    tmdbId: input.tmdbId,
  }
}

export function listMovies(): MovieRecord[] {
  const movies = localstorage.get('movies') || []
  return movies.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMovie(id: number): MovieRecord | undefined {
  const movies: Map<number, MovieRecord> = new Map(
    (localstorage.get('movies') || [])?.map((movie: MovieRecord) => [movie.id, movie])
  )
  return movies.get(id) as MovieRecord | undefined
}

export function createMovie(input: MovieInput): MovieRecord {
  const movie: Omit<MovieRecord, 'id' | 'createdAt' | 'updatedAt'> = normalizeMovieInput(input)
  
  nextId++
  movie.id = nextId
  
  localstorage.set('movies', [...(listMovies() as unknown[]), movie])
  
  return movie
}

export function updateMovie(id: number, input: MovieInput): MovieRecord | undefined {
  const records = localstorage.get('movies') || []
  
  const existing = records.find((m: any) => m.id === id)
  
  if (!existing) {
    return undefined
  }

  const updated: Omit<MovieRecord, 'id' | 'createdAt'> = {
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

  const index = records.findIndex((m: any) => m.id === id)
  if (index !== -1) {
    records[index] = { ...existing, ...updated }
  }
  
  localstorage.set('movies', records)

  return { ...records.find((m: any) => m.id === id)! }
}

export function deleteMovie(id: number): boolean {
  const records = [...(localstorage.get('movies') || [])]
  const filtered = records.filter((m: any) => m.id !== id)
  
  localstorage.set('movies', filtered)
  
  return true
}

function normalizeMovieInput(input: MovieInput): Omit<MovieRecord, 'id' | 'createdAt' | 'updatedAt'> {
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
