import type { VenueStats } from './api'

export default function StatisticsCards({ stats, loading, error }: {
  stats: VenueStats | null; loading: boolean; error: string
}) {
  return (
    <section className="admin-statistics" aria-label="Статистика закладу" aria-busy={loading}>
      <h2>Статистика закладу</h2>
      {loading ? <p role="status">Завантажуємо статистику…</p> : error ? (
        <p role="alert" className="admin-error">Не вдалося завантажити статистику. {error}</p>
      ) : stats && (
        <>
          <dl className="admin-stats-grid">
            <div><dt>Усього відгуків</dt><dd>{stats.totalFeedback.toLocaleString('uk-UA')}</dd></div>
            <div><dt>Середня оцінка</dt><dd>{stats.totalFeedback === 0 ? 'Немає оцінок' : `${stats.averageRating.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} / 5`}</dd></div>
            <div><dt>Критичні відгуки</dt><dd>{stats.criticalCount.toLocaleString('uk-UA')}</dd></div>
          </dl>
          <p className="admin-review-hint">За весь час, для всього закладу. Критичні відгуки враховуються після аналізу; це не кількість доставлених сповіщень.</p>
        </>
      )}
    </section>
  )
}
