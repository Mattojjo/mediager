import type { MediaType, MetadataDetails, MetadataSearchResult, Movie, MovieInput } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
const responseCache = new Map<string, { value: unknown; expiresAt: number }>()
const inflightRequests = new Map<string, Promise<unknown>>()
const cacheTtlMs = 10 * 60 * 1000

async function request<T>(pathname: string, init?: RequestInit, options?: { cacheKey?: string; cacheTtlMs?: number; bypassCache?: boolean }): Promise<T> {
  const cacheKey = options?.cacheKey
  const ttl = options?.cacheTtlMs ?? cacheTtlMs

  if (cacheKey && !options?.bypassCache) {
    const cached = responseCache.get(cacheKey) as { value: T; expiresAt: number } | undefined

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const inflight = inflightRequests.get(cacheKey) as Promise<T> | undefined
    if (inflight) {
      return inflight
    }
  }

  const responsePromise = fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  }).then(async (response) => {
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'Request failed.')
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  })

  if (cacheKey && !options?.bypassCache) {
    const trackedPromise = responsePromise.then((value) => {
      responseCache.set(cacheKey, { value, expiresAt: Date.now() + ttl })
      return value
    }) as Promise<T>

    inflightRequests.set(cacheKey, trackedPromise as Promise<unknown>)
    return trackedPromise.finally(() => {
      inflightRequests.delete(cacheKey)
    })
  }

  return responsePromise as Promise<T>
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
    undefined,
    {
      cacheKey: `metadata-search:${mediaType}:${query.trim().toLowerCase()}`,
    },
  )
}

export function getMetadataDetails(tmdbId: number, mediaType: MediaType) {
  return request<MetadataDetails>(`/api/metadata/${mediaType}/${tmdbId}`, undefined, {
    cacheKey: `metadata-details:${mediaType}:${tmdbId}`,
  })
}
