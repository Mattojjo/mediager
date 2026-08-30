import { useState } from 'react'
import { saveApiKey, validateApiKey, getStoredApiKey, clearApiKey, markSetupAsShown } from './keyManager'
import './Modal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated: () => void
}

export function SettingsModal({ isOpen, onClose, onKeyUpdated }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(getStoredApiKey() || '')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isValidating, setIsValidating] = useState(false)

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

      saveApiKey(apiKey)
      setSuccessMessage('API key saved successfully!')
      markSetupAsShown()
      setTimeout(() => {
        onKeyUpdated()
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

  function handleClearKey() {
    if (window.confirm('Are you sure you want to remove your API key?')) {
      clearApiKey()
      setApiKey('')
      setErrorMessage('')
      setSuccessMessage('')
      onKeyUpdated()
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
        </div>
      </div>
    </div>
  )
}
