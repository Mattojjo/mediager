import { useEffect, useState } from 'react'
import { saveApiKey, validateApiKey, getStoredApiKey, clearApiKey, markSetupAsShown } from './keyManager'
import { clearMovies, listMovies } from './db'
import './Modal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    void getStoredApiKey().then((storedApiKey) => {
      setApiKey(storedApiKey ?? '')
    })
  }, [isOpen])

  if (!isOpen) return null

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
      setSuccessMessage('')

      // Validate the key before saving
      const isValid = await validateApiKey(apiKey)
      if (!isValid) {
        setErrorMessage(
          'Invalid API key. Please check your TMDB API key and try again.'
        )
        return
      }

      await saveApiKey(apiKey)
      setSuccessMessage('API key saved successfully!')
      await markSetupAsShown()
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save API key.'
      )
    } finally {
      setIsSaving(false)
      setIsValidating(false)
    }
  }

  async function handleClearKey() {
    if (window.confirm('Are you sure you want to remove your API key?')) {
      await clearApiKey()
      setApiKey('')
      setErrorMessage('')
      setSuccessMessage('')
    }
  }

  async function handleExportDatabase() {
    try {
      const movies = await listMovies()
      if (!movies.length) {
        setErrorMessage('No database to export.')
        return
      }

      const dataStr = JSON.stringify(movies, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = `mediager-database-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setErrorMessage('')
      setSuccessMessage('Database exported successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch {
      setErrorMessage('Failed to export database.')
    }
  }

  async function handleClearDatabase() {
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete the entire database? This cannot be undone.'
    )

    if (!confirmed) return

    const doubleConfirmed = window.confirm(
      'This will permanently delete all movies and data. Click OK to confirm.'
    )

    if (!doubleConfirmed) return


    try {
      await clearMovies()
      window.location.reload()
    } catch {
      setErrorMessage('Failed to clear database.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSaveKey}>
            <div className="settings-section">
              <h3>TMDB API Key</h3>
              <p className="settings-description">
                Your API key is stored locally in your browser and is never sent to our servers.
              </p>

              <label htmlFor="api-key">API Key</label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your TMDB API key"
                disabled={isSaving}
              />

              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="api-key-link"
              >
                Get your API key from TMDB →
              </a>

              {errorMessage && (
                <div className="message error-message">{errorMessage}</div>
              )}
              {successMessage && (
                <div className="message success-message">{successMessage}</div>
              )}

              <div className="button-group">
                <button
                  type="submit"
                  disabled={isSaving || !apiKey.trim()}
                  className="btn btn-primary"
                >
                  {isValidating ? 'Validating...' : 'Save API Key'}
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    disabled={isSaving}
                    className="btn btn-secondary"
                  >
                    Remove Key
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="settings-section">
            <h3>Database</h3>
            <p className="settings-description">
              Manage your movie database. All data is stored locally in your browser.
            </p>

            <div className="button-group">
              <button
                type="button"
                onClick={handleExportDatabase}
                disabled={isSaving}
                className="btn btn-primary"
              >
                📥 Export Database
              </button>
              <button
                type="button"
                onClick={handleClearDatabase}
                disabled={isSaving}
                className="btn btn-secondary"
              >
                🗑️ Clear Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
