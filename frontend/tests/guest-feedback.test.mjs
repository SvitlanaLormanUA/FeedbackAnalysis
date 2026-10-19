import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import {
  decodeQrTokenPayload,
  submitFeedback,
  ApiError,
} from '../src/api/feedback.api.ts'

function createFakeToken(payload) {
  const json = JSON.stringify(payload)
  const body = Buffer.from(json).toString('base64url')
  return `${body}.mock_signature`
}

test('decodeQrTokenPayload parses valid tokens with and without table label', () => {
  const tokenWithTable = createFakeToken({
    venueId: 'venue-123',
    qrCodeId: 'venue-123:table-5',
    tableLabel: 'Столик 5',
  })
  const parsed = decodeQrTokenPayload(tokenWithTable)
  assert.ok(parsed)
  assert.equal(parsed.venueId, 'venue-123')
  assert.equal(parsed.qrCodeId, 'venue-123:table-5')
  assert.equal(parsed.tableLabel, 'Столик 5')

  const tokenWithoutTable = createFakeToken({
    venueId: 'venue-999',
    qrCodeId: 'venue-999:default',
  })
  const parsed2 = decodeQrTokenPayload(tokenWithoutTable)
  assert.ok(parsed2)
  assert.equal(parsed2.venueId, 'venue-999')
  assert.equal(parsed2.tableLabel, undefined)
})

test('decodeQrTokenPayload gracefully returns null on malformed or incomplete token', () => {
  assert.equal(decodeQrTokenPayload(''), null)
  assert.equal(decodeQrTokenPayload('invalid-string'), null)
  assert.equal(decodeQrTokenPayload('not-base64.sig'), null)
  const missingVenue = createFakeToken({ qrCodeId: 'something' })
  assert.equal(decodeQrTokenPayload(missingVenue), null)
})

test('submitFeedback successfully posts guest rating and comment', async () => {
  let requestedUrl = ''
  let requestOptions = null

  globalThis.fetch = async (url, options) => {
    requestedUrl = url
    requestOptions = options
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 'feedback-1',
        createdAt: '2026-10-19T14:30:00.000Z',
      }),
    }
  }

  const result = await submitFeedback({
    qrToken: 'test.token',
    rating: 5,
    comment: 'Чудовий сервіс та смачна кава!',
  })

  assert.equal(requestedUrl, 'http://localhost:3000/api/feedback')
  assert.equal(requestOptions.method, 'POST')
  assert.equal(requestOptions.headers['Content-Type'], 'application/json')

  const parsedBody = JSON.parse(requestOptions.body)
  assert.equal(parsedBody.qrToken, 'test.token')
  assert.equal(parsedBody.rating, 5)
  assert.equal(parsedBody.comment, 'Чудовий сервіс та смачна кава!')

  assert.equal(result.id, 'feedback-1')
  assert.equal(result.createdAt, '2026-10-19T14:30:00.000Z')
})

test('submitFeedback handles 401/404 expired or invalid QR token', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Invalid QR token' }),
  })

  await assert.rejects(
    async () => {
      await submitFeedback({ qrToken: 'invalid.token', rating: 3 })
    },
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 401)
      assert.match(err.message, /QR-код недійсний або застарів/)
      return true
    },
  )
})

test('submitFeedback handles 400 validation error', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ message: 'Validation failed' }),
  })

  await assert.rejects(
    async () => {
      await submitFeedback({ qrToken: 'valid.token', rating: 10 })
    },
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 400)
      assert.match(err.message, /оцінка має бути цілим числом від 1 до 5/)
      return true
    },
  )
})

test('submitFeedback handles network failure gracefully', async () => {
  globalThis.fetch = async () => {
    throw new Error('Connection refused')
  }

  await assert.rejects(
    async () => {
      await submitFeedback({ qrToken: 'valid.token', rating: 4 })
    },
    (err) => {
      assert.match(err.message, /Не вдалося з’єднатися із сервером/)
      return true
    },
  )
})

