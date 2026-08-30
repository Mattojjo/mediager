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

function getMovies(): MovieRecord[] {
  const raw = localStorage.getItem('movies')
  return raw ? JSON.parse(raw) : []
}

function saveMovies(movies: MovieRecord[]): void {
  localStorage.setItem('movies', JSON.stringify(movies))
}

let nextId = 0

export function listMovies(): MovieRecord[] {
  const movies = getMovies()
  return movies.sort((a: MovieRecord, b: MovieRecord) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMovie(id: number): MovieRecord | undefined {
  const movies: Map<number, MovieRecord> = new Map(
    getMovies()?.map((movie: MovieRecord) => [movie.id, movie]) || []
  )
  return movies.get(id) as MovieRecord | undefined
}

export function createMovie(input: MovieInput): MovieRecord {
  const movie: MovieRecord = {
    id: 0,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  nextId++
  movie.id = nextId
  const movies = getMovies()
  movies.push(movie)
  saveMovies(movies)

  return movie
}

export function updateMovie(id: number, input: MovieInput): MovieRecord | undefined {
  const records = getMovies()

  const existing = records.find((m: any) => m.id === id)

  if (!existing) {
    return undefined
  }

  const updated: MovieRecord = {
    ...existing,
    mediaType: input.mediaType ?? existing.mediaType,
    title: input.title.trim(),
    year: input.year ?? null,
    overview: input.overview?.trim() ?? '',
    posterUrl: input.posterUrl?.trim() ?? '',
    backdropUrl: input.backdropUrl?.trim() ?? '',
    trailerUrl: input.trailerUrl?.trim() ?? '',
    digitalReleaseDate: input.digitalReleaseDate ?? existing.digitalReleaseDate,
    providerPageUrl: input.providerPageUrl?.trim() ?? existing.providerPageUrl,
    status: input.status ?? existing.status,
    notes: input.notes?.trim() ?? existing.notes,
    priority: input.priority ?? existing.priority,
    tmdbId: input.tmdbId ?? existing.tmdbId,
    updatedAt: new Date().toISOString(),
  }

  const index = records.findIndex((m: any) => m.id === id)
  if (index !== -1) {
    records[index] = updated
  }

  saveMovies(records)

  return records.find((m: any) => m.id === id)
}

export function deleteMovie(id: number): boolean {
  const records = getMovies().filter((m: any) => m.id !== id)
  saveMovies(records)
  return true
}