import { useEffect, useMemo, useState } from 'react'
import {
  createMovie,
  deleteMovie,
  getMetadataDetails,
  listMovies,
  searchMetadata,
  updateMovie,
} from './api'
import type { MetadataSearchResult, Movie, MovieInput, MovieStatus } from './types'

const emptyForm: MovieInput = {
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

function App() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [form, setForm] = useState<MovieInput>(emptyForm)
  const [filter, setFilter] = useState<'all' | MovieStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [sortMode, setSortMode] = useState<'release' | 'recent' | 'priority'>('release')
  const [metadataQuery, setMetadataQuery] = useState('')
  const [metadataResults, setMetadataResults] = useState<MetadataSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingMetadata, setIsSearchingMetadata] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void loadMovies()
  }, [])

  const visibleMovies = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return [...movies]
      .filter((movie) => (filter === 'all' ? true : movie.status === filter))
      .filter((movie) => {
        if (!query) {
          return true
        }

        return [movie.title, movie.overview, movie.notes].some((value) =>
          value.toLowerCase().includes(query),
        )
      })
      .sort((left, right) => {
        if (sortMode === 'priority') {
          return right.priority - left.priority || left.title.localeCompare(right.title)
        }

        if (sortMode === 'recent') {
          return right.updatedAt.localeCompare(left.updatedAt)
        }

        return (left.digitalReleaseDate ?? '9999-99-99').localeCompare(
          right.digitalReleaseDate ?? '9999-99-99',
        )
      })
  }, [filter, movies, searchText, sortMode])

  async function loadMovies() {
    try {
      setIsLoading(true)
      setErrorMessage('')
      const payload = await listMovies()
      setMovies(payload)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load movies.')
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingMovie(null)
    setForm(emptyForm)
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
    setForm(emptyForm)
    setMetadataResults([])
    setMetadataQuery('')
    setShowAdvancedFields(false)
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalized = buildSubmissionForm(form, metadataQuery)

    if (!normalized.title) {
      setErrorMessage('Add a movie title or paste a link that contains one.')
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage('')

      if (editingMovie) {
        const updated = await updateMovie(editingMovie.id, normalized)
        setMovies((current) => current.map((movie) => (movie.id === updated.id ? updated : movie)))
        setSelectedMovie(updated)
      } else {
        const created = await createMovie(normalized)
        setMovies((current) => [created, ...current])
        setSelectedMovie(created)
      }

      closeEditor()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save movie.')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeMovie(movie: Movie) {
    const confirmed = window.confirm(`Delete ${movie.title} from your queue?`)

    if (!confirmed) {
      return
    }

    try {
      setErrorMessage('')
      await deleteMovie(movie.id)
      setMovies((current) => current.filter((entry) => entry.id !== movie.id))
      if (selectedMovie?.id === movie.id) {
        setSelectedMovie(null)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete movie.')
    }
  }

  async function runMetadataSearch() {
    const normalizedQuery = normalizeQuickAddQuery(metadataQuery)

    if (!normalizedQuery) {
      return
    }

    try {
      setIsSearchingMetadata(true)
      setErrorMessage('')
      const results = await searchMetadata(normalizedQuery)
      setMetadataResults(results)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Metadata search is unavailable. Manual entry still works.',
      )
    } finally {
      setIsSearchingMetadata(false)
    }
  }

  async function applyMetadata(result: MetadataSearchResult) {
    try {
      setIsSearchingMetadata(true)
      setErrorMessage('')
      const details = await getMetadataDetails(result.tmdbId)
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to apply metadata.')
    } finally {
      setIsSearchingMetadata(false)
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
      providerPageUrl: looksLikeUrl ? trimmedValue : current.providerPageUrl,
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

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Personal media queue</p>
          <h1>Mediager</h1>
          <p className="hero-copy">
            Track movies before they hit digital release, keep the trailer close,
            and jump straight to the page you use when it is time to download.
          </p>
        </div>
        <div className="hero-actions">
          <div className="stat-card">
            <span className="stat-label">Movies queued</span>
            <strong>{movies.length}</strong>
          </div>
          <div className="stat-card accent">
            <span className="stat-label">Released now</span>
            <strong>
              {
                movies.filter(
                  (movie) => movie.digitalReleaseDate && movie.digitalReleaseDate <= today(),
                ).length
              }
            </strong>
          </div>
          <button type="button" className="primary-button" onClick={openCreateDialog}>
            Add movie
          </button>
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

        <label>
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | MovieStatus)}>
            <option value="all">All</option>
            <option value="planned">Planned</option>
            <option value="released">Released</option>
            <option value="downloaded">Downloaded</option>
          </select>
        </label>

        <label>
          <span>Sort by</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as 'release' | 'recent' | 'priority')}>
            <option value="release">Release date</option>
            <option value="recent">Recently updated</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </section>

      {errorMessage ? <p className="banner error">{errorMessage}</p> : null}

      {isLoading ? (
        <section className="empty-state">
          <h2>Loading your queue</h2>
          <p>Pulling the latest movies from your local library.</p>
        </section>
      ) : visibleMovies.length === 0 ? (
        <section className="empty-state">
          <h2>Your queue is empty</h2>
          <p>
            Add a movie manually or enrich it with TMDB metadata to start building a
            clean download queue.
          </p>
          <button type="button" className="primary-button" onClick={openCreateDialog}>
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
                <div className="movie-card-meta">
                  <span>{formatRelease(movie.digitalReleaseDate)}</span>
                  <span>Priority {movie.priority}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedMovie ? (
        <aside className="details-panel">
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
                <button type="button" className="ghost-button danger" onClick={() => void removeMovie(selectedMovie)}>
                  Delete
                </button>
                <a
                  className={`primary-button ${selectedMovie.providerPageUrl ? '' : 'disabled-link'}`}
                  href={selectedMovie.providerPageUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!selectedMovie.providerPageUrl) {
                      event.preventDefault()
                    }
                  }}
                >
                  Download page
                </a>
              </div>
            </div>

            <div className="details-grid">
              <div className="details-summary">
                <p>{selectedMovie.overview || 'Add notes or metadata to describe this entry.'}</p>
                <dl>
                  <div>
                    <dt>Digital release</dt>
                    <dd>{formatRelease(selectedMovie.digitalReleaseDate)}</dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd>{selectedMovie.priority}</dd>
                  </div>
                  <div>
                    <dt>Provider page</dt>
                    <dd>{selectedMovie.providerPageUrl || 'Not added yet'}</dd>
                  </div>
                </dl>
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
      ) : null}

      {isEditorOpen ? (
        <div className="modal-scrim" onClick={closeEditor}>
          <section className="editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="editor-header">
              <div>
                <p className="eyebrow">{editingMovie ? 'Update entry' : 'New movie'}</p>
                <h2>{editingMovie ? 'Edit movie' : 'Add a new movie'}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeEditor}>
                Close
              </button>
            </div>

            <div
              className="metadata-search-box quick-add-box"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleQuickAddDrop}
            >
              <div>
                <label>
                  <span>Movie name or provider link</span>
                  <input
                    value={metadataQuery}
                    onChange={(event) => handleQuickAddInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void runMetadataSearch()
                      }
                    }}
                    placeholder="Type a title like Inception or paste a movie page URL"
                  />
                </label>
                <p className="helper-copy">
                  Type the movie name to search TMDB, or paste/drop a provider page URL and the title will be inferred when possible.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void runMetadataSearch()}
                disabled={isSearchingMetadata}
              >
                {isSearchingMetadata ? 'Searching...' : 'Search database'}
              </button>
            </div>

            {metadataResults.length > 0 ? (
              <div className="metadata-results">
                {metadataResults.map((result) => (
                  <button
                    key={result.tmdbId}
                    type="button"
                    className="metadata-result"
                    onClick={() => void applyMetadata(result)}
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
                <span>Download page URL</span>
                <input
                  placeholder="https://example.com/movies/title-2026"
                  value={form.providerPageUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, providerPageUrl: event.target.value }))
                  }
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

              <label>
                <span>Priority</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: Number(event.target.value) || 1 }))
                  }
                />
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

                  <label>
                    <span>Digital release date</span>
                    <input
                      type="date"
                      value={form.digitalReleaseDate ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          digitalReleaseDate: event.target.value || null,
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
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingMovie ? 'Save changes' : 'Create movie'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function buildSubmissionForm(form: MovieInput, metadataQuery: string): MovieInput {
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

function formatRelease(date: string | null) {
  if (!date) {
    return 'Release date not set'
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default App
