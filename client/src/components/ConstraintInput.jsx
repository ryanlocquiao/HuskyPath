import { useState, useRef, useEffect } from 'react'
import './ConstraintInput.css'

const SUGGESTIONS = [
  'No classes before 10am, light Friday',
  'Avoid back-to-back lectures, free afternoons',
  'Morning person — pack classes before noon',
  'No Friday classes, spread M–Th evenly',
  'Light workload, under 15 credits',
  'Maximize time between classes for studying',
]

export default function ConstraintInput({ onSubmit }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const applySuggestion = (s) => {
    setValue(s)
    setActiveSuggestion(s)
    textareaRef.current?.focus()
  }

  const charCount = value.length
  const isReady = value.trim().length > 5

  return (
    <div className="ci-root">
      {/* ── Hero text ── */}
      <div className="ci-hero">
        <h1 className="ci-headline">
          What does your<br />
          <em>ideal quarter</em> look like?
        </h1>
        <p className="ci-sub">
          Describe your schedule preferences in plain English. HuskyPath will
          find your best conflict-free options from live UW course data.
        </p>
      </div>

      {/* ── Input card ── */}
      <div className={`ci-card ${focused ? 'ci-card--focused' : ''}`}>
        <label className="ci-label" htmlFor="constraint-input">
          Your preferences
        </label>
        <textarea
          id="constraint-input"
          ref={textareaRef}
          className="ci-textarea"
          placeholder="e.g. No classes before 10am, keep Fridays free, avoid back-to-back lectures…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          rows={4}
          maxLength={500}
          aria-label="Describe your schedule preferences"
        />
        <div className="ci-card-footer">
          <span className={`ci-char-count ${charCount > 400 ? 'ci-char-count--warn' : ''}`}>
            {charCount}/500
          </span>
          <span className="ci-hint">⌘ + Enter to search</span>
          <button
            className={`ci-submit ${isReady ? 'ci-submit--ready' : ''}`}
            onClick={handleSubmit}
            disabled={!isReady}
            aria-label="Find schedules"
          >
            <span>Find schedules</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Suggestions ── */}
      <div className="ci-suggestions-wrap">
        <p className="ci-suggestions-label">Try an example</p>
        <div className="ci-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className={`ci-chip ${activeSuggestion === s ? 'ci-chip--active' : ''}`}
              onClick={() => applySuggestion(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="ci-how">
        {[
          { icon: '✦', title: 'Natural language', body: 'Write however you think — our NLP parser extracts your constraints automatically.' },
          { icon: '◈', title: 'Live UW data', body: 'Schedules are built from real-time Time Schedule sections, not stale caches.' },
          { icon: '◎', title: 'Ranked results', body: 'Each option is scored on workload balance, gap efficiency, and your preferences.' },
        ].map(({ icon, title, body }) => (
          <div key={title} className="ci-how-card">
            <span className="ci-how-icon">{icon}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
