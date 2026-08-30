import type { MediaType, MetadataDetails, MetadataSearchResult, Movie } from './types'

// Helper to parse year from date string
function parseYear(date: string | null): number | null {
  if (!date) {
    return null
  }

  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

// Import database functions
import { 
  listMovies as listLocalMovies, 
  createMovie as dbCreateMovie,
  updateMovie as dbUpdateMovie,
  deleteMovie as dbDeleteMovie
} from './db'

// Import types
import type { MovieRecord, MovieInput } from './db'

// Import key manager for localStorage API key
import { getStoredApiKey } from './keyManager'

async function tmdbSearch<T>(pathname: string, query: string = '', options: Record<string, string> = {}): Promise<T> {
  const baseUrl = 'https://api.themoviedb.org/3'
  const url = new URL(`${baseUrl}${pathname}`)
  url.searchParams.set('language', 'en-US')
  
  // Get the API key from localStorage
  const tmdbApiKey = getStoredApiKey()
  
  if (!tmdbApiKey) {
    throw new Error('TMDB API key not configured. Please add your API key in Settings.')
  }
  
  if (query) {
    url.searchParams.set('query', query)
  }

  url.searchParams.set('api_key', tmdbApiKey)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('page', '1')

  for (const [key, value] of Object.entries(options)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString())


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

  // Try TMDB search if API key is configured
  if (getStoredApiKey()) {
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

export async function getMetadataDetails(tmdbId: number, mediaType: MediaType): Promise<MetadataDetails> {
  // First check localStorage
  const records = listLocalMovies() as MovieRecord[]
  const movie = records.find((m: MovieRecord) => m.tmdbId === tmdbId)
  if (movie) {
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

  // Try fetching from TMDB if configured
  if (getStoredApiKey()) {
    try {
      const endpoint = mediaType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
      const response = await tmdbSearch<any>(endpoint)
      return {
        tmdbId: response.id,
        title: response.title ?? response.name ?? 'Unknown Movie',
        year: parseYear(response.release_date ?? response.first_air_date),
        overview: response.overview ?? 'No overview available.',
        posterUrl: response.poster_path ? `https://image.tmdb.org/t/p/w500${response.poster_path}` : '',
        backdropUrl: response.backdrop_path ? `https://image.tmdb.org/t/p/w1280${response.backdrop_path}` : '',
        trailerUrl: '',
        digitalReleaseDate: null,
      }
    } catch (error) {
      // Fall back to placeholder if TMDB fails
    }
  }

  // Return placeholder if not found anywhere
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

export function listMovies(): Movie[] {
  const records = listLocalMovies() as MovieRecord[]
  return records.map((r: MovieRecord) => ({ ...r }))
}

export function createMovie(input: MovieInput): Movie {
  return dbCreateMovie(input) as Movie
}

export function updateMovie(id: number, input: MovieInput): Movie | undefined {
  return dbUpdateMovie(id, input) as Movie | undefined
}

export function deleteMovie(id: number): boolean {
  return dbDeleteMovie(id)
}