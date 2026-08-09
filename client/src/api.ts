import type { MediaType, MetadataDetails, MetadataSearchResult, Movie, MovieInput } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Request failed.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function listMovies() {
  return request<Movie[]>('/api/movies')
}

export function createMovie(input: MovieInput) {
  return request<Movie>('/api/movies', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMovie(id: number, input: MovieInput) {
  return request<Movie>(`/api/movies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteMovie(id: number) {
  return request<void>(`/api/movies/${id}`, {
    method: 'DELETE',
  })
}

export function searchMetadata(query: string, mediaType: MediaType) {
  return request<MetadataSearchResult[]>(
    `/api/metadata/search?q=${encodeURIComponent(query)}&type=${mediaType}`,
  )
}

export function getMetadataDetails(tmdbId: number, mediaType: MediaType) {
  return request<MetadataDetails>(`/api/metadata/${mediaType}/${tmdbId}`)
}
