import { useState, useCallback } from 'react'
import type { Movie, MovieInput, MovieStatus, MetadataSearchResult } from './types'
import * as api from './api'

/**
 * Custom hook for managing movies list and CRUD operations
 */
export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const payload = await api.listMovies()
      setMovies(payload)
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const create = useCallback(async (input: MovieInput) => {
    const created = await api.createMovie(input)
    setMovies((current) => [created, ...current])
    return created
  }, [])

  const update = useCallback(async (id: number, input: MovieInput) => {
    const updated = await api.updateMovie(id, input)
    if (updated) {
      setMovies((current) => current.map((m) => (m.id === updated.id ? updated : m)))
    }
    return updated
  }, [])

  const remove = useCallback(async (id: number) => {
    await api.deleteMovie(id)
    setMovies((current) => current.filter((m) => m.id !== id))
  }, [])

  return { movies, isLoading, load, create, update, remove, setMovies }
}

/**
 * Custom hook for managing editor/form state
 */
export function useEditor(defaultMediaType: 'movie' | 'tv' = 'movie') {
  const [isOpen, setIsOpen] = useState(false)
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null)
  const [form, setForm] = useState<MovieInput>(getEmptyForm(defaultMediaType))
  const [metadataQuery, setMetadataQuery] = useState('')
  const [metadataResults, setMetadataResults] = useState<MetadataSearchResult[]>([])
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)

  const openCreate = useCallback((mediaType: 'movie' | 'tv') => {
    setEditingMovie(null)
    setForm(getEmptyForm(mediaType))
    setMetadataQuery('')
    setMetadataResults([])
    setShowAdvancedFields(false)
    setIsOpen(true)
  }, [])

  const openEdit = useCallback((movie: Movie) => {
    setEditingMovie(movie)
    setForm(movieToForm(movie))
    setMetadataQuery(movie.title)
    setMetadataResults([])
    setShowAdvancedFields(true)
    setIsOpen(true)
  }, [])

  const close = useCallback((mediaType: 'movie' | 'tv' = defaultMediaType) => {
    setIsOpen(false)
    setEditingMovie(null)
    setForm(getEmptyForm(mediaType))
    setMetadataResults([])
    setMetadataQuery('')
    setShowAdvancedFields(false)
  }, [defaultMediaType])

  return {
    isOpen,
    editingMovie,
    form,
    metadataQuery,
    metadataResults,
    showAdvancedFields,
    setForm,
    setMetadataQuery,
    setMetadataResults,
    setShowAdvancedFields,
    openCreate,
    openEdit,
    close,
  }
}

/**
 * Custom hook for managing UI state (filters, search, etc)
 */
export function useUiState() {
  const [activeMediaType, setActiveMediaType] = useState<'movie' | 'tv'>('movie')
  const [filter, setFilter] = useState<'all' | MovieStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [sortMode, setSortMode] = useState<'release' | 'recent' | 'priority'>('release')
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)

  return {
    activeMediaType,
    setActiveMediaType,
    filter,
    setFilter,
    searchText,
    setSearchText,
    sortMode,
    setSortMode,
    selectedMovie,
    setSelectedMovie,
  }
}

/**
 * Custom hook for managing loading and error states
 */
export function useAsyncState() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingMetadata, setIsSearchingMetadata] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const clearMessages = useCallback(() => {
    setStatusMessage('')
    setErrorMessage('')
  }, [])

  return {
    isSaving,
    setIsSaving,
    isSearchingMetadata,
    setIsSearchingMetadata,
    isDeleting,
    setIsDeleting,
    statusMessage,
    setStatusMessage,
    errorMessage,
    setErrorMessage,
    clearMessages,
  }
}

// Helper functions
export function getEmptyForm(mediaType: 'movie' | 'tv' = 'movie'): MovieInput {
  return {
    mediaType,
    title: '',
    year: null,
    overview: '',
    posterUrl: '',
    backdropUrl: '',
    trailerUrl: '',
    digitalReleaseDate: null,
    providerPageUrl: '',
    status: 'planned',
    notes: '',
    priority: 2,
    tmdbId: null,
  }
}

export function movieToForm(movie: Movie): MovieInput {
  return {
    mediaType: movie.mediaType,
    title: movie.title,
    year: movie.year,
    overview: movie.overview,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    trailerUrl: movie.trailerUrl,
    digitalReleaseDate: movie.digitalReleaseDate,
    providerPageUrl: movie.providerPageUrl,
    status: movie.status,
    notes: movie.notes,
    priority: movie.priority,
    tmdbId: movie.tmdbId,
  }
}

export function normalizeQuickAddQuery(value: string): string {
  const trimmedValue = value.trim()

  if (!trimmedValue) return ''
  if (!isLikelyUrl(trimmedValue)) return trimmedValue

  try {
    const url = new URL(trimmedValue)
    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    return humanizeSlug(lastSegment.replace(/-\d{4}$/, ''))
  } catch {
    return trimmedValue
  }
}

export function humanizeSlug(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export function buildSubmissionForm(form: MovieInput, metadataQuery: string): MovieInput {
  const inferredTitle = normalizeQuickAddQuery(metadataQuery)

  return {
    ...form,
    title: form.title.trim() || inferredTitle,
    providerPageUrl: form.providerPageUrl.trim(),
    overview: form.overview.trim(),
    posterUrl: form.posterUrl.trim(),
    backdropUrl: form.backdropUrl.trim(),
    trailerUrl: form.trailerUrl.trim(),
    notes: form.notes.trim(),
  }
}

export function toEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url
    }
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`
    }
    return url
  } catch {
    return url
  }
}