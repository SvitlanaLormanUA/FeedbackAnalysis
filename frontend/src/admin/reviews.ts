export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED'
export type FeedbackStatus = 'RECEIVED' | 'QUEUED' | 'ANALYZED' | 'ANALYSIS_FAILED'
export type AspectCategory = 'STAFF' | 'FOOD' | 'CLEANLINESS' | 'PRICE_QUALITY' | 'WAITING_TIME'

export interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  status: FeedbackStatus
  sentiment: Sentiment | null
  isCritical: boolean
  aspects: Array<{ category: AspectCategory; sentiment: Sentiment; quote: string | null }>
}

export interface ReviewsResponse {
  page: number
  pageSize: number
  total: number
  items: Review[]
}

export const sentimentLabels: Record<Sentiment, string> = {
  POSITIVE: 'Позитивна', NEUTRAL: 'Нейтральна', NEGATIVE: 'Негативна', MIXED: 'Змішана',
}
export const statusLabels: Record<FeedbackStatus, string> = {
  RECEIVED: 'Отримано', QUEUED: 'У черзі на аналіз', ANALYZED: 'Проаналізовано', ANALYSIS_FAILED: 'Помилка аналізу',
}
export const aspectLabels: Record<AspectCategory, string> = {
  STAFF: 'Персонал', FOOD: 'Страви', CLEANLINESS: 'Чистота', PRICE_QUALITY: 'Ціна / якість', WAITING_TIME: 'Час очікування',
}

export function reviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата невідома'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
