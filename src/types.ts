export type MovieStatus = 'planned' | 'released' | 'downloaded'
export type MediaType = 'movie' | 'tv'

export interface Movie {
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
}

export interface MetadataSearchResult {
  tmdbId: number
  title: string
  year: number | null
  overview: string
  posterUrl: string
}

export interface MetadataDetails extends MetadataSearchResult {
  backdropUrl: string
  trailerUrl: string
  digitalReleaseDate: string | null
}
