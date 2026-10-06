import { useEffect, useState } from 'react'
import { Bell, Check, LoaderCircle, Mail, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
interface Preferences { enabled: boolean; delivery_time: string; time_zone: string; next_send_at?: string | null }
const detectedZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
function zones() {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  return Array.from(new Set([detectedZone(), 'UTC', ...(intl.supportedValuesOf?.('timeZone') || ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'])])).sort()
}
async function reminderRequest(action: string, body?: unknown) {
  const session = (await supabase?.auth.getSession())?.data.session
  if (!session) throw new Error('Sign in to set up email reminders.')
  const response = await fetch(`/api/reminders?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Email reminders are temporarily unavailable.')
  return result
}
export default function EmailReminders({ email, onClose }: { email?: string; onClose: () => void }) {
  const [preferences, setPreferences] = useState<Preferences>({ enabled: false, delivery_time: '07:00', time_zone: detectedZone() })
  const [saved, setSaved] = useState<Preferences | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [timeZones] = useState(zones)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void reminderRequest('settings').then(result => {
      if (!active) return
      setReady(result.ready === true)
      if (!result.ready) setError(result.error || 'Daily emails are not available yet. Please try again later.')
      if (result.preferences) { setPreferences(result.preferences); setSaved(result.preferences) }
    }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose, busy])
  const save = async () => {
    setBusy('save'); setError(''); setNotice('')
    try {
      const result = await reminderRequest('settings', preferences)
      setPreferences(result.preferences); setSaved(result.preferences)
      setNotice(result.preferences.enabled ? 'Your daily reminder is scheduled.' : 'Daily email reminders are off.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your preferences.') }
    finally { setBusy('') }
  }
  const test = async () => {
    setBusy('test'); setError(''); setNotice('')
    try { const result = await reminderRequest('test', {}); setNotice(result.message) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not send your test email.') }
    finally { setBusy('') }
  }
  const dirty = JSON.stringify(preferences) !== JSON.stringify(saved)
  return <div className="modal-backdrop" onClick={() => !busy && onClose()}><section className="theme-modal reminder-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-title" onClick={event => event.stopPropagation()}>
    <div className="section-heading"><div><span className="kicker"><Bell size={15} /> A gentle daily nudge</span><h2 id="reminder-title">Email reminders</h2></div><button className="icon-button" disabled={Boolean(busy)} onClick={onClose} aria-label="Close email reminders"><X size={20} /></button></div>
    <p className="reminder-intro">Choose when a secure sign-in link arrives in your inbox. A little progress, at a time that works for you.</p>
    {!email ? <p role="status">Sign in to your account to receive daily email reminders.</p> : loading ? <p role="status"><LoaderCircle size={16} className="spin" /> Loading your preferences…</p> : <>
      <fieldset className="reminder-fields" disabled={!ready || Boolean(busy)}>
        <label className="reminder-switch-row"><span><b>Daily email reminder</b><small>One email each day. Turn it off whenever you like.</small></span><button type="button" className="daily-toggle" role="switch" aria-label="Daily email reminder" aria-checked={preferences.enabled} onClick={() => setPreferences(value => ({ ...value, enabled: !value.enabled }))}><span /></button></label>
        <label className="field"><span>Delivery time</span><input type="time" value={preferences.delivery_time} onChange={event => setPreferences(value => ({ ...value, delivery_time: event.target.value }))} /></label>
        <label className="field"><span>Time zone</span><select value={preferences.time_zone} onChange={event => setPreferences(value => ({ ...value, time_zone: event.target.value }))}>{Array.from(new Set([...timeZones, preferences.time_zone])).sort().map(zone => <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>)}</select></label>
        <p className="todo-hint">We detected your time zone. Check it if you travel. Delivery follows local time and adjusts for daylight saving; inbox arrival may vary by a few minutes.</p>
        <div className="reminder-recipient"><Mail size={17} /><span>Send to <b>{email}</b></span></div>
        <div className="reminder-actions"><button className="primary" disabled={!ready || Boolean(busy) || !dirty} onClick={save}>{busy === 'save' ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Save preferences</button><button className="secondary" disabled={!ready || Boolean(busy)} onClick={test}>{busy === 'test' ? <LoaderCircle className="spin" size={16} /> : <Mail size={16} />}Send a test email</button></div>
      </fieldset>
      {saved?.enabled && saved.next_send_at && <p className="todo-hint">Next reminder: {new Date(saved.next_send_at).toLocaleString(undefined, { timeZone: saved.time_zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>}
    </>}
    {notice && <p className="reminder-notice" role="status">{notice}</p>}{error && <div className="reminder-error" role="alert"><p>{error}</p>{!ready && <button className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
    <p className="todo-hint">The email contains a sign-in link, never your private journal or task details. Each reminder includes a link to turn reminders off.</p>
  </section></div>
}
