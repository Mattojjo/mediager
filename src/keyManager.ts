import { deleteSetting, getSetting, setSetting } from './db'

const API_KEY = 'tmdb_api_key'
const SETUP_SHOWN = 'tmdb_setup_shown'

export async function getStoredApiKey(): Promise<string | null> {
  const value = await getSetting(API_KEY)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function saveApiKey(key: string): Promise<void> {
  const trimmedKey = key.trim()
  if (!trimmedKey) return

  await Promise.all([
    setSetting(API_KEY, trimmedKey),
    setSetting(SETUP_SHOWN, true),
  ])
}

export async function clearApiKey(): Promise<void> {
  await deleteSetting(API_KEY)
}

export async function hasApiKey(): Promise<boolean> {
  return (await getStoredApiKey()) !== null
}

export async function hasSetupBeenShown(): Promise<boolean> {
  return (await getSetting(SETUP_SHOWN)) === true
}

export async function markSetupAsShown(): Promise<void> {
  await setSetting(SETUP_SHOWN, true)
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) return false

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey.trim())}&query=test`,
    )
    return response.status === 200
  } catch {
    return false
  }
}
