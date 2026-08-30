import { useState } from 'react'
import { saveApiKey, validateApiKey, markSetupAsShown } from './keyManager'
import './Modal.css'

interface ApiKeySetupProps {
  onComplete: () => void
}

export function ApiKeySetup({ onComplete }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()

    if (!apiKey.trim()) {
      setErrorMessage('API key cannot be empty.')
      return
    }

    try {
      setIsSaving(true)
      setIsValidating(true)
      setErrorMessage('')

      // Validate the key before saving
      const isValid = await validateApiKey(apiKey)
      if (!isValid) {
        setErrorMessage(
          'Invalid API key. Please check your TMDB API key and try again.'
        )
        return
      }

      await saveApiKey(apiKey)
      onComplete()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save API key.'
      )
    } finally {
      setIsSaving(false)
      setIsValidating(false)
    }
  }

  async function handleSkip() {
    await markSetupAsShown()
    onComplete()
  }

  return (
    <div className="modal-overlay modal-overlay-blocking">
      <div className="modal-content modal-content-setup">
        <div className="setup-header">
          <h1>Welcome to Mediager</h1>
          <p>Let's get your TMDB API key set up</p>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSaveKey}>
            <div className="settings-section">
              <p className="setup-description">
                To search and fetch movie information from The Movie Database (TMDB), you'll need an API key.
              </p>

              <p className="setup-description">
                Your API key will be stored <strong>only in your browser's local database</strong> and never sent to external servers (except to TMDB when searching).
              </p>

              <label htmlFor="setup-api-key">TMDB API Key</label>
              <input
                id="setup-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your TMDB API key"
                disabled={isSaving}
                autoFocus
              />

              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="api-key-link"
              >
                Don't have an API key? Get one for free →
              </a>

              {errorMessage && (
                <div className="message error-message">{errorMessage}</div>
              )}

              <div className="button-group">
                <button
                  type="submit"
                  disabled={isSaving || !apiKey.trim()}
                  className="btn btn-primary"
                >
                  {isValidating ? 'Validating...' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={isSaving}
                  className="btn btn-secondary"
                >
                  Skip for now
                </button>
              </div>

              <p className="setup-note">
                Note: You can add or change your API key later in Settings.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
