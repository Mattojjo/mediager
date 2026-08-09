import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { createMovie, deleteMovie, listMovies, updateMovie } from './db.js'
import { fetchMetadata, searchMetadata } from './tmdb.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

const movieSchema = z.object({
  mediaType: z.enum(['movie', 'tv']).optional(),
  title: z.string().trim().min(1, 'Title is required.'),
  year: z.number().int().min(1888).max(2100).nullable().optional(),
  overview: z.string().optional(),
  posterUrl: z.string().url().or(z.literal('')).optional(),
  backdropUrl: z.string().url().or(z.literal('')).optional(),
  trailerUrl: z.string().url().or(z.literal('')).optional(),
  digitalReleaseDate: z.string().date().or(z.literal('')).nullable().optional(),
  providerPageUrl: z.string().url().or(z.literal('')).optional(),
  status: z.enum(['planned', 'released', 'downloaded']).optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  tmdbId: z.number().int().positive().nullable().optional(),
})

app.use(
  cors({
    origin: '*',
  }),
)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/movies', (_request, response) => {
  response.json(listMovies())
})

app.post('/api/movies', (request, response) => {
  const parsed = movieSchema.safeParse(request.body)

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const movie = createMovie(parsed.data)
  response.status(201).json(movie)
})

app.put('/api/movies/:id', (request, response) => {
  const id = Number(request.params.id)
  const parsed = movieSchema.safeParse(request.body)

  if (!Number.isInteger(id)) {
    response.status(400).json({ error: 'Invalid movie id.' })
    return
  }

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const movie = updateMovie(id, parsed.data)

  if (!movie) {
    response.status(404).json({ error: 'Movie not found.' })
    return
  }

  response.json(movie)
})

app.delete('/api/movies/:id', (request, response) => {
  const id = Number(request.params.id)

  if (!Number.isInteger(id)) {
    response.status(400).json({ error: 'Invalid movie id.' })
    return
  }

  const deleted = deleteMovie(id)

  if (!deleted) {
    response.status(404).json({ error: 'Movie not found.' })
    return
  }

  response.status(204).send()
})

app.get('/api/metadata/search', async (request, response) => {
  const query = String(request.query.q ?? '').trim()
  const mediaType = request.query.type === 'tv' ? 'tv' : 'movie'

  if (!query) {
    response.status(400).json({ error: 'Search query is required.' })
    return
  }

  try {
    const results = await searchMetadata(query, mediaType)
    response.json(results)
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : 'Metadata search failed.',
    })
  }
})

app.get('/api/metadata/:mediaType/:tmdbId', async (request, response) => {
  const mediaType = request.params.mediaType === 'tv' ? 'tv' : request.params.mediaType === 'movie' ? 'movie' : null
  const tmdbId = Number(request.params.tmdbId)

  if (!mediaType) {
    response.status(400).json({ error: 'Invalid media type.' })
    return
  }

  if (!Number.isInteger(tmdbId)) {
    response.status(400).json({ error: 'Invalid TMDB id.' })
    return
  }

  try {
    const details = await fetchMetadata(tmdbId, mediaType)
    response.json(details)
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : 'Metadata lookup failed.',
    })
  }
})

app.get('/api/metadata/:tmdbId', async (request, response) => {
  const tmdbId = Number(request.params.tmdbId)

  if (!Number.isInteger(tmdbId)) {
    response.status(400).json({ error: 'Invalid TMDB id.' })
    return
  }

  try {
    const details = await fetchMetadata(tmdbId, 'movie')
    response.json(details)
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : 'Metadata lookup failed.',
    })
  }
})

app.listen(port, () => {
  console.log(`Mediager API listening on http://localhost:${port}`)
})
