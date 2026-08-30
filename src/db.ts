import { get, set } from 'local-storage'

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

// Helper function to normalize movie input
function normalizeMovieInput(input: MovieInput): Omit<MovieRecord, 'id' | 'createdAt' | 'updatedAt'> {
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
  }
}

export function listMovies(): MovieRecord[] {
  const movies: MovieRecord[] = get<MovieRecord[]>('movies') || []
  return movies.sort((a: MovieRecord, b: MovieRecord) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMovie(id: number): MovieRecord | undefined {
  const movies: Map<number, MovieRecord> = new Map(
    (get<MovieRecord[]>('movies') || [])?.map((movie: MovieRecord) => [movie.id, movie])
  )
  return movies.get(id) as MovieRecord | undefined
}

export function createMovie(input: MovieInput): MovieRecord {
  const base: Omit<MovieRecord, 'id' | 'createdAt' | 'updatedAt'> = normalizeMovieInput(input)

  nextId++
  const movie: MovieRecord = {
    ...base,
    id: nextId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  set('movies', [...(listMovies() as unknown[]), movie])

  return movie
}

export function updateMovie(id: number, input: MovieInput): MovieRecord | undefined {
  const records = get<MovieRecord[]>('movies') || []

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

  set('movies', records)

  return { ...records.find((m: any) => m.id === id)! }
}

export function deleteMovie(id: number): boolean {
  const records = [...(get<MovieRecord[]>('movies') || [])]
  const filtered = records.filter((m: any) => m.id !== id)

  set('movies', filtered)

  return true
}