import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTmdbConfiguration } from '../src/tmdb.ts'

test('prefers the TMDB read access token when it is configured', () => {
  const config = resolveTmdbConfiguration({
    TMDB_READ_ACCESS_TOKEN: 'read-token',
    TMDB_API_KEY: '',
  } as NodeJS.ProcessEnv)

  assert.equal(config.authMode, 'bearer')
  assert.equal(config.accessToken, 'read-token')
})

test('falls back to the TMDB API key when no access token is present', () => {
  const config = resolveTmdbConfiguration({
    TMDB_READ_ACCESS_TOKEN: '',
    TMDB_API_KEY: 'api-key',
  } as NodeJS.ProcessEnv)

  assert.equal(config.authMode, 'api-key')
  assert.equal(config.apiKey, 'api-key')
})
