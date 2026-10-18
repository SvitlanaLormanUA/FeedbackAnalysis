import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined })
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
try {
  const page = await browser.newPage()
  const jwt = `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString('base64url')}.signature`
  await page.addInitScript(token => {
    if (!sessionStorage.getItem('test.seeded')) {
      sessionStorage.setItem('feedbackanalytics.admin.token', token)
      sessionStorage.setItem('test.seeded', '1')
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.copiedText = text },
    } })
  }, jwt)
  let mode = 'ok', table, calls = 0
  const guestToken = 'signed-guest-token'
  const guestUrl = `${base}/feedback?token=${guestToken}`
  await page.route('**/api/**', async route => {
    assert.equal(route.request().headers().authorization, `Bearer ${jwt}`)
    if (route.request().url().endsWith('/stats')) return route.fulfill({ json: {} })
    const url = new URL(route.request().url())
    assert.equal(url.pathname, '/api/qr')
    table = url.searchParams.get('table')
    calls++
    await new Promise(resolve => setTimeout(resolve, 200))
    if (mode === '401') return route.fulfill({ status: 401, json: {} })
    if (mode === 'error') return route.fulfill({ status: 500, json: {} })
    return route.fulfill({ json: { token: guestToken, url: mode === 'invalid' ? 'javascript:alert(1)' : guestUrl } })
  })
  await page.goto(`${base}/admin/qr`)
  const generate = page.getByRole('button', { name: 'Створити QR-код', exact: true })
  await generate.click()
  assert.equal(await page.getByRole('button', { name: 'Створюємо…', exact: true }).isDisabled(), true)
  const qr = page.getByRole('img', { name: 'QR-код форми відгуку для закладу', exact: true })
  await qr.waitFor()
  assert.equal(table, null)
  assert.equal(calls, 1)
  assert.equal(await page.getByLabel('Посилання для гостей', { exact: true }).inputValue(), guestUrl)
  assert.match(await qr.getAttribute('src'), /^data:image\/png;base64,/)
  const decoded = await page.evaluate(async () => {
    if (!('BarcodeDetector' in window)) return null
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    const img = document.querySelector('.admin-qr-result img')
    await img.decode()
    const results = await detector.detect(img)
    return results[0]?.rawValue
  })
  if (decoded !== null) assert.equal(decoded, guestUrl)
  await page.getByRole('button', { name: 'Копіювати посилання' }).click()
  await page.getByText('Посилання скопійовано.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.copiedText), guestUrl)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Завантажити PNG' }).click()
  const download = await downloadPromise
  assert.equal(download.suggestedFilename(), 'feedback-qr.png')
  assert.equal(await download.failure(), null)
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied') } })
  await page.getByRole('button', { name: 'Копіювати посилання' }).click()
  await page.getByText(/Скопіюйте виділене посилання вручну/).waitFor()
  const field = page.getByLabel('Мітка столика (необов’язково)', { exact: true })
  await field.fill(' Столик 7 & вікно ')
  assert.equal(await page.locator('.admin-qr-result').count(), 0)
  await generate.click()
  await page.getByRole('heading', { name: 'Столик: Столик 7 & вікно', exact: true }).waitFor()
  assert.equal(table, 'Столик 7 & вікно')
  assert.equal(await page.getByRole('link', { name: 'Відкрити форму' }).getAttribute('href'), guestUrl)
  await page.setViewportSize({ width: 375, height: 812 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT })
  mode = 'error'
  await generate.click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.locator('.admin-qr-result').count(), 0)
  mode = 'invalid'
  await generate.click()
  await page.getByText(/некоректне посилання/).waitFor()
  mode = 'ok'
  await generate.click()
  await page.locator('.admin-qr-result img').waitFor()
  mode = '401'
  await generate.click()
  await page.waitForURL('**/admin/login?reason=expired')
  assert.equal(await page.evaluate(() => sessionStorage.getItem('feedbackanalytics.admin.token')), null)
  console.log(`PASS: QR generation, table encoding, local PNG, copy/fallback, download, invalid URL, retry, mobile, 401. Native QR decode: ${decoded === null ? 'unavailable' : 'passed'}`)
} finally {
  await browser.close()
}
