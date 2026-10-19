import type { ChangeEvent } from 'react'

interface CommentFieldProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  maxLength?: number
}

export default function CommentField({
  value,
  onChange,
  disabled = false,
  maxLength = 1000,
}: CommentFieldProps) {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value.slice(0, maxLength))
  }

  const remaining = maxLength - value.length
  const isNearLimit = remaining <= 50

  return (
    <div className="feedback-field">
      <div className="feedback-field-header">
        <label htmlFor="feedback-comment">
          Ваш коментар <span className="feedback-optional">(необов’язково)</span>
        </label>
        <span
          className={`feedback-char-count ${isNearLimit ? 'is-warning' : ''}`}
          aria-live="polite"
        >
          {value.length} / {maxLength}
        </span>
      </div>
      <textarea
        id="feedback-comment"
        name="comment"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        maxLength={maxLength}
        rows={4}
        placeholder="Розкажіть про сервіс, страви, персонал або атмосферу…"
        aria-describedby="feedback-comment-hint"
      />
      <p id="feedback-comment-hint" className="feedback-field-hint">
        Ваш коментар буде проаналізовано для оперативного покращення сервісу.
      </p>
    </div>
  )
}

