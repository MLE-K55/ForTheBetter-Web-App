import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { nextReminder, validSchedule, zonedClock } from './_lib/reminder-time.mjs'

export const config = { maxDuration: 60 }
const preferenceFields = 'enabled,delivery_time,time_zone,next_send_at,last_sent_date,updated_at'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function json(res, status, body) {
  return res.status(status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', 'no-store').send(JSON.stringify(body))
}
function configuration() {
  const { VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, REMINDER_APP_URL: appUrl, RESEND_API_KEY: emailKey, REMINDER_FROM_EMAIL: from, CRON_SECRET: secret } = process.env
  if (!url || !key || !appUrl || !emailKey || !from || !secret || secret.length < 32) return null
  try { if (new URL(appUrl).protocol !== 'https:') return null } catch { return null }
  return { url, key, appUrl: appUrl.replace(/\/$/, ''), emailKey, from, secret }
}
function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
function unsubscribeToken(userId, secret) { return createHmac('sha256', secret).update(`daily-reminder-unsubscribe:${userId}`).digest('hex') }
function escape(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]) }
function htmlPage(res, status, title, body) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  res.setHeader('Referrer-Policy', 'no-referrer')
  return res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'no-store').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{font:16px system-ui;background:#eef8f3;color:#173d3a;padding:24px}main{max-width:480px;margin:12vh auto;background:white;padding:32px;border-radius:22px}p{line-height:1.6}button,a{color:inherit}button{padding:13px 20px;border:0;border-radius:12px;background:#173d3a;color:white;cursor:pointer}</style></head><body><main><h1>${escape(title)}</h1>${body}</main></body></html>`)
}
async function sendEmail(admin, config, user, delivery, key, test = false) {
  let token = delivery?.login_token
  if (!token) {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
    if (error || !data?.properties?.hashed_token) throw new Error('Could not generate a sign-in link.')
    token = data.properties.hashed_token
    if (delivery) {
      const { error: persistError } = await admin.from('email_reminder_deliveries').update({ login_token: token }).eq('user_id', user.id).eq('local_date', delivery.local_date)
      if (persistError) throw persistError
    }
  }
  const login = `${config.appUrl}/#reminder_token=${encodeURIComponent(token)}`
  const unsubscribe = `${config.appUrl}/api/reminders?action=unsubscribe&user=${encodeURIComponent(user.id)}&token=${unsubscribeToken(user.id, config.secret)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${config.emailKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from: config.from, to: [user.email], subject: test ? 'Your For The Better test reminder' : 'A little progress every day — your journal is ready',
      html: `<div style="font:16px system-ui;max-width:520px;margin:auto;padding:32px;color:#173d3a"><p>FOR THE BETTER</p><h1>A little progress every day.</h1><p>Your journal is ready. Take a moment for yourself and choose one small step.</p><p><a style="display:inline-block;padding:14px 22px;background:#173d3a;color:white;border-radius:12px;text-decoration:none" href="${escape(login)}">Open my journal</a></p><p>This secure sign-in link is for you. If it expires, you can request a fresh link in the app.</p><p style="font-size:12px">You chose daily reminders. <a href="${escape(unsubscribe)}">Turn off daily reminders</a>, or change your delivery time in the app.</p></div>`,
      text: `A little progress every day. Your journal is ready.\n\nOpen my journal: ${login}\n\nThis secure link is for you. If it expires, request a fresh link in the app.\n\nTurn off daily reminders: ${unsubscribe}`,
      headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  })
  if (!response.ok) throw new Error('The email service could not send this reminder.')
}
async function runScheduled(admin, config, res) {
  const { data: due, error } = await admin.rpc('claim_email_reminders', { batch_size: 20 })
  if (error) return json(res, 503, { error: 'Reminder scheduling is unavailable.' })
  let sent = 0, failed = 0
  const started = Date.now()
  for (const preference of due || []) {
    if (Date.now() - started > 40000) break
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(preference.user_id)
      const user = userData?.user
      if (userError || !user?.email || !user.email_confirmed_at || user.banned_until && new Date(user.banned_until) > new Date()) throw new Error('Account unavailable.')
      // Recheck opt-in after claiming, since the user may have disabled reminders.
      const { data: latest, error: readError } = await admin.from('email_reminder_preferences').select('enabled,updated_at').eq('user_id', user.id).single()
      if (readError) throw readError
      if (!latest.enabled || latest.updated_at !== preference.updated_at) {
        await admin.from('email_reminder_preferences').update({ lease_until: null }).eq('user_id', user.id)
        continue
      }
      const now = new Date(), date = zonedClock(now, preference.time_zone).date
      const { error: insertError } = await admin.from('email_reminder_deliveries').upsert({ user_id: user.id, local_date: date }, { onConflict: 'user_id,local_date', ignoreDuplicates: true })
      if (insertError) throw insertError
      const { data: delivery, error: deliveryError } = await admin.from('email_reminder_deliveries').select('local_date,login_token,status').eq('user_id', user.id).eq('local_date', date).single()
      if (deliveryError) throw deliveryError
      if (delivery.status !== 'sent') {
        await sendEmail(admin, config, user, delivery, `daily-${user.id}-${date}`)
        const { error: markError } = await admin.from('email_reminder_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), login_token: null }).eq('user_id', user.id).eq('local_date', date)
        if (markError) throw markError
        sent++
      }
      const { error: scheduleError } = await admin.from('email_reminder_preferences').update({ next_send_at: nextReminder(preference.delivery_time, preference.time_zone, now, date), last_sent_date: date, lease_until: null }).eq('user_id', user.id).eq('updated_at', preference.updated_at)
      if (scheduleError) throw scheduleError
    } catch { failed++ /* The lease expires, allowing a safe retry with the same provider idempotency key. */ }
    // Resend's default API limit is two requests per second.
    await new Promise(resolve => setTimeout(resolve, 550))
  }
  return json(res, failed ? 207 : 200, { sent, failed, processed: due?.length || 0 })
}
export default async function handler(req, res) {
  const config = configuration()
  const action = req.query?.action || 'settings'
  if (action === 'run') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
    if (!config || !secureEqual(req.headers.authorization, `Bearer ${config.secret}`)) return json(res, 401, { error: 'Unauthorized.' })
    return runScheduled(createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } }), config, res)
  }
  if (action === 'unsubscribe') {
    const userId = req.query?.user, token = req.query?.token
    if (!config || !uuid.test(userId || '') || !secureEqual(token, unsubscribeToken(userId, config.secret))) return htmlPage(res, 400, 'Link unavailable', '<p>Open the app to change your reminder settings.</p>')
    if (req.method === 'GET') return htmlPage(res, 200, 'Turn off daily reminders?', `<p>Your journal and tasks will stay saved.</p><form method="post" action="/api/reminders?action=unsubscribe&amp;user=${escape(userId)}&amp;token=${escape(token)}"><button>Turn off daily reminders</button></form>`)
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
    const admin = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.from('email_reminder_preferences').update({ enabled: false, next_send_at: null, lease_until: null, updated_at: new Date().toISOString() }).eq('user_id', userId)
    return error ? htmlPage(res, 503, 'Please try again', '<p>Your preferences could not be saved.</p>') : htmlPage(res, 200, 'Daily reminders are off', `<p>You can turn them on again in the app whenever you like.</p><a href="${escape(config.appUrl)}">Open For The Better</a>`)
  }
  if (!['settings', 'test'].includes(action) || !['GET', 'POST'].includes(req.method) || action === 'test' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
  const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!url || !anon || !token) return json(res, 401, { error: 'Please sign in again.' })
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  const user = authData?.user
  if (authError || !user?.id || !user.email || !user.email_confirmed_at) return json(res, 401, { error: 'Please sign in with your verified email first.' })
  if (!config) return json(res, req.method === 'GET' ? 200 : 503, { ready: false, error: 'Daily emails are not available yet. Please try again later.' })
  const admin = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    if (action === 'test') {
      const { data: allowed, error } = await admin.rpc('claim_reminder_test', { target_user: user.id })
      if (error) throw error
      if (!allowed) return json(res, 429, { error: 'Please wait 10 minutes before sending another test email.' })
      await sendEmail(admin, config, user, null, `test-${user.id}-${Math.floor(Date.now() / 600000)}`, true)
      return json(res, 200, { message: 'Test email sent. Check your inbox and spam folder.' })
    }
    if (req.method === 'GET') {
      const { data, error } = await admin.from('email_reminder_preferences').select(preferenceFields).eq('user_id', user.id).maybeSingle()
      if (error) throw error
      return json(res, 200, { ready: true, preferences: data })
    }
    const { enabled, delivery_time: time, time_zone: zone } = req.body || {}
    if (typeof enabled !== 'boolean' || !validSchedule(time, zone)) return json(res, 400, { error: 'Choose a valid delivery time and time zone.' })
    const { data: previous, error: previousError } = await admin.from('email_reminder_preferences').select('last_sent_date').eq('user_id', user.id).maybeSingle()
    if (previousError) throw previousError
    const { data, error } = await admin.from('email_reminder_preferences').upsert({ user_id: user.id, enabled, delivery_time: time, time_zone: zone,
      next_send_at: enabled ? nextReminder(time, zone, new Date(), previous?.last_sent_date) : null,
      updated_at: new Date().toISOString(),
    }).select(preferenceFields).single()
    if (error) throw error
    return json(res, 200, { ready: true, preferences: data })
  } catch { return json(res, 503, { error: 'We could not complete that request. Please try again.' }) }
}
