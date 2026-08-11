import type { MediaType, MetadataDetails, MetadataSearchResult, Movie, MovieInput } from './types'

type CompactMovieStatus = 0 | 1 | 2
type CompactMediaType = 0 | 1

type CompactMovie = [
  id: number,
  mediaType: CompactMediaType,
  title: string,
  year: number | null,
  overview: string,
  posterUrl: string,
  backdropUrl: string,
  trailerUrl: string,
  digitalReleaseDate: string | null,
  providerPageUrl: string,
  status: CompactMovieStatus,
  notes: string,
  priority: number,
  tmdbId: number | null,
  createdAt: string,
  updatedAt: string,
]

interface CompactMovieStore {
  v: 1
  n: number
  m: CompactMovie[]
}

interface CompactMetadataEntry {
  k: string
  e: number
  a: number
  d: MetadataSearchResult[] | MetadataDetails
}

interface CompactMetadataStore {
  v: 1
  i: CompactMetadataEntry[]
}

const MOVIE_STORE_KEY = 'mediager:movies:v1'
const METADATA_STORE_KEY = 'mediager:metadata:v1'
const metadataInMemoryCache = new Map<string, { value: unknown; expiresAt: number }>()
const inflightMetadataRequests = new Map<string, Promise<unknown>>()
const metadataCacheTtlMs = 10 * 60 * 1000
const metadataCacheMaxEntries = 80
const imageBaseUrl = 'https://image.tmdb.org/t/p/w780'

function mediaTypeToCompact(mediaType: MediaType): CompactMediaType {
  return mediaType === 'tv' ? 1 : 0
}

function mediaTypeFromCompact(mediaType: CompactMediaType): MediaType {
  return mediaType === 1 ? 'tv' : 'movie'
}

function statusToCompact(status: Movie['status']): CompactMovieStatus {
  if (status === 'released') {
    return 1
  }

  if (status === 'downloaded') {
    return 2
  }

  return 0
}

function statusFromCompact(status: CompactMovieStatus): Movie['status'] {
  if (status === 1) {
    return 'released'
  }

  if (status === 2) {
    return 'downloaded'
  }

  return 'planned'
}

function serializeMovie(movie: Movie): CompactMovie {
  return [
    movie.id,
    mediaTypeToCompact(movie.mediaType),
    movie.title,
    movie.year,
    movie.overview,
    movie.posterUrl,
    movie.backdropUrl,
    movie.trailerUrl,
    movie.digitalReleaseDate,
    movie.providerPageUrl,
    statusToCompact(movie.status),
    movie.notes,
    movie.priority,
    movie.tmdbId,
    movie.createdAt,
    movie.updatedAt,
  ]
}

function deserializeMovie(compact: CompactMovie): Movie {
  return {
    id: compact[0],
    mediaType: mediaTypeFromCompact(compact[1]),
    title: compact[2],
    year: compact[3],
    overview: compact[4],
    posterUrl: compact[5],
    backdropUrl: compact[6],
    trailerUrl: compact[7],
    digitalReleaseDate: compact[8],
    providerPageUrl: compact[9],
    status: statusFromCompact(compact[10]),
    notes: compact[11],
    priority: compact[12],
    tmdbId: compact[13],
    createdAt: compact[14],
    updatedAt: compact[15],
  }
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readMovieStore(): CompactMovieStore {
  if (!canUseLocalStorage()) {
    return { v: 1, n: 1, m: [] }
  }

  try {
    const raw = window.localStorage.getItem(MOVIE_STORE_KEY)

    if (!raw) {
      return { v: 1, n: 1, m: [] }
    }

    const parsed = JSON.parse(raw) as Partial<CompactMovieStore>

    if (parsed.v !== 1 || !Array.isArray(parsed.m) || typeof parsed.n !== 'number') {
      return { v: 1, n: 1, m: [] }
    }

    return {
      v: 1,
      n: Number.isInteger(parsed.n) && parsed.n > 0 ? parsed.n : 1,
      m: parsed.m,
    }
  } catch {
    return { v: 1, n: 1, m: [] }
  }
}

function writeMovieStore(store: CompactMovieStore) {
  if (!canUseLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(MOVIE_STORE_KEY, JSON.stringify(store))
  } catch {
    throw new Error('Not enough local storage space to save this entry. Delete older items and try again.')
  }
}

function sanitizeMovieInput(input: MovieInput): MovieInput {
  return {
    mediaType: input.mediaType === 'tv' ? 'tv' : 'movie',
    title: input.title.trim(),
    year: typeof input.year === 'number' ? input.year : null,
    overview: input.overview.trim(),
    posterUrl: input.posterUrl.trim(),
    backdropUrl: input.backdropUrl.trim(),
    trailerUrl: input.trailerUrl.trim(),
    digitalReleaseDate: input.digitalReleaseDate || null,
    providerPageUrl: input.providerPageUrl.trim(),
    status: input.status,
    notes: input.notes.trim(),
    priority: Math.min(5, Math.max(1, Math.round(input.priority))),
    tmdbId: typeof input.tmdbId === 'number' ? input.tmdbId : null,
  }
}

function buildMovie(id: number, input: MovieInput, createdAt: string, updatedAt: string): Movie {
  return {
    id,
    mediaType: input.mediaType,
    title: input.title,
    year: input.year,
    overview: input.overview,
    posterUrl: input.posterUrl,
    backdropUrl: input.backdropUrl,
    trailerUrl: input.trailerUrl,
    digitalReleaseDate: input.digitalReleaseDate,
    providerPageUrl: input.providerPageUrl,
    status: input.status,
    notes: input.notes,
    priority: input.priority,
    tmdbId: input.tmdbId,
    createdAt,
    updatedAt,
  }
}

function readMetadataStore(): CompactMetadataStore {
  if (!canUseLocalStorage()) {
    return { v: 1, i: [] }
  }

  try {
    const raw = window.localStorage.getItem(METADATA_STORE_KEY)

    if (!raw) {
      return { v: 1, i: [] }
    }

    const parsed = JSON.parse(raw) as Partial<CompactMetadataStore>
    if (parsed.v !== 1 || !Array.isArray(parsed.i)) {
      return { v: 1, i: [] }
    }

    return { v: 1, i: parsed.i }
  } catch {
    return { v: 1, i: [] }
  }
}

function writeMetadataStore(store: CompactMetadataStore) {
  if (!canUseLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(METADATA_STORE_KEY, JSON.stringify(store))
  } catch {
    // Metadata cache is best-effort and can be skipped when storage is tight.
  }
}

function getPersistedMetadataCache<T>(cacheKey: string): T | null {
  const store = readMetadataStore()
  const now = Date.now()
  const match = store.i.find((entry) => entry.k === cacheKey)

  if (!match || match.e <= now) {
    return null
  }

  return match.d as T
}

function setPersistedMetadataCache(cacheKey: string, value: MetadataSearchResult[] | MetadataDetails, expiresAt: number) {
  const now = Date.now()
  const store = readMetadataStore()
  const filtered = store.i.filter((entry) => entry.k !== cacheKey && entry.e > now)

  filtered.push({
    k: cacheKey,
    e: expiresAt,
    a: now,
    d: value,
  })

  filtered.sort((left, right) => right.a - left.a)
  writeMetadataStore({ v: 1, i: filtered.slice(0, metadataCacheMaxEntries) })
}

export async function listMovies() {
  const store = readMovieStore()

  return store.m
    .map(deserializeMovie)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function createMovie(input: MovieInput) {
  const normalized = sanitizeMovieInput(input)

  if (!normalized.title) {
    throw new Error('Title is required.')
  }

  const store = readMovieStore()
  const timestamp = new Date().toISOString()
  const movie = buildMovie(store.n, normalized, timestamp, timestamp)

  store.m.unshift(serializeMovie(movie))
  store.n += 1
  writeMovieStore(store)

  return movie
}

export async function updateMovie(id: number, input: MovieInput) {
  const normalized = sanitizeMovieInput(input)

  if (!normalized.title) {
    throw new Error('Title is required.')
  }

  const store = readMovieStore()
  const index = store.m.findIndex((compact) => compact[0] === id)

  if (index < 0) {
    throw new Error('Entry not found.')
  }

  const existing = deserializeMovie(store.m[index])
  const updated = buildMovie(id, normalized, existing.createdAt, new Date().toISOString())
  store.m[index] = serializeMovie(updated)
  writeMovieStore(store)

  return updated
}

export async function deleteMovie(id: number) {
  const store = readMovieStore()
  const originalLength = store.m.length
  store.m = store.m.filter((compact) => compact[0] !== id)

  if (store.m.length === originalLength) {
    throw new Error('Entry not found.')
  }

  writeMovieStore(store)
}

interface TmdbSearchResponse {
  results: Array<{
    id: number
    title?: string
    name?: string
    overview: string
    poster_path: string | null
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
        release_date: string
        type: number
      }>
    }>
  }
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

function getReleaseDate(result: { release_date?: string | null; first_air_date?: string | null }) {
  return result.release_date ?? result.first_air_date ?? null
}

function getTitle(result: { title?: string; name?: string }) {
  return result.title ?? result.name ?? 'Untitled'
}

function pickDigitalReleaseDate(response: TmdbDetailResponse, mediaType: MediaType): string | null {
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
    videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official) ??
    videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer')

  return chosenVideo ? buildYoutubeUrl(chosenVideo.key) : ''
}

function resolveTmdbConfiguration() {
  const accessToken = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN?.trim()
  const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim()
  const baseUrl = import.meta.env.VITE_TMDB_BASE_URL?.trim() || 'https://api.themoviedb.org/3'

  if (accessToken) {
    return { authMode: 'bearer' as const, token: accessToken, baseUrl }
  }

  if (apiKey) {
    return { authMode: 'api-key' as const, token: apiKey, baseUrl }
  }

  throw new Error('TMDB search is not configured. Add VITE_TMDB_READ_ACCESS_TOKEN or VITE_TMDB_API_KEY to client/.env.')
}

async function tmdbFetch<T>(pathname: string, query: Record<string, string> = {}): Promise<T> {
  const configuration = resolveTmdbConfiguration()
  const url = new URL(`${configuration.baseUrl}${pathname}`)
  const headers = new Headers()

  if (configuration.authMode === 'bearer') {
    headers.set('Authorization', `Bearer ${configuration.token}`)
  } else {
    url.searchParams.set('api_key', configuration.token)
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

async function withMetadataCache<T extends MetadataSearchResult[] | MetadataDetails>(
  cacheKey: string,
  loader: () => Promise<T>,
): Promise<T> {
  const inMemory = metadataInMemoryCache.get(cacheKey) as { value: T; expiresAt: number } | undefined

  if (inMemory && inMemory.expiresAt > Date.now()) {
    return inMemory.value
  }

  const persisted = getPersistedMetadataCache<T>(cacheKey)
  if (persisted) {
    metadataInMemoryCache.set(cacheKey, {
      value: persisted,
      expiresAt: Date.now() + metadataCacheTtlMs,
    })
    return persisted
  }

  const inflight = inflightMetadataRequests.get(cacheKey) as Promise<T> | undefined
  if (inflight) {
    return inflight
  }

  const promise = loader()
    .then((value) => {
      const expiresAt = Date.now() + metadataCacheTtlMs
      metadataInMemoryCache.set(cacheKey, { value, expiresAt })
      setPersistedMetadataCache(cacheKey, value, expiresAt)
      return value
    })
    .finally(() => {
      inflightMetadataRequests.delete(cacheKey)
    })

  inflightMetadataRequests.set(cacheKey, promise as Promise<unknown>)
  return promise
}

export async function searchMetadata(query: string, mediaType: MediaType) {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return []
  }

  const cacheKey = `search:${mediaType}:${normalizedQuery.toLowerCase()}`

  return withMetadataCache(cacheKey, async () => {
    const response = await tmdbFetch<TmdbSearchResponse>(`/search/${mediaType}`, {
      query: normalizedQuery,
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

export async function getMetadataDetails(tmdbId: number, mediaType: MediaType) {
  const cacheKey = `details:${mediaType}:${tmdbId}`

  return withMetadataCache(cacheKey, async () => {
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
