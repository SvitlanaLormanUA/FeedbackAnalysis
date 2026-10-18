import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import QRCode from 'qrcode'
import { ApiError, getQr } from './api'
import { clearSession } from './session'

export default function QrPage({ token }: { token: string }) {
  const [table, setTable] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [result, setResult] = useState<{ url: string; image: string; table: string } | null>(null)
  const request = useRef<AbortController | null>(null)
  const linkInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; request.current?.abort() }
  }, [])

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    const label = table.trim()
    setPending(true)
    setError('')
    setResult(null)
    setCopyStatus('')
    try {
      const data = await getQr(token, label, controller.signal)
      // Encode locally: signed guest links are never sent to a third-party QR service.
      const image = await QRCode.toDataURL(data.url, {
        width: 512, margin: 4, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      if (mounted.current) setResult({ url: data.url, image, table: label })
    } catch (err) {
      if (!mounted.current) return
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        window.location.replace('/admin/login?reason=expired')
        return
      }
      setError(err instanceof Error ? err.message : 'Не вдалося створити QR-код. Спробуйте ще раз.')
    } finally {
      window.clearTimeout(timeout)
      request.current = null
      if (mounted.current) setPending(false)
    }
  }

  async function copyLink() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      if (mounted.current) setCopyStatus('Посилання скопійовано.')
    } catch {
      if (!mounted.current) return
      linkInput.current?.focus()
      linkInput.current?.select()
      setCopyStatus('Не вдалося скопіювати автоматично. Скопіюйте виділене посилання вручну.')
    }
  }

  return (
    <section className="admin-card admin-qr" aria-labelledby="admin-qr-title">
      <p className="admin-eyebrow">Збір відгуків</p>
      <h1 id="admin-qr-title">QR-код для гостей</h1>
      <p>Створіть QR-код для закладу або окремого столика. Він відкриває форму відгуку без входу в систему.</p>
      <form onSubmit={generate} aria-busy={pending}>
        <label htmlFor="admin-table">Мітка столика (необов’язково)</label>
        <input id="admin-table" value={table} maxLength={100} disabled={pending} placeholder="Наприклад, столик 7" aria-describedby="admin-table-hint"
          onChange={event => { setTable(event.target.value); setResult(null); setError(''); setCopyStatus('') }} />
        <p id="admin-table-hint">Залиште поле порожнім для загального QR-коду закладу.</p>
        <button disabled={pending} type="submit">{pending ? 'Створюємо…' : 'Створити QR-код'}</button>
      </form>
      {error && <p role="alert" className="admin-error">{error}</p>}
      {result && <div className="admin-qr-result">
        <h2>{result.table ? `Столик: ${result.table}` : 'Загальний QR-код закладу'}</h2>
        <img src={result.image} width={512} height={512} alt={result.table ? `QR-код форми відгуку для столика ${result.table}` : 'QR-код форми відгуку для закладу'} />
        <label htmlFor="admin-guest-url">Посилання для гостей</label>
        <input ref={linkInput} id="admin-guest-url" value={result.url} readOnly onFocus={event => event.target.select()} />
        <div className="admin-qr-actions">
          <button onClick={copyLink} type="button">Копіювати посилання</button>
          <a href={result.image} download="feedback-qr.png">Завантажити PNG</a>
          <a href={result.url} target="_blank" rel="noopener noreferrer">Відкрити форму</a>
        </div>
        <p role="status">{copyStatus}</p>
      </div>}
    </section>
  )
}
