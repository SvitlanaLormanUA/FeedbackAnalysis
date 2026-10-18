import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, login, verifySession } from './api'
import { clearSession, readSession, saveSession, tokenExpiresAt } from './session'
import './admin.css'

function navigate(path: string) {
  window.location.replace(path)
}

function LoginPage() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const expired = new URLSearchParams(window.location.search).get('reason') === 'expired'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const form = event.currentTarget
    const data = new FormData(form)
    setPending(true)
    setError('')
    try {
      const token = await login(String(data.get('email')).trim(), String(data.get('password')))
      saveSession(token)
      form.reset()
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти.')
      setPending(false)
      submitting.current = false
    }
  }

  return (
    <section className="admin-card admin-login" aria-labelledby="admin-login-title">
      <p className="admin-eyebrow">Кабінет адміністратора</p>
      <h1 id="admin-login-title">Вхід до FeedbackAnalytics</h1>
      <p>Увійдіть з обліковим записом вашого закладу.</p>
      {expired && <p className="admin-notice" role="status">Сесія завершилася. Увійдіть знову.</p>}
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="admin-email">Email</label>
        <input id="admin-email" name="email" type="email" autoComplete="username" required disabled={pending} />
        <label htmlFor="admin-password">Пароль</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required disabled={pending} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Входимо…' : 'Увійти'}</button>
      </form>
    </section>
  )
}

export default function AdminApp() {
  const [token, setToken] = useState(readSession)
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const path = window.location.pathname.replace(/\/+$/, '')
  const isLogin = path === '/admin/login'

  function logout() {
    clearSession()
    setToken(null)
    navigate('/admin/login')
  }

  useEffect(() => {
    if (!token) {
      if (!isLogin) navigate('/admin/login')
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    let active = true
    verifySession(token, controller.signal).then(() => {
      if (!active) return
      if (isLogin) navigate('/admin')
      else setStatus('ready')
    }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        navigate('/admin/login?reason=expired')
      } else {
        setError(err instanceof Error ? err.message : 'Не вдалося перевірити сесію.')
        setStatus('error')
      }
    }).finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [token, isLogin, attempt])

  useEffect(() => {
    if (!token) return
    const checkExpiry = () => {
      if (tokenExpiresAt(token) <= Date.now()) {
        clearSession()
        navigate('/admin/login?reason=expired')
      }
    }
    // Cap the delay to avoid overflowing browser timers for long-lived tokens.
    const timer = window.setInterval(checkExpiry, Math.max(100, Math.min(1000, tokenExpiresAt(token) - Date.now())))
    window.addEventListener('focus', checkExpiry)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', checkExpiry)
    }
  }, [token])

  return (
    <main className="admin-app">
      <header className="admin-header">
        <a href="/admin" className="admin-brand">FeedbackAnalytics</a>
        {token && <button className="admin-secondary" onClick={logout}>Вийти</button>}
      </header>
      {!token && isLogin ? <LoginPage /> : status === 'error' ? (
        <section className="admin-card">
          <h1>Не вдалося відкрити кабінет</h1>
          <p role="alert" className="admin-error">{error}</p>
          <button onClick={() => { setStatus('checking'); setAttempt(value => value + 1) }}>Спробувати ще раз</button>
        </section>
      ) : !token || status === 'checking' || isLogin ? (
        <p role="status">Перевіряємо сесію…</p>
      ) : path !== '/admin' ? (
        <section className="admin-card"><h1>Сторінку не знайдено</h1><a href="/admin">До кабінету</a></section>
      ) : (
        <section className="admin-card">
          <p className="admin-eyebrow">Кабінет адміністратора</p>
          <h1>Вітаємо в FeedbackAnalytics</h1>
          <p>Ви увійшли до кабінету вашого закладу.</p>
          <p className="admin-notice">Список відгуків і статистика з’являться на наступних етапах.</p>
        </section>
      )}
    </main>
  )
}
