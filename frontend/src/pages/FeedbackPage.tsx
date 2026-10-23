import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { decodeQrTokenPayload, submitFeedback, ApiError } from '../api/feedback.api'
import RatingStars from '../components/RatingStars'
import CommentField from '../components/CommentField'

interface SubmittedData {
  rating: number
  comment?: string
  id: string
}

export default function FeedbackPage() {
  const [token, setToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('token')?.trim() || ''
  })
  const [manualInput, setManualInput] = useState('')
  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [ratingError, setRatingError] = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')
  const [submitted, setSubmitted] = useState<SubmittedData | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Decode table info if available in token payload
  const tokenPayload = useMemo(() => {
    if (!token) return null
    return decodeQrTokenPayload(token)
  }, [token])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (rating === 0) {
      setRatingError('Будь ласка, оберіть оцінку закладу від 1 до 5 зірок.')
      return
    }

    if (!token) {
      setSubmitError('Відсутній QR-токен. Відскануйте QR-код повторно.')
      return
    }

    setRatingError('')
    setSubmitError('')
    setSubmitting(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await submitFeedback(
        {
          qrToken: token,
          rating,
          comment: comment.trim() || undefined,
        },
        controller.signal,
      )

      setSubmitted({
        rating,
        comment: comment.trim() || undefined,
        id: response.id,
      })
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      if (err instanceof ApiError) {
        setSubmitError(err.message)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Сталася непередбачена помилка. Спробуйте ще раз.')
      }
    } finally {
      setSubmitting(false)
      abortControllerRef.current = null
    }
  }

  function handleReset() {
    setRating(0)
    setComment('')
    setRatingError('')
    setSubmitError('')
    setSubmitted(null)
  }

  function handleApplyManualToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const raw = manualInput.trim()
    if (!raw) return

    // If a full URL was pasted, extract the token query param
    let extracted = raw
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const parsed = new URL(raw)
        const t = parsed.searchParams.get('token')
        if (t) extracted = t
      }
    } catch {
      // Keep as-is if not a valid URL
    }

    setToken(extracted)
    setSubmitError('')
  }

  function handleLogoClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname === '/' && !window.location.search) {
      event.preventDefault()
      handleReset()
      setToken('')
      setManualInput('')
    }
  }

  return (
    <main className="feedback-app">
      <header className="feedback-header">
        <a href="/" className="brand-logo feedback-brand" onClick={handleLogoClick}>
          Feedback<span>Analytics</span>
        </a>
        <a href="/admin" className="feedback-admin-link">
          Кабінет закладу
        </a>
      </header>

      {/* Screen 1: Successful submission */}
      {submitted ? (
        <section className="feedback-card feedback-success" aria-labelledby="success-title">
          <div className="feedback-success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="feedback-eyebrow">Дякуємо!</p>
          <h1 id="success-title">Ваш відгук прийнято</h1>
          <p className="feedback-subtitle">
            Ми цінуємо ваш час та зворотний зв’язок. Система вже опрацьовує інформацію для команди закладу.
          </p>

          <div className="feedback-summary">
            <div className="feedback-summary-rating">
              <span className="feedback-summary-stars">{'★'.repeat(submitted.rating)}{'☆'.repeat(5 - submitted.rating)}</span>
              <strong>{submitted.rating} з 5</strong>
            </div>
            {submitted.comment && (
              <blockquote className="feedback-summary-comment">
                «{submitted.comment}»
              </blockquote>
            )}
          </div>

          {submitted.rating <= 2 ? (
            <div className="feedback-alert feedback-alert-notice" role="status">
              <strong>🚨 Ми зафіксували проблему</strong>
              <p>Адміністратор закладу вже отримав сповіщення про інцидент, щоб оперативно його владнати.</p>
            </div>
          ) : submitted.rating >= 4 ? (
            <div className="feedback-alert feedback-alert-positive" role="status">
              <strong>✨ Раді, що вам сподобалося!</strong>
              <p>Будемо щасливі бачити вас знову в нашому закладі.</p>
            </div>
          ) : null}

          <button type="button" className="feedback-btn feedback-btn-secondary" onClick={handleReset}>
            Залишити ще один відгук
          </button>
        </section>
      ) : !token ? (
        /* Screen 2: No token provided */
        <section className="feedback-card feedback-no-token" aria-labelledby="no-token-title">
          <div className="feedback-scan-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M20 14v6h-6" />
              <path d="M14 20h3" />
            </svg>
          </div>
          <p className="feedback-eyebrow">Збір відгуків</p>
          <h1 id="no-token-title">Відскануйте QR-код</h1>
          <p className="feedback-subtitle">
            Щоб залишити відгук про візит, будь ласка, відскануйте камерою смартфона QR-код на столику або у фіскальному чеку.
          </p>

          <form onSubmit={handleApplyManualToken} className="feedback-manual-form">
            <label htmlFor="manual-token-input">Або введіть посилання / токен вручну для тестування:</label>
            <div className="feedback-manual-group">
              <input
                id="manual-token-input"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Вставте токен або посилання"
              />
              <button type="submit" className="feedback-btn">
                Відкрити форму
              </button>
            </div>
          </form>
        </section>
      ) : (
        /* Screen 3: Guest Feedback Form */
        <section className="feedback-card" aria-labelledby="feedback-form-title">
          <div className="feedback-venue-meta">
            <span className="feedback-badge-venue">Заклад</span>
            {tokenPayload?.tableLabel && (
              <span className="feedback-badge-table">
                📍 {tokenPayload.tableLabel}
              </span>
            )}
          </div>

          <h1 id="feedback-form-title">Як пройшов ваш візит?</h1>
          <p className="feedback-subtitle">
            Оцініть заклад та залиште коментар без реєстрації — це займе не більше 15–20 секунд.
          </p>

          <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
            <div className="feedback-section">
              <label id="feedback-rating-title" className="feedback-label">
                Ваша оцінка <span className="feedback-required">*</span>
              </label>
              <RatingStars
                value={rating}
                onChange={(newRating) => {
                  setRating(newRating)
                  setRatingError('')
                }}
                disabled={submitting}
                error={ratingError}
              />
            </div>

            <div className="feedback-section">
              <CommentField
                value={comment}
                onChange={setComment}
                disabled={submitting}
                maxLength={1000}
              />
            </div>

            {submitError && (
              <div className="feedback-error-banner" role="alert">
                <p>{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              className="feedback-btn feedback-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Надсилаємо відгук…' : 'Надіслати відгук'}
            </button>
          </form>
        </section>
      )}

      <footer className="feedback-footer">
        <p>FeedbackAnalytics · Миттєвий аналіз задоволеності гостей</p>
      </footer>
    </main>
  )
}

