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

const DATABASE_NAME = 'mediager'
const DATABASE_VERSION = 2
const MOVIES_STORE = 'movies'
const SETTINGS_STORE = 'settings'

export interface SettingRecord {
  key: string
  value: string | boolean
}

let databasePromise: Promise<IDBDatabase> | undefined

function getDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MOVIES_STORE)) {
        request.result.createObjectStore(MOVIES_STORE, { keyPath: 'id' })
      }
      if (!request.result.objectStoreNames.contains(SETTINGS_STORE)) {
        request.result.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open database.'))
  })

  return databasePromise
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Database operation failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Database operation was aborted.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Database operation failed.'))
  })
}

export async function listMovies(): Promise<MovieRecord[]> {
  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readonly')
  const movies = await requestResult(transaction.objectStore(MOVIES_STORE).getAll())
  return movies
    .filter((movie) => movie.id > 0)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

export async function getMovie(id: number): Promise<MovieRecord | undefined> {
  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readonly')
  const movie = await requestResult(transaction.objectStore(MOVIES_STORE).get(id))
  return movie ?? undefined
}

export async function createMovie(input: MovieInput): Promise<MovieRecord> {
  const movies = await listMovies()
  const nextId = movies.reduce((max, movie) => Math.max(max, movie.id), 0) + 1
  const now = new Date().toISOString()
  const movie: MovieRecord = {
    id: nextId,
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
    createdAt: now,
    updatedAt: now,
  }

  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readwrite')
  transaction.objectStore(MOVIES_STORE).add(movie)
  await waitForTransaction(transaction)
  return movie
}

export async function updateMovie(id: number, input: MovieInput): Promise<MovieRecord | undefined> {
  const existing = await getMovie(id)
  if (!existing) return undefined

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

  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readwrite')
  transaction.objectStore(MOVIES_STORE).put(updated)
  await waitForTransaction(transaction)
  return updated
}

export async function deleteMovie(id: number): Promise<boolean> {
  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readwrite')
  transaction.objectStore(MOVIES_STORE).delete(id)
  await waitForTransaction(transaction)
  return true
}

export async function clearMovies(): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(MOVIES_STORE, 'readwrite')
  transaction.objectStore(MOVIES_STORE).clear()
  await waitForTransaction(transaction)
}

export async function getSetting(key: string): Promise<string | boolean | undefined> {
  const database = await getDatabase()
  const transaction = database.transaction(SETTINGS_STORE, 'readonly')
  const record = await requestResult(transaction.objectStore(SETTINGS_STORE).get(key)) as SettingRecord | undefined
  return record?.value
}

export async function setSetting(key: string, value: string | boolean): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(SETTINGS_STORE, 'readwrite')
  transaction.objectStore(SETTINGS_STORE).put({ key, value } satisfies SettingRecord)
  await waitForTransaction(transaction)
}

export async function deleteSetting(key: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(SETTINGS_STORE, 'readwrite')
  transaction.objectStore(SETTINGS_STORE).delete(key)
  await waitForTransaction(transaction)
}