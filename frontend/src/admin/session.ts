const SESSION_KEY = 'feedbackanalytics.admin.token'

// Decoding only schedules expiry; the backend verifies the token signature.
export function tokenExpiresAt(token: string): number {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(part)) as { exp?: number }
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : 0
  } catch {
    return 0
  }
}

export function readSession(): string | null {
  try {
    const token = sessionStorage.getItem(SESSION_KEY)
    if (token && tokenExpiresAt(token) > Date.now()) return token
    clearSession()
  } catch {
    // Login will explain that storage must be available to persist a session.
  }
  return null
}

export function saveSession(token: string): void {
  if (tokenExpiresAt(token) <= Date.now()) {
    throw new Error('Сервер повернув недійсну сесію. Спробуйте увійти ще раз.')
  }
  try {
    sessionStorage.setItem(SESSION_KEY, token)
  } catch {
    throw new Error('Дозвольте збереження даних сайту в браузері, щоб увійти.')
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // The in-memory session is cleared by the caller even if storage is blocked.
  }
}
