// Optional browser checks: use an existing Playwright installation, see admin/README.md.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined })
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
try {
  const page = await browser.newPage()
  const token = `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('test.session.seeded')) {
      sessionStorage.setItem('feedbackanalytics.admin.token', value)
      sessionStorage.setItem('test.session.seeded', 'true')
    }
  }, token)
  let mode = 'normal'
  let statsFailure = false
  let statsCalls = 0
  let reviewCalls = 0
  const review = (id, overrides = {}) => ({
    id, rating: 5, comment: `Відгук ${id}`, createdAt: '2026-10-18T12:00:00Z',
    status: 'ANALYZED', sentiment: 'POSITIVE', isCritical: false, aspects: [], ...overrides,
  })
  const firstPage = [
    review('critical', { rating: 1, comment: '<script>alert(1)</script>\nДовгий коментар ' + 'а'.repeat(1000), sentiment: 'NEGATIVE', isCritical: true,
      aspects: [{ category: 'STAFF', sentiment: 'NEGATIVE', quote: 'Персонал був грубим' }] }),
    review('received', { rating: 2, status: 'RECEIVED', comment: null, sentiment: null }),
    review('queued', { status: 'QUEUED', sentiment: null }),
    review('failed', { status: 'ANALYSIS_FAILED', sentiment: null }),
    review('mixed', { sentiment: 'MIXED' }),
    review('neutral', { sentiment: 'NEUTRAL' }),
    ...Array.from({ length: 14 }, (_, index) => review(`extra-${index}`)),
  ]
  await page.route('**/api/**', async route => {
    assert.equal(route.request().headers().authorization, `Bearer ${token}`)
    if (route.request().url().endsWith('/stats')) {
      statsCalls++
      if (statsFailure) return route.fulfill({ status: 500, json: {} })
      if (mode === 'updated') await new Promise(resolve => setTimeout(resolve, 200))
      return route.fulfill({ json: { venueId: 'demo', totalFeedback: mode === 'empty' ? 0 : mode === 'updated' ? 22 : 21,
        averageRating: mode === 'empty' ? 0 : mode === 'updated' ? 3.5 : 4.25, criticalCount: mode === 'updated' ? 2 : mode === 'empty' ? 0 : 1 } })
    }
    reviewCalls++
    const url = new URL(route.request().url())
    assert.equal(url.searchParams.get('pageSize'), '20')
    if (mode === 'unauthorized') return route.fulfill({ status: 401, json: {} })
    if (mode === 'error') return route.fulfill({ status: 500, json: {} })
    const number = Number(url.searchParams.get('page'))
    if (number === 2) await new Promise(resolve => setTimeout(resolve, 200))
    return route.fulfill({ json: { page: number, pageSize: 20, total: mode === 'empty' ? 0 : mode === 'updated' ? 22 : 21,
      items: mode === 'empty' ? [] : number === 1 ? (mode === 'updated' ? [review('new'), ...firstPage.slice(0, 19)] : firstPage) : [review('last')] } })
  })
  await page.goto(`${base}/admin`)
  await page.getByText('Критичний відгук', { exact: true }).waitFor()
  assert.equal(await page.getByRole('article').count(), 20)
  for (const text of ['Без коментаря', 'Низька оцінка', 'У черзі на аналіз', 'Помилка аналізу', 'Персонал був грубим', 'Змішана', 'Нейтральна']) {
    assert.equal(await page.getByText(text, { exact: true }).isVisible(), true)
  }
  assert.equal(await page.getByText('Ще не визначена', { exact: true }).count(), 3)
  assert.equal(await page.getByRole('button', { name: 'Попередня', exact: true }).isDisabled(), true)
  // Guest content must be rendered as text, not HTML.
  assert.equal(await page.locator('.admin-review script').count(), 0)
  await page.setViewportSize({ width: 375, height: 812 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT })
  await page.getByRole('button', { name: 'Наступна', exact: true }).click()
  await page.getByText('Завантажуємо відгуки…', { exact: true }).waitFor()
  await page.getByText('Відгук last', { exact: true }).waitFor()
  assert.equal(await page.getByRole('article').count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Наступна', exact: true }).isDisabled(), true)
  mode = 'error'
  await page.getByRole('button', { name: 'Попередня', exact: true }).click()
  await page.getByRole('alert').waitFor()
  mode = 'normal'
  await page.getByRole('button', { name: 'Спробувати ще раз', exact: true }).click()
  await page.getByText('Критичний відгук', { exact: true }).waitFor()
  const statistics = page.getByRole('region', { name: 'Статистика закладу' })
  assert.match(await statistics.innerText(), /4,25 \/ 5/)
  mode = 'updated'
  const beforeStats = statsCalls, beforeReviews = reviewCalls
  await page.getByRole('button', { name: 'Оновити дані', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Оновлюємо…', exact: true }).isDisabled(), true)
  await page.getByText('Відгук new', { exact: true }).waitFor()
  assert.match(await statistics.innerText(), /3,5 \/ 5/)
  // Development StrictMode may start and cancel an extra mount request.
  assert.ok(statsCalls > beforeStats && statsCalls <= beforeStats + 2)
  assert.ok(reviewCalls > beforeReviews && reviewCalls <= beforeReviews + 2)
  assert.equal(await statistics.locator('dd').nth(2).innerText(), '2')
  statsFailure = true
  await page.getByRole('button', { name: 'Оновити дані', exact: true }).click()
  await statistics.getByRole('alert').waitFor()
  assert.equal(await statistics.locator('dd').count(), 0)
  assert.equal(await page.getByText('Відгук new', { exact: true }).isVisible(), true)
  statsFailure = false
  await page.getByRole('button', { name: 'Спробувати ще раз', exact: true }).click()
  await statistics.getByText('3,5 / 5', { exact: true }).waitFor()
  mode = 'empty'
  await page.reload()
  await page.getByRole('heading', { name: 'Відгуків ще немає', exact: true }).waitFor()
  assert.equal(await statistics.getByText('Немає оцінок', { exact: true }).isVisible(), true)
  assert.equal(await page.getByRole('navigation', { name: 'Сторінки відгуків' }).count(), 0)
  mode = 'unauthorized'
  await page.reload()
  await page.waitForURL('**/admin/login?reason=expired')
  assert.equal(await page.evaluate(() => sessionStorage.getItem('feedbackanalytics.admin.token')), null)
  console.log('PASS: statistics, coordinated refresh, partial failure and recovery, zero ratings, review fields, all analysis states, nulls, escaped text, mobile layout, pagination, loading, retry, empty state, 401 redirect')
} finally {
  await browser.close()
}
