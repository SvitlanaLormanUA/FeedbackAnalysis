import { useEffect, useState } from 'react'
import { ApiError, getReviews, getStats } from './api'
import StatisticsCards from './StatisticsCards'
import type { VenueStats } from './api'
import { clearSession } from './session'
import { aspectLabels, reviewDate, sentimentLabels, statusLabels } from './reviews'
import type { Review, ReviewsResponse } from './reviews'

function ReviewCard({ review }: { review: Review }) {
  return (
    <li>
      <article className="admin-review" aria-label={`Відгук: оцінка ${review.rating} з 5`}>
        <div className="admin-review-top">
          <strong className="admin-rating">{review.rating} / 5 <span aria-hidden="true">★</span></strong>
          <time dateTime={review.createdAt}>{reviewDate(review.createdAt)}</time>
        </div>
        <div className="admin-badges">
          <span className="admin-badge">{statusLabels[review.status] ?? 'Невідомий статус'}</span>
          {review.isCritical && <span className="admin-badge admin-badge-critical">Критичний відгук</span>}
          {!review.isCritical && review.rating <= 2 && <span className="admin-badge admin-badge-critical">Низька оцінка</span>}
        </div>
        <p className="admin-review-comment">{review.comment?.trim() ? review.comment : 'Без коментаря'}</p>
        <p className="admin-review-sentiment">Тональність: <span className={`admin-badge admin-sentiment-${review.sentiment?.toLowerCase() ?? 'pending'}`}>
          {review.sentiment ? (sentimentLabels[review.sentiment] ?? 'Невідома') : 'Ще не визначена'}
        </span></p>
        {review.status === 'ANALYSIS_FAILED' && <p className="admin-review-hint">Аналіз не завершився успішно. Відгук збережено.</p>}
        {(review.status === 'RECEIVED' || review.status === 'QUEUED') && <p className="admin-review-hint">Очікуємо завершення аналізу.</p>}
        {review.aspects.length > 0 ? (
          <ul className="admin-aspects" aria-label="Аспекти відгуку">
            {review.aspects.map((aspect, index) => (
              <li key={`${aspect.category}-${index}`}>
                <div><strong>{aspectLabels[aspect.category] ?? aspect.category}</strong> <span className={`admin-badge admin-sentiment-${aspect.sentiment.toLowerCase()}`}>{sentimentLabels[aspect.sentiment] ?? 'Невідома'}</span></div>
                {aspect.quote && <blockquote>{aspect.quote}</blockquote>}
              </li>
            ))}
          </ul>
        ) : <p className="admin-review-hint">{review.status === 'ANALYZED' ? 'Аспектів не виявлено.' : 'Аспекти поки недоступні.'}</p>}
      </article>
    </li>
  )
}

function ReviewsContent({ token, page, onPageChange, onRefresh }: {
  token: string; page: number; onPageChange: (page: number) => void; onRefresh: () => void
}) {
  const [result, setResult] = useState<{
    reviews: ReviewsResponse | null; stats: VenueStats | null;
    reviewsError: string; statsError: string; updatedAt: string;
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15_000)
    let active = true
    const handleFailure = (err: unknown): never => {
      if (active && err instanceof ApiError && err.status === 401) {
        clearSession()
        window.location.replace('/admin/login?reason=expired')
      }
      throw err
    }
    // Publish both results together; one unavailable endpoint does not hide the other.
    Promise.allSettled([
      getReviews(token, page, controller.signal).catch(handleFailure),
      getStats(token, controller.signal).catch(handleFailure),
    ]).then(([reviews, stats]) => {
      if (!active) return
      const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Не вдалося завантажити дані.'
      setResult({
        reviews: reviews.status === 'fulfilled' ? reviews.value : null,
        stats: stats.status === 'fulfilled' ? stats.value : null,
        reviewsError: reviews.status === 'rejected' ? message(reviews.reason) : '',
        statsError: stats.status === 'rejected' ? message(stats.reason) : '',
        updatedAt: new Date().toLocaleTimeString('uk-UA'),
      })
    }).finally(() => window.clearTimeout(timer))
    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [token, page])

  return (
    <>
      <div className="admin-refresh">
        <button disabled={!result} onClick={onRefresh}>{result ? 'Оновити дані' : 'Оновлюємо…'}</button>
        {result && !result.reviewsError && !result.statsError && <span role="status">Дані оновлено о {result.updatedAt}</span>}
      </div>
      <StatisticsCards stats={result?.stats ?? null} loading={!result} error={result?.statsError ?? ''} />
      {!result ? <p role="status" className="admin-review-state">Завантажуємо відгуки…</p> : result.reviews ? (
        <ReviewsList data={result.reviews} page={page} onPageChange={onPageChange} />
      ) : (
        <div className="admin-review-state">
          <p role="alert" className="admin-error">Не вдалося завантажити відгуки. {result.reviewsError}</p>
          {page > 1 && <button className="admin-secondary" onClick={() => onPageChange(1)}>До першої сторінки</button>}
        </div>
      )}
      {result && (result.reviewsError || result.statsError) && <button onClick={onRefresh}>Спробувати ще раз</button>}
    </>
  )
}

function ReviewsList({ data, page, onPageChange }: {
  data: ReviewsResponse; page: number; onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  return (
    <>
      <p role="status">Усього відгуків: {data.total}. {data.items.length > 0 && `Показано ${(page - 1) * data.pageSize + 1}–${(page - 1) * data.pageSize + data.items.length}.`}</p>
      {data.items.length === 0 ? (
        <div className="admin-review-state">
          <h2>{data.total === 0 ? 'Відгуків ще немає' : 'На цій сторінці немає відгуків'}</h2>
          <p>{data.total === 0 ? 'Тут з’являться оцінки та коментарі гостей вашого закладу.' : 'Список міг змінитися. Поверніться до першої сторінки.'}</p>
          {page > 1 && <button onClick={() => onPageChange(1)}>До першої сторінки</button>}
        </div>
      ) : <ul className="admin-review-list">{data.items.map(review => <ReviewCard key={review.id} review={review} />)}</ul>}
      {data.total > 0 && <nav className="admin-pagination" aria-label="Сторінки відгуків">
        <button className="admin-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Попередня</button>
        <span>Сторінка {page} з {pages}</span>
        <button className="admin-secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Наступна</button>
      </nav>}
    </>
  )
}

export default function ReviewsPage({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  return (
    <section className="admin-reviews" aria-labelledby="admin-reviews-title">
      <p className="admin-eyebrow">Кабінет адміністратора</p>
      <h1 id="admin-reviews-title">Відгуки гостей</h1>
      <p>Оцінки, коментарі та результати аналізу. Спочатку найновіші.</p>
      {/* A new page gets fresh loading state. Cleanup ignores any late response. */}
      <ReviewsContent key={`${token}-${page}-${refresh}`} token={token} page={page} onPageChange={setPage} onRefresh={() => setRefresh(value => value + 1)} />
    </section>
  )
}
