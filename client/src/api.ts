import type { MediaType, MetadataDetails, MetadataSearchResult, Movie } from './types'

// Import local storage functions (now in the same client bundle)
import { listMovies as listLocalMovies, createMovie as createLocalMovie, updateMovie as updateLocalMovie, deleteMovie as deleteLocalMovie } from './db.js'

// Import types for type safety with the backend functions
import type { MovieRecord, MovieInput } from './db.js'

// Mock TMDB metadata functions - return placeholder data for now
export async function searchMetadata(_query: string, _mediaType: MediaType): Promise<MetadataSearchResult[]> {
  const results: MetadataSearchResult[] = []
  if (_query.trim()) {
    results.push({
      tmdbId: 27201, // Example: The Shawshank Redemption
      title: 'The Shawshank Redemption',
      year: 1994,
      overview: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/qKy3U4hKkLJp8H6c7v0Vq2bG9Qa.jpg',
    })
  }
  return results
}

export async function getMetadataDetails(tmdbId: number, _mediaType: MediaType): Promise<MetadataDetails> {
  // For now, return placeholder data - in production you'd want to fetch real TMDB data
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
    tmdbId: movie.tmdbId as number,
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
  const record = createLocalMovie(input) as MovieRecord
  return { ...record }
}

export function updateMovie(id: number, input: MovieInput): Movie | undefined {
  const record = updateLocalMovie(id, input) as MovieRecord | undefined
  return record ? ({ ...record }) : undefined
}

export function deleteMovie(id: number): boolean {
  return deleteLocalMovie(id)
}
