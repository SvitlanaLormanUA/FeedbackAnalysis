const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface CreateFeedbackPayload {
  qrToken: string
  rating: number
  comment?: string
}

export interface FeedbackAcceptedResponse {
  id: string
  createdAt: string
}

export interface QrTokenPayload {
  venueId: string
  qrCodeId: string
  tableLabel?: string | null
}

/**
 * Safely decodes the public payload part of a signed QR token.
 * Cryptographic signature verification is strictly handled on the backend.
 */
export function decodeQrTokenPayload(token: string): QrTokenPayload | null {
  try {
    const [body] = token.trim().split('.')
    if (!body) return null
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    // Support UTF-8 characters if encoded in JSON
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes)
    const json = JSON.parse(decoded) as QrTokenPayload
    if (!json || typeof json.venueId !== 'string') return null
    return json
  } catch {
    return null
  }
}

export async function submitFeedback(
  payload: CreateFeedbackPayload,
  signal?: AbortSignal,
): Promise<FeedbackAcceptedResponse> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrToken: payload.qrToken.trim(),
        rating: payload.rating,
        comment: payload.comment?.trim() ? payload.comment.trim() : undefined,
      }),
      signal: signal ?? AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Не вдалося з’єднатися із сервером. Перевірте підключення до інтернету та спробуйте ще раз.')
  }

  if (!response.ok) {
    let message = 'Не вдалося надіслати відгук. Спробуйте ще раз пізніше.'
    if (response.status === 401 || response.status === 404) {
      message = 'QR-код недійсний або застарів. Будь ласка, відскануйте новий QR-код закладу.'
    } else if (response.status === 400) {
      message = 'Перевірте введені дані: оцінка має бути цілим числом від 1 до 5.'
    }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<FeedbackAcceptedResponse>
}
