const imageBaseUrl = 'https://image.tmdb.org/t/p/w780'
const metadataCache = new Map<string, { value: unknown; expiresAt: number }>()
const inflightMetadataRequests = new Map<string, Promise<unknown>>()
const cacheTtlMs = 10 * 60 * 1000

interface TmdbSearchResponse {
  results: Array<{
    id: number
    title?: string
    name?: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    release_date?: string | null
    first_air_date?: string | null
  }>
}

interface TmdbDetailResponse {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string | null
  first_air_date?: string | null
  videos?: {
    results: Array<{
      key: string
      site: string
      type: string
      official: boolean
    }>
  }
  release_dates?: {
    results: Array<{
      iso_3166_1: string
      release_dates: Array<{
        certification: string
        iso_639_1: string
        note: string
        release_date: string
        type: number
      }>
    }>
  }
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

export type MetadataMediaType = 'movie' | 'tv'

interface TmdbConfiguration {
  baseUrl: string
  authMode: 'bearer' | 'api-key'
  accessToken?: string
  apiKey?: string
}

export function resolveTmdbConfiguration(env: NodeJS.ProcessEnv = process.env): TmdbConfiguration {
  const accessToken = env.TMDB_READ_ACCESS_TOKEN?.trim()
  const apiKey = env.TMDB_API_KEY?.trim()
  const baseUrl = env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3'

  if (accessToken) {
    return { baseUrl, authMode: 'bearer', accessToken }
  }

  if (apiKey) {
    return { baseUrl, authMode: 'api-key', apiKey }
  }

  throw new Error(
    'TMDB search is not set up yet. Add TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY to server/.env, then restart the backend. Manual entry still works.',
  )
}

function getConfiguration() {
  return resolveTmdbConfiguration()
}

function buildImageUrl(pathname: string | null): string {
  return pathname ? `${imageBaseUrl}${pathname}` : ''
}

function buildYoutubeUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${key}`
}

function parseYear(date: string | null): number | null {
  if (!date) {
    return null
  }

  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

async function withCache<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  const cached = metadataCache.get(cacheKey) as { value: T; expiresAt: number } | undefined

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const inflight = inflightMetadataRequests.get(cacheKey) as Promise<T> | undefined
  if (inflight) {
    return inflight
  }

  const promise = loader()
    .then((value) => {
      metadataCache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs })
      return value
    })
    .finally(() => {
      inflightMetadataRequests.delete(cacheKey)
    })

  inflightMetadataRequests.set(cacheKey, promise as Promise<unknown>)
  return promise
}

function getReleaseDate(result: { release_date?: string | null; first_air_date?: string | null }) {
  return result.release_date ?? result.first_air_date ?? null
}

function getTitle(result: { title?: string; name?: string }) {
  return result.title ?? result.name ?? 'Untitled'
}

function pickDigitalReleaseDate(response: TmdbDetailResponse, mediaType: MetadataMediaType): string | null {
  if (mediaType === 'tv') {
    const airDate = getReleaseDate(response)
    return airDate ? airDate.slice(0, 10) : null
  }

  const releaseGroups = response.release_dates?.results ?? []
  const orderedGroups = [...releaseGroups].sort((left, right) => {
    if (left.iso_3166_1 === 'US') {
      return -1
    }

    if (right.iso_3166_1 === 'US') {
      return 1
    }

    return left.iso_3166_1.localeCompare(right.iso_3166_1)
  })

  for (const group of orderedGroups) {
    const digitalDate = group.release_dates
      .filter((entry) => entry.type === 4)
      .sort((left, right) => left.release_date.localeCompare(right.release_date))[0]

    if (digitalDate?.release_date) {
      return digitalDate.release_date.slice(0, 10)
    }
  }

  const releaseDate = getReleaseDate(response)
  return releaseDate ? releaseDate.slice(0, 10) : null
}

function pickTrailerUrl(response: TmdbDetailResponse): string {
  const videos = response.videos?.results ?? []
  const chosenVideo =
    videos.find(
      (video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official,
    ) ?? videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer')

  return chosenVideo ? buildYoutubeUrl(chosenVideo.key) : ''
}

async function tmdbFetch<T>(pathname: string, query: Record<string, string> = {}): Promise<T> {
  const { apiKey, accessToken, authMode, baseUrl } = getConfiguration()
  const url = new URL(`${baseUrl}${pathname}`)
  const headers = new Headers()

  if (authMode === 'bearer' && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  } else if (authMode === 'api-key' && apiKey) {
    url.searchParams.set('api_key', apiKey)
  }

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

export async function searchMetadata(
  query: string,
  mediaType: MetadataMediaType,
): Promise<MetadataSearchResult[]> {
  const cacheKey = `search:${mediaType}:${query.trim().toLowerCase()}`

  return withCache(cacheKey, async () => {
    const response = await tmdbFetch<TmdbSearchResponse>(`/search/${mediaType}`, {
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    })

    return response.results.slice(0, 8).map((result) => ({
      tmdbId: result.id,
      title: getTitle(result),
      year: parseYear(getReleaseDate(result)),
      overview: result.overview,
      posterUrl: buildImageUrl(result.poster_path),
    }))
  })
}

export async function fetchMetadata(
  tmdbId: number,
  mediaType: MetadataMediaType,
): Promise<MetadataDetails> {
  const cacheKey = `details:${mediaType}:${tmdbId}`

  return withCache(cacheKey, async () => {
    const appendToResponse = mediaType === 'movie' ? 'videos,release_dates' : 'videos'
    const response = await tmdbFetch<TmdbDetailResponse>(`/${mediaType}/${tmdbId}`, {
      append_to_response: appendToResponse,
      language: 'en-US',
    })

    return {
      tmdbId: response.id,
      title: getTitle(response),
      year: parseYear(getReleaseDate(response)),
      overview: response.overview,
      posterUrl: buildImageUrl(response.poster_path),
      backdropUrl: buildImageUrl(response.backdrop_path),
      trailerUrl: pickTrailerUrl(response),
      digitalReleaseDate: pickDigitalReleaseDate(response, mediaType),
    }
  })
}

export function searchMovieMetadata(query: string): Promise<MetadataSearchResult[]> {
  return searchMetadata(query, 'movie')
}

export function fetchMovieMetadata(tmdbId: number): Promise<MetadataDetails> {
  return fetchMetadata(tmdbId, 'movie')
}
