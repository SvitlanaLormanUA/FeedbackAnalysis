import { useState } from 'react'

const RATING_LABELS: Record<number, string> = {
  1: 'Дуже погано',
  2: 'Погано',
  3: 'Задовільно',
  4: 'Добре',
  5: 'Чудово',
}

interface RatingStarsProps {
  value: number
  onChange: (rating: number) => void
  disabled?: boolean
  error?: string
}

export default function RatingStars({ value, onChange, disabled = false, error }: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const activeRating = hovered ?? value
  const activeLabel = activeRating > 0 ? RATING_LABELS[activeRating] : ''

  return (
    <div className="feedback-rating-group" role="group" aria-labelledby="feedback-rating-title">
      <div className="feedback-stars" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = activeRating >= star
          return (
            <button
              key={star}
              type="button"
              className={`feedback-star-btn ${isFilled ? 'is-filled' : ''} ${value === star ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => !disabled && setHovered(star)}
              onFocus={() => !disabled && setHovered(star)}
              onBlur={() => setHovered(null)}
              aria-label={`${star} ${star === 1 ? 'зірка' : star < 5 ? 'зірки' : 'зірок'} з 5: ${RATING_LABELS[star]}`}
              aria-pressed={value === star}
            >
              <svg
                className="feedback-star-icon"
                viewBox="0 0 24 24"
                fill={isFilled ? '#e59b12' : 'none'}
                stroke={isFilled ? '#e59b12' : '#a8b8a8'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )
        })}
      </div>
      <div className="feedback-rating-text" aria-live="polite">
        {activeLabel ? (
          <span className="feedback-rating-indicator">{activeLabel}</span>
        ) : (
          <span className="feedback-rating-hint">Оберіть оцінку від 1 до 5</span>
        )}
      </div>
      {error && <p className="feedback-field-error" role="alert">{error}</p>}
    </div>
  )
}

