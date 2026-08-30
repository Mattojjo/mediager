import { useEffect, useMemo, useState } from 'react'
import {
  createMovie,
  deleteMovie,
  getMetadataDetails,
  listMovies,
  searchMetadata,
  updateMovie,
} from './api'
import type { MediaType, MetadataSearchResult, Movie, MovieInput, MovieStatus } from './types'
import { hasApiKey, hasSetupBeenShown } from './keyManager'
import { SettingsModal } from './SettingsModal'
import { ApiKeySetup } from './ApiKeySetup'

const emptyForm: MovieInput = {
  mediaType: 'movie',
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
  priority: 1,
  tmdbId: null,
}

function App() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [form, setForm] = useState<MovieInput>(emptyForm)
  const [activeMediaType, setActiveMediaType] = useState<MediaType>('movie')
  const [searchText, setSearchText] = useState('')
  const [metadataQuery, setMetadataQuery] = useState('')
  const [metadataResults, setMetadataResults] = useState<MetadataSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingMetadata, setIsSearchingMetadata] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showApiKeySetup, setShowApiKeySetup] = useState(false)

  const isAutoCreatingFromMetadata = isSaving && !editingMovie

  useEffect(() => {
    void loadMovies()
    void loadApiKeySetupState()
  }, [])

  async function loadApiKeySetupState() {
    const [hasKey, hasSeenSetup] = await Promise.all([
      hasApiKey(),
      hasSetupBeenShown(),
    ])
    setShowApiKeySetup(!hasKey && !hasSeenSetup)
  }

  const visibleMovies = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return [...movies]
      .filter((movie) => movie.mediaType === activeMediaType)
      .filter((movie) => {
        if (!query) {
          return true
        }

        return [movie.title, movie.overview, movie.notes].some((value) =>
          value.toLowerCase().includes(query),
        )
      })
  }, [activeMediaType, movies, searchText])

  async function loadMovies() {
    try {
      setIsLoading(true)
      setStatusMessage('Loading your queue...')
      setErrorMessage('')
      const payload = await listMovies()
      setMovies(payload)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entries.')
    } finally {
      setIsLoading(false)
      setStatusMessage('')
    }
  }

  function openCreateDialog(mediaType: MediaType) {
    setEditingMovie(null)
    setForm({
      ...emptyForm,
      mediaType,
    })
    setMetadataQuery('')
    setMetadataResults([])
    setShowAdvancedFields(false)
    setErrorMessage('')
    setIsEditorOpen(true)
  }

  function openEditDialog(movie: Movie) {
    setEditingMovie(movie)
    setSelectedMovie(movie)
    setForm({
      mediaType: movie.mediaType,
      title: movie.title,
      year: movie.year,
      overview: movie.overview,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      trailerUrl: movie.trailerUrl,
      digitalReleaseDate: movie.digitalReleaseDate,
      providerPageUrl: '',
      status: movie.status,
      notes: movie.notes,
      priority: 1,
      tmdbId: movie.tmdbId,
    })
    setMetadataQuery(movie.title)
    setMetadataResults([])
    setShowAdvancedFields(true)
    setErrorMessage('')
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setIsEditorOpen(false)
    setEditingMovie(null)
    setForm({
      ...emptyForm,
      mediaType: activeMediaType,
    })
    setMetadataResults([])
    setMetadataQuery('')
    setShowAdvancedFields(false)
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalized = buildSubmissionForm(form, metadataQuery)

    if (!normalized.title) {
      setErrorMessage('Add a title or paste a link that contains one.')
      return
    }

    try {
      setIsSaving(true)
      setStatusMessage(editingMovie ? 'Saving changes...' : 'Creating entry...')
      setErrorMessage('')

      if (editingMovie) {
        const updated = await updateMovie(editingMovie.id, normalized)
        if (!updated) {
          setErrorMessage('Failed to update entry.')
          return
        }
        setMovies((current) => current.map((movie) => (movie.id === updated.id ? updated : movie)))
        setSelectedMovie(updated)
      } else {
        const created = await createMovie(normalized)
        if (!created) {
          setErrorMessage('Failed to create entry.')
          return
        }
        setMovies((current) => [created, ...current])
        setSelectedMovie(created)
      }

      closeEditor()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save entry.')
    } finally {
      setIsSaving(false)
      setStatusMessage('')
    }
  }

  async function removeMovie(movie: Movie) {
    const confirmed = window.confirm(`Delete ${movie.title} from your queue?`)

    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      setStatusMessage('Deleting entry...')
      setErrorMessage('')
      await deleteMovie(movie.id)
      setMovies((current) => current.filter((entry) => entry.id !== movie.id))
      if (selectedMovie?.id === movie.id) {
        setSelectedMovie(null)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete entry.')
    } finally {
      setIsDeleting(false)
      setStatusMessage('')
    }
  }

  async function runMetadataSearch() {
    const normalizedQuery = normalizeQuickAddQuery(metadataQuery)

    if (!normalizedQuery) {
      return
    }

    try {
      setIsSearchingMetadata(true)
      setStatusMessage('Searching TMDB...')
      setErrorMessage('')
      const results = await searchMetadata(normalizedQuery, form.mediaType)
      setMetadataResults(results)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Metadata search is unavailable. Manual entry still works.',
      )
    } finally {
      setIsSearchingMetadata(false)
      setStatusMessage('')
    }
  }

  async function applyMetadata(result: MetadataSearchResult) {
    try {
      setIsSearchingMetadata(true)
      setStatusMessage('Applying metadata...')
      setErrorMessage('')
      const details = await getMetadataDetails(result.tmdbId, form.mediaType)
      const nextForm = buildSubmissionForm(
        {
          ...form,
          title: details.title,
          year: details.year,
          overview: details.overview,
          posterUrl: details.posterUrl,
          backdropUrl: details.backdropUrl,
          trailerUrl: details.trailerUrl,
          digitalReleaseDate: details.digitalReleaseDate,
          tmdbId: details.tmdbId,
        },
        `${details.title}${details.year ? ` ${details.year}` : ''}`,
      )

      setForm((current) => ({
        ...current,
        title: details.title,
        year: details.year,
        overview: details.overview,
        posterUrl: details.posterUrl,
        backdropUrl: details.backdropUrl,
        trailerUrl: details.trailerUrl,
        digitalReleaseDate: details.digitalReleaseDate,
        tmdbId: details.tmdbId,
      }))
      setMetadataQuery(`${details.title}${details.year ? ` ${details.year}` : ''}`)

      if (!editingMovie) {
        setIsSaving(true)
        const created = await createMovie(nextForm)
        setMovies((current) => [created, ...current])
        setSelectedMovie(created)
        closeEditor()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to apply metadata.')
    } finally {
      setIsSaving(false)
      setIsSearchingMetadata(false)
      setStatusMessage('')
    }
  }

  function handleQuickAddInput(value: string) {
    setMetadataQuery(value)

    const trimmedValue = value.trim()
    const looksLikeUrl = isLikelyUrl(trimmedValue)
    const inferredTitle = trimmedValue ? normalizeQuickAddQuery(trimmedValue) : ''

    setForm((current) => ({
      ...current,
      title: current.title || (!looksLikeUrl ? trimmedValue : inferredTitle),
    }))
  }

  function handleQuickAddDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const droppedText = event.dataTransfer.getData('text/plain').trim()

    if (!droppedText) {
      return
    }

    handleQuickAddInput(droppedText)
  }

  function getMovieDestination(movie: Movie) {
    if (!movie.tmdbId) {
      return ''
    }

    return `https://www.themoviedb.org/${movie.mediaType}/${movie.tmdbId}`
  }

  function getDownloadDestination(movie: Movie) {
    const normalizedTitle = movie.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    if (!normalizedTitle) {
      return ''
    }

    const year = movie.year ?? new Date().getFullYear()
    return `https://yts.proxyninja.org/movies/${normalizedTitle}-${year}`
  }

  const queuedCount = movies.filter((movie) => movie.mediaType === activeMediaType).length

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="top-bar">
          <div className={`media-switch ${activeMediaType === 'tv' ? 'is-tv' : 'is-movie'}`}>
            <button
              type="button"
              className={`media-switch__option ${activeMediaType === 'movie' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveMediaType('movie')
                if (!isEditorOpen) {
                  setForm((current) => ({ ...current, mediaType: 'movie' }))
                }
              }}
            >
              Movies
            </button>
            <button
              type="button"
              className={`media-switch__option ${activeMediaType === 'tv' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveMediaType('tv')
                if (!isEditorOpen) {
                  setForm((current) => ({ ...current, mediaType: 'tv' }))
                }
              }}
            >
              TV Shows
            </button>
          </div>

          <div className="top-bar__stats">
            <div className="stat-chip">
              <span>{activeMediaType === 'movie' ? 'Movies' : 'Shows'}</span>
              <strong>{queuedCount}</strong>
            </div>
          </div>

          <div className="top-bar__actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsSettingsOpen(true)}
              disabled={isLoading || isSaving || isSearchingMetadata || isDeleting}
              title="Settings"
            >
              Settings
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => openCreateDialog('movie')}
              disabled={isLoading || isSaving || isSearchingMetadata || isDeleting}
            >
              Add movie
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => openCreateDialog('tv')}
              disabled={isLoading || isSaving || isSearchingMetadata || isDeleting}
            >
              Add TV show
            </button>
          </div>
        </div>
      </header>

      <section className="toolbar">
        <label className="search-field">
          <span>Search queue</span>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Filter by title, overview, or notes"
          />
        </label>
      </section>

      {errorMessage && !isEditorOpen ? <p className="banner error">{errorMessage}</p> : null}

      {isLoading ? (
        <section className="empty-state">
          <div className="loading-state-card">
            <span className="loading-spinner large" />
            <h2>Loading your queue</h2>
            <p>Pulling the latest entries from your local library.</p>
          </div>
        </section>
      ) : visibleMovies.length === 0 ? (
        <section className="empty-state">
          <h2>Your queue is empty</h2>
          <p>
            Add a {activeMediaType === 'movie' ? 'movie' : 'show'} manually or enrich it
            with TMDB metadata to start building a clean download queue.
          </p>
          <button type="button" className="primary-button" onClick={() => openCreateDialog(activeMediaType)}>
            Create first entry
          </button>
        </section>
      ) : (
        <section className="movie-grid">
          {visibleMovies.map((movie) => (
            <article
              key={movie.id}
              className="movie-card"
              onClick={() => setSelectedMovie(movie)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedMovie(movie)
                }
              }}
            >
              <div
                className="poster-frame"
                style={movie.posterUrl ? { backgroundImage: `url(${movie.posterUrl})` } : undefined}
              >
                {!movie.posterUrl ? <span className="poster-fallback">{movie.title}</span> : null}
                <span className={`status-pill ${movie.status}`}>{movie.status}</span>
              </div>
              <div className="movie-card-copy">
                <div>
                  <h3>
                    {movie.title}
                    {movie.year ? ` (${movie.year})` : ''}
                  </h3>
                  <p>{movie.overview || 'No overview yet.'}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedMovie ? (
        <div className="modal-scrim details-scrim" onClick={() => setSelectedMovie(null)}>
          <aside className="details-panel details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="details-backdrop">
            <div
              className="backdrop-art"
              style={
                selectedMovie.backdropUrl
                  ? { backgroundImage: `linear-gradient(180deg, rgba(10,12,17,.15), rgba(10,12,17,.9)), url(${selectedMovie.backdropUrl})` }
                  : undefined
              }
            >
              <button
                type="button"
                className="ghost-button close-button"
                onClick={() => setSelectedMovie(null)}
              >
                Close
              </button>
            </div>
            </div>
            <div className="details-content">
              <div className="details-header">
                <div>
                  <p className="eyebrow">{selectedMovie.status}</p>
                  <h2>
                    {selectedMovie.title}
                    {selectedMovie.year ? ` (${selectedMovie.year})` : ''}
                  </h2>
                </div>
                <div className="details-actions">
                  <button type="button" className="ghost-button" onClick={() => openEditDialog(selectedMovie)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => void removeMovie(selectedMovie)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                  <a
                    className={`primary-button ${getDownloadDestination(selectedMovie) ? '' : 'disabled-link'}`}
                    href={getDownloadDestination(selectedMovie) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!getDownloadDestination(selectedMovie)) {
                        event.preventDefault()
                      }
                    }}
                  >
                    Download
                  </a>
                  <a
                    className={`ghost-button ${getMovieDestination(selectedMovie) ? '' : 'disabled-link'}`}
                    href={getMovieDestination(selectedMovie) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!getMovieDestination(selectedMovie)) {
                        event.preventDefault()
                      }
                    }}
                  >
                    Source page
                  </a>
                </div>
              </div>

              <div className="details-grid">
                <div className="details-summary">
                  <p>{selectedMovie.overview || 'Add notes or metadata to describe this entry.'}</p>
                  <div className="notes-block">
                    <h3>Notes</h3>
                    <p>{selectedMovie.notes || 'No notes yet.'}</p>
                  </div>
                </div>

                <div className="trailer-panel">
                  {selectedMovie.trailerUrl ? (
                    <iframe
                      title={`${selectedMovie.title} trailer`}
                      src={toEmbedUrl(selectedMovie.trailerUrl)}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="trailer-empty">
                      <h3>No trailer yet</h3>
                      <p>Search TMDB metadata or paste a trailer URL to watch it here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isEditorOpen ? (
        <div className="modal-scrim" onClick={closeEditor}>
          <section className="editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="editor-header">
              <div>
                <p className="eyebrow">{editingMovie ? 'Update entry' : `New ${form.mediaType === 'movie' ? 'movie' : 'TV show'}`}</p>
                <h2>
                  {editingMovie
                    ? `Edit ${form.mediaType === 'movie' ? 'movie' : 'TV show'}`
                    : `Add a new ${form.mediaType === 'movie' ? 'movie' : 'TV show'}`}
                </h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeEditor}>
                Close
              </button>
            </div>

            {statusMessage ? (
              <div className="loading-indicator" role="status" aria-live="polite">
                <span className="loading-spinner" />
                <span>{statusMessage}</span>
              </div>
            ) : null}

            {errorMessage ? <p className="banner error">{errorMessage}</p> : null}

            <div
              className="metadata-search-box quick-add-box"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleQuickAddDrop}
            >
              <div>
                <label>
                  <span>{form.mediaType === 'movie' ? 'Movie name or provider link' : 'TV show name or provider link'}</span>
                  <input
                    value={metadataQuery}
                    onChange={(event) => handleQuickAddInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void runMetadataSearch()
                      }
                    }}
                    placeholder={
                      form.mediaType === 'movie'
                        ? 'Type a title like Inception or paste a movie page URL'
                        : 'Type a title like Severance or paste a show page URL'
                    }
                  />
                </label>
                <p className="helper-copy">
                  Type the {form.mediaType === 'movie' ? 'movie' : 'show'} name to search TMDB, or paste/drop a provider page URL and the title will be inferred when possible.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void runMetadataSearch()}
                disabled={isSearchingMetadata || isAutoCreatingFromMetadata}
              >
                {isSearchingMetadata ? 'Searching...' : 'Search database'}
              </button>
            </div>

            {metadataResults.length > 0 ? (
              <div className="metadata-results">
                {metadataResults.map((result, index) => (
                  <button
                    key={`${result.tmdbId}-${index}`}
                    type="button"
                    className="metadata-result"
                    onClick={() => void applyMetadata(result)}
                    disabled={isAutoCreatingFromMetadata || isSearchingMetadata || isDeleting}
                  >
                    <div
                      className="metadata-result-poster"
                      style={result.posterUrl ? { backgroundImage: `url(${result.posterUrl})` } : undefined}
                    />
                    <div>
                      <strong>
                        {result.title}
                        {result.year ? ` (${result.year})` : ''}
                      </strong>
                      <p>{result.overview || 'No overview provided.'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <form className="editor-form" onSubmit={submitForm}>
              <label>
                <span>Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as MovieStatus }))
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="released">Released</option>
                  <option value="downloaded">Downloaded</option>
                </select>
              </label>

              <div className="full-span">
                <button
                  type="button"
                  className="ghost-button advanced-toggle"
                  onClick={() => setShowAdvancedFields((current) => !current)}
                >
                  {showAdvancedFields ? 'Hide advanced fields' : 'Show advanced fields'}
                </button>
              </div>

              {showAdvancedFields ? (
                <>
                  <label>
                    <span>Year</span>
                    <input
                      type="number"
                      min="1888"
                      max="2100"
                      value={form.year ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          year: event.target.value ? Number(event.target.value) : null,
                        }))
                      }
                    />
                  </label>

                  <label className="full-span">
                    <span>Overview</span>
                    <textarea
                      rows={4}
                      value={form.overview}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, overview: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Poster URL</span>
                    <input
                      value={form.posterUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, posterUrl: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Backdrop URL</span>
                    <input
                      value={form.backdropUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, backdropUrl: event.target.value }))
                      }
                    />
                  </label>

                  <label className="full-span">
                    <span>Trailer URL</span>
                    <input
                      value={form.trailerUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, trailerUrl: event.target.value }))
                      }
                    />
                  </label>
                </>
              ) : null}

              <label className="full-span">
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <div className="form-actions full-span">
                <button type="button" className="ghost-button" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSaving || isSearchingMetadata || isDeleting}>
                  {isSaving
                    ? isAutoCreatingFromMetadata
                      ? 'Adding from TMDB...'
                      : 'Saving...'
                    : editingMovie
                      ? 'Save changes'
                      : `Create ${form.mediaType === 'movie' ? 'movie' : 'TV show'}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {showApiKeySetup && (
        <ApiKeySetup
          onComplete={() => {
            setShowApiKeySetup(false)
          }}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

function buildSubmissionForm(form: MovieInput, metadataQuery: string): MovieInput {
  const inferredTitle = normalizeQuickAddQuery(metadataQuery)

  return {
    ...form,
    title: form.title.trim() || inferredTitle,
    providerPageUrl: '',
    overview: form.overview.trim(),
    posterUrl: form.posterUrl.trim(),
    backdropUrl: form.backdropUrl.trim(),
    trailerUrl: form.trailerUrl.trim(),
    notes: form.notes.trim(),
  }
}

function normalizeQuickAddQuery(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (!isLikelyUrl(trimmedValue)) {
    return trimmedValue
  }

  try {
    const url = new URL(trimmedValue)
    const lastSegment = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    return humanizeSlug(lastSegment.replace(/-\d{4}$/, ''))
  } catch {
    return trimmedValue
  }
}

function humanizeSlug(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function isLikelyUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function toEmbedUrl(url: string) {
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

export default App
