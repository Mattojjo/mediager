import type { MediaType, MetadataDetails, MetadataSearchResult } from './types'
import { listMovies as listLocalMovies, createMovie as dbCreate, updateMovie as dbUpdate, deleteMovie as dbDelete } from './db'
import type { MovieInput } from './db'
import { getStoredApiKey } from './keyManager'

// ============================================================================
// TMDB API Integration
// ============================================================================

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const POSTER_SIZE = 'w500'
const BACKDROP_SIZE = 'w1280'

async function tmdbFetch<T>(pathname: string, query: string = ''): Promise<T> {
  const apiKey = await getStoredApiKey()
  if (!apiKey) throw new Error('TMDB API key not configured. Please add your API key in Settings.')

  const url = new URL(`${TMDB_BASE_URL}${pathname}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  if (query) url.searchParams.set('query', query)

  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`TMDB request failed with status ${response.status}`)
  return response.json() as Promise<T>
}

function parseYear(date: string | null): number | null {
  if (!date) return null
  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

// ============================================================================
// Public API Functions
// ============================================================================

export async function searchMetadata(query: string, mediaType: MediaType): Promise<MetadataSearchResult[]> {
  if (!query.trim()) return []

  // Try TMDB if API key is configured
  if (await getStoredApiKey()) {
    try {
      const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv'
      const response = await tmdbFetch<any>(endpoint, query)
      if (response.results?.length) {
        return response.results
          .slice(0, 8)
          .filter((r: any) => r.title || r.name)
          .map((r: any) => ({
            tmdbId: r.id,
            title: r.title ?? r.name ?? 'Unknown',
            year: parseYear(r.release_date ?? r.first_air_date),
            overview: r.overview,
            posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/${POSTER_SIZE}${r.poster_path}` : '',
          }))
      }
    } catch {
      // Fall through to local search
    }
  }

  // Client-side search through the local IndexedDB database
  const movies = await listLocalMovies()
  const queryLower = query.trim().toLowerCase()

  return movies
    .filter((m) =>
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

export async function getMetadataDetails(tmdbId: number, mediaType: MediaType): Promise<MetadataDetails> {
  // Check the local IndexedDB database first
  const records = await listLocalMovies()
  const movie = records.find((m) => m.tmdbId === tmdbId)
  if (movie) {
    return {
      tmdbId: movie.tmdbId ?? 0,
      title: movie.title,
      year: movie.year,
      overview: movie.overview,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      trailerUrl: await fetchTrailerUrl(tmdbId, mediaType),
      digitalReleaseDate: movie.digitalReleaseDate,
    }
  }

  // Try fetching from TMDB if configured
  if (await getStoredApiKey()) {
    try {
      const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
      const response = await tmdbFetch<any>(endpoint)
      return {
        tmdbId: response.id,
        title: response.title ?? response.name ?? 'Unknown',
        year: parseYear(response.release_date ?? response.first_air_date),
        overview: response.overview ?? 'No overview available.',
        posterUrl: response.poster_path ? `https://image.tmdb.org/t/p/${POSTER_SIZE}${response.poster_path}` : '',
        backdropUrl: response.backdrop_path ? `https://image.tmdb.org/t/p/${BACKDROP_SIZE}${response.backdrop_path}` : '',
        trailerUrl: await fetchTrailerUrl(tmdbId, mediaType),
        digitalReleaseDate: null,
      }
    } catch {
      // Fall back to placeholder
    }
  }

  return {
    tmdbId,
    title: 'Unknown',
    year: null,
    overview: 'No overview available.',
    posterUrl: '',
    backdropUrl: '',
    trailerUrl: '',
    digitalReleaseDate: null,
  }
}

async function fetchTrailerUrl(tmdbId: number, mediaType: MediaType): Promise<string> {
  if (!await getStoredApiKey()) return ''

  try {
    const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}/videos` : `/tv/${tmdbId}/videos`
    const response = await tmdbFetch<any>(endpoint)

    if (!response.results?.length) return ''

    // Prefer official trailers first
    const trailer = response.results.find(
      (v: any) => v.type === 'Trailer' && v.site === 'YouTube' && v.official,
    ) || response.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube')

    return trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : ''
  } catch {
    return ''
  }
}

// ============================================================================
// Database Operations
// ============================================================================

export async function listMovies() {
  return (await listLocalMovies()).map((record) => ({ ...record }))
}

export async function createMovie(input: MovieInput) {
  return dbCreate(input)
}

export async function updateMovie(id: number, input: MovieInput) {
  return dbUpdate(id, input)
}

export async function deleteMovie(id: number) {
  return dbDelete(id)
}
