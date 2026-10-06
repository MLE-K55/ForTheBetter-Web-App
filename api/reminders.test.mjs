import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import handler from './reminders.mjs'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), user: { id: '12345678-1234-1234-1234-123456789abc', email: 'me@example.com', email_confirmed_at: '2026-01-01' }, settings: null, deliveries: new Map(), testAllowed: true, due: [], generate: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
function builder(table) {
  let operation = 'read', value, fields, filters = {}
  const chain = {
    select(names) { fields = names; return chain }, eq(key, val) { filters[key] = val; return chain },
    upsert(input) { operation = 'upsert'; value = input; return chain }, update(input) { operation = 'update'; value = input; return chain },
    single() { return execute() }, maybeSingle() { return execute() }, then(resolve, reject) { return execute().then(resolve, reject) },
  }
  async function execute() {
    if (table === 'email_reminder_preferences') {
      if (operation === 'upsert') mocks.settings = { ...mocks.settings, ...value }
      if (operation === 'update') mocks.settings = { ...mocks.settings, ...value }
      const data = mocks.settings && Object.fromEntries(Object.entries(mocks.settings).filter(([key]) => !fields || fields.split(',').includes(key)))
      return { data, error: null }
    }
    const id = value?.user_id || filters.user_id, date = value?.local_date || filters.local_date
    const key = `${id}-${date}`
    if (operation === 'upsert' && !mocks.deliveries.has(key)) mocks.deliveries.set(key, { ...value, status: 'pending', login_token: null })
    if (operation === 'update') mocks.deliveries.set(key, { ...mocks.deliveries.get(key), ...value })
    return { data: mocks.deliveries.get(key), error: null }
  }
  return chain
}
const admin = {
  auth: { getUser: vi.fn(async () => ({ data: { user: mocks.user }, error: null })), admin: {
    getUserById: vi.fn(async () => ({ data: { user: mocks.user }, error: null })), generateLink: mocks.generate,
  } }, from: vi.fn(builder), rpc: vi.fn(async name => ({ data: name === 'claim_email_reminders' ? mocks.due : mocks.testAllowed, error: null })),
}
beforeEach(() => {
  mocks.settings = null; mocks.deliveries.clear(); mocks.testAllowed = true; mocks.due = []
  mocks.createClient.mockReturnValue(admin)
  mocks.generate.mockResolvedValue({ data: { properties: { hashed_token: 'private-login-token' } }, error: null })
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-key'); vi.stubEnv('REMINDER_APP_URL', 'https://journal.example.com')
  vi.stubEnv('RESEND_API_KEY', 'email-key'); vi.stubEnv('REMINDER_FROM_EMAIL', 'journal@example.com'); vi.stubEnv('CRON_SECRET', 'a'.repeat(40))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })
async function call(action = 'settings', method = 'GET', body, query = {}, auth = 'Bearer user-token') {
  const response = { status: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), send: vi.fn() }
  await handler({ method, query: { action, ...query }, body, headers: { authorization: auth } }, response)
  return { status: response.status.mock.calls[0][0], body: response.send.mock.calls[0][0] }
}
it('rejects unauthorized scheduler invocations and missing user sessions', async () => {
  expect((await call('run', 'POST')).status).toBe(401)
  expect((await call('settings', 'GET', undefined, {}, '')).status).toBe(401)
  expect(admin.rpc).not.toHaveBeenCalled()
})
it('truthfully reports unavailable delivery when configuration is missing', async () => {
  vi.stubEnv('RESEND_API_KEY', '')
  const result = await call()
  expect(JSON.parse(result.body).ready).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})
it('saves only the authenticated account and ignores supplied recipient or user id', async () => {
  const result = await call('settings', 'POST', { enabled: true, delivery_time: '07:00', time_zone: 'America/Chicago', user_id: 'someone-else', email: 'someone-else@example.com' })
  expect(result.status).toBe(200)
  expect(mocks.settings.user_id).toBe(mocks.user.id)
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects invalid time zones instead of scheduling the wrong time', async () => {
  expect((await call('settings', 'POST', { enabled: true, delivery_time: '07:00', time_zone: 'not-a-zone' })).status).toBe(400)
})
it('sends test mail only to the signed-in account and rate limits tests durably', async () => {
  expect((await call('test', 'POST', { email: 'other@example.com' })).status).toBe(200)
  const sent = JSON.parse(fetch.mock.calls[0][1].body)
  expect(sent.to).toEqual([mocks.user.email])
  expect(sent.html).toContain('#reminder_token=private-login-token')
  expect(sent.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  mocks.testAllowed = false
  expect((await call('test', 'POST', {})).status).toBe(429)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('email scanners can open unsubscribe links without disabling reminders', async () => {
  const token = createHmac('sha256', 'a'.repeat(40)).update(`daily-reminder-unsubscribe:${mocks.user.id}`).digest('hex')
  mocks.settings = { enabled: true }
  expect((await call('unsubscribe', 'GET', undefined, { user: mocks.user.id, token })).status).toBe(200)
  expect(mocks.settings.enabled).toBe(true)
  expect((await call('unsubscribe', 'POST', {}, { user: mocks.user.id, token })).status).toBe(200)
  expect(mocks.settings.enabled).toBe(false)
  expect((await call('unsubscribe', 'POST', {}, { user: mocks.user.id, token: 'forged' })).status).toBe(400)
})
it('repeated scheduled invocations cannot send a second email on the same local day', async () => {
  mocks.settings = { user_id: mocks.user.id, enabled: true, delivery_time: '07:00', time_zone: 'America/Chicago', updated_at: 'stable' }
  mocks.due = [mocks.settings]
  expect((await call('run', 'POST', {}, {}, `Bearer ${'a'.repeat(40)}`)).status).toBe(200)
  expect((await call('run', 'POST', {}, {}, `Bearer ${'a'.repeat(40)}`)).status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(mocks.generate).toHaveBeenCalledTimes(1)
})
it('does not send if a user disables reminders after the worker claims them', async () => {
  mocks.due = [{ user_id: mocks.user.id, enabled: true, delivery_time: '07:00', time_zone: 'America/Chicago', updated_at: 'old' }]
  mocks.settings = { enabled: false, updated_at: 'new' }
  await call('run', 'POST', {}, {}, `Bearer ${'a'.repeat(40)}`)
  expect(fetch).not.toHaveBeenCalled()
})
