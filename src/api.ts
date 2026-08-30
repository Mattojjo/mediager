import type { MediaType, MetadataDetails, MetadataSearchResult, Movie } from './types'

// Helper to parse year from date string
function parseYear(date: string | null): number | null {
  if (!date) {
    return null
  }

  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

// Import local storage functions
import { listMovies as listLocalMovies } from './db'

// Import types
import type { MovieRecord, MovieInput } from './db'

// TMDB configuration detection
const tmdbReadAccessToken = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN?.trim()
const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY?.trim()

async function tmdbSearch<T>(pathname: string, query: string = '', options: Record<string, string> = {}): Promise<T> {
  const baseUrl = 'https://api.themoviedb.org/3'
  const url = new URL(`${baseUrl}${pathname}`)
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('query', query)

  if (tmdbReadAccessToken) {
    url.searchParams.set('include_adult', 'false')
    url.searchParams.set('page', '1')
  } else if (tmdbApiKey) {
    url.searchParams.set('api_key', tmdbApiKey)
    url.searchParams.set('include_adult', 'false')
    url.searchParams.set('page', '1')
  }

  for (const [key, value] of Object.entries(options)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    headers: tmdbReadAccessToken ? { Authorization: `Bearer ${tmdbReadAccessToken}` } : {},
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function searchMetadata(query: string, mediaType: MediaType): Promise<MetadataSearchResult[]> {
  const results: MetadataSearchResult[] = []

  if (!query.trim()) {
    return results
  }

  // Try TMDB search if configured
  if (tmdbReadAccessToken || tmdbApiKey) {
    try {
      const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv'
      const response = await tmdbSearch<any>(endpoint, query)
      if (response.results && Array.isArray(response.results)) {
        return response.results
          .slice(0, 8)
          .filter((r: any) => r.title || r.name)
          .map((r: any) => ({
            tmdbId: r.id,
            title: r.title ?? r.name ?? 'Unknown',
            year: parseYear(r.release_date ?? r.first_air_date),
            overview: r.overview,
            posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : '',
          }))
      }
    } catch (error) {
      // Fall through to client-side search if TMDB fails
    }
  }

  // Client-side search through localStorage
  const movies = listLocalMovies() as MovieRecord[]
  const queryLower = query.trim().toLowerCase()

  return movies
    .filter(
      (m) =>
        (m.title?.toLowerCase().includes(queryLower) ||
          m.overview?.toLowerCase().includes(queryLower) ||
          m.notes?.toLowerCase().includes(queryLower)) &&
        m.mediaType === mediaType,
    )
    .map((m) => ({
      tmdbId: m.tmdbId!,
      title: m.title,
      year: m.year,
      overview: m.overview,
      posterUrl: m.posterUrl,
    }))
    .slice(0, 8)
}

export async function getMetadataDetails(tmdbId: number, _mediaType: MediaType): Promise<MetadataDetails> {
  const records = listLocalMovies() as MovieRecord[]
  const movie = records.find((m: MovieRecord) => m.tmdbId === tmdbId)
  if (!movie) {
    return {
      tmdbId: tmdbId,
      title: 'Unknown Movie',
      year: null,
      overview: 'No overview available.',
      posterUrl: '',
      backdropUrl: '',
      trailerUrl: '',
      digitalReleaseDate: null,
    }
  }
  return {
    tmdbId: movie.tmdbId ?? 0,
    title: movie.title,
    year: movie.year,
    overview: movie.overview,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    trailerUrl: movie.trailerUrl,
    digitalReleaseDate: movie.digitalReleaseDate,
  }
}

export function listMovies(): Movie[] {
  const records = listLocalMovies() as MovieRecord[]
  return records.map((r: MovieRecord) => ({ ...r }))
}

export function createMovie(input: MovieInput): Movie {
  const record: MovieRecord = {
    id: 0,
    mediaType: input.mediaType ?? 'movie',
    title: input.title,
    year: input.year ?? null,
    overview: input.overview ?? '',
    posterUrl: input.posterUrl ?? '',
    backdropUrl: input.backdropUrl ?? '',
    trailerUrl: input.trailerUrl ?? '',
    digitalReleaseDate: input.digitalReleaseDate ?? null,
    providerPageUrl: input.providerPageUrl ?? '',
    status: input.status ?? 'planned',
    notes: input.notes ?? '',
    priority: input.priority ?? 2,
    tmdbId: input.tmdbId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Save to localStorage
  const movies = listLocalMovies() as MovieRecord[]
  movies.push(record)
  localStorage.setItem('movies', JSON.stringify(movies))

  return { ...record }
}

export function updateMovie(id: number, input: MovieInput): Movie | undefined {
  const records = listLocalMovies() as MovieRecord[]
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

  localStorage.setItem('movies', JSON.stringify(records))
  return { ...updated }
}

export function deleteMovie(id: number): boolean {
  const records = [...(listLocalMovies() as MovieRecord[])].filter((m: any) => m.id !== id)
  localStorage.setItem('movies', JSON.stringify(records))
  return true
}