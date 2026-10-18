import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { clearSession, readSession, saveSession, tokenExpiresAt } from '../src/admin/session.ts'

function token(exp) {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`
}

beforeEach(() => {
  const values = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
  })
})

test('session survives reading and is removed on logout', () => {
  const jwt = token(Math.floor(Date.now() / 1000) + 3600)
  saveSession(jwt)
  assert.equal(readSession(), jwt)
  clearSession()
  assert.equal(readSession(), null)
})

test('expired and malformed tokens cannot restore a session', () => {
  for (const jwt of [token(1), 'broken', token('invalid')]) {
    sessionStorage.setItem('feedbackanalytics.admin.token', jwt)
    assert.equal(readSession(), null)
    assert.equal(sessionStorage.getItem('feedbackanalytics.admin.token'), null)
    assert.throws(() => saveSession(jwt), /недійсну сесію/)
  }
  assert.equal(tokenExpiresAt('broken'), 0)
})

test('blocked storage does not crash startup and explains failed login', () => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new Error('Storage blocked') },
  })
  assert.equal(readSession(), null)
  assert.doesNotThrow(clearSession)
  assert.throws(() => saveSession(token(Date.now() / 1000 + 3600)), /Дозвольте збереження/)
})
