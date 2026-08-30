/**
 * Local Storage Key Manager for TMDB API Key
 * Stores and retrieves the TMDB API key from localStorage
 */

const STORAGE_KEY = 'tmdb_api_key'
const KEY_VALIDATION_STORAGE_KEY = 'tmdb_key_validated'
const SETUP_SHOWN_KEY = 'tmdb_setup_shown'

/**
 * Get the stored TMDB API key from localStorage
 */
export function getStoredApiKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    return key?.trim() || null
  } catch {
    return null
  }
}

/**
 * Save the TMDB API key to localStorage
 */
export function saveApiKey(key: string): void {
  try {
    const trimmedKey = key.trim()
    if (trimmedKey) {
      localStorage.setItem(STORAGE_KEY, trimmedKey)
      localStorage.setItem(SETUP_SHOWN_KEY, 'true')
      // Clear validation status when new key is saved
      localStorage.removeItem(KEY_VALIDATION_STORAGE_KEY)
    }
  } catch (error) {
    console.error('Failed to save API key to localStorage:', error)
  }
}

/**
 * Clear the stored TMDB API key from localStorage
 */
export function clearApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(KEY_VALIDATION_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear API key:', error)
  }
}

/**
 * Check if there's an API key stored
 */
export function hasApiKey(): boolean {
  return getStoredApiKey() !== null
}

/**
 * Check if the setup modal has been shown before
 */
export function hasSetupBeenShown(): boolean {
  try {
    return localStorage.getItem(SETUP_SHOWN_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Mark setup as shown (called after first setup or skip)
 */
export function markSetupAsShown(): void {
  try {
    localStorage.setItem(SETUP_SHOWN_KEY, 'true')
  } catch (error) {
    console.error('Failed to mark setup as shown:', error)
  }
}

/**
 * Validate the API key by making a test request to TMDB
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey.trim()) {
    return false
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey.trim())}&query=test`
    )
    return response.status === 200
  } catch {
    return false
  }
}

/**
 * Check if the stored key has been validated in this session
 */
export function isKeyValidated(): boolean {
  try {
    return localStorage.getItem(KEY_VALIDATION_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Mark the key as validated for this session
 */
export function markKeyAsValidated(): void {
  try {
    localStorage.setItem(KEY_VALIDATION_STORAGE_KEY, 'true')
  } catch (error) {
    console.error('Failed to mark key as validated:', error)
  }
}
