import type { ReviewsResponse } from './reviews'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Не вдалося з’єднатися із сервером. Спробуйте ще раз.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, response.status === 401
      ? 'Неправильний email або пароль.'
      : response.status === 400
        ? 'Перевірте дані. Обліковий запис має бути прив’язаний до закладу.'
        : 'Сервер не зміг виконати запит. Спробуйте ще раз.')
  }
  return response.json() as Promise<T>
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (typeof data.accessToken !== 'string' || !data.accessToken) {
    throw new Error('Сервер повернув некоректну відповідь. Спробуйте ще раз.')
  }
  return data.accessToken
}

// The backend has no /auth/me. This existing protected endpoint validates access.
export function verifySession(token: string, signal: AbortSignal): Promise<unknown> {
  return request('/stats', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
}

export function getReviews(token: string, page: number, signal: AbortSignal): Promise<ReviewsResponse> {
  return request(`/reviews?page=${page}&pageSize=20`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
}

export interface VenueStats {
  venueId: string
  totalFeedback: number
  averageRating: number
  criticalCount: number
}

export async function getStats(token: string, signal: AbortSignal): Promise<VenueStats> {
  const stats = await request<VenueStats>('/stats', {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  if (!stats || !Number.isInteger(stats.totalFeedback) || stats.totalFeedback < 0
    || !Number.isFinite(stats.averageRating) || stats.averageRating < 0 || stats.averageRating > 5
    || !Number.isInteger(stats.criticalCount) || stats.criticalCount < 0) {
    throw new Error('Сервер повернув некоректну статистику. Спробуйте ще раз.')
  }
  return stats
}

export async function getQr(token: string, table: string, signal: AbortSignal): Promise<{ token: string; url: string }> {
  const query = table ? `?${new URLSearchParams({ table })}` : ''
  const data = await request<{ token: string; url: string }>(`/qr${query}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  try {
    const url = new URL(data.url)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || !url.pathname.endsWith('/feedback') || !data.token || url.searchParams.get('token') !== data.token) {
      throw new Error('Invalid QR response')
    }
  } catch {
    throw new Error('Сервер повернув некоректне посилання для гостей. Спробуйте ще раз.')
  }
  return data
}
