import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import handler from './organize.mjs'

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon')
  vi.stubEnv('GEMINI_API_KEY', 'test-server-key')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
async function request(body, estimates) {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: crypto.randomUUID() }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ estimates }) }] } }] }) })
  vi.stubGlobal('fetch', fetch)
  const response = { status: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), send: vi.fn() }
  await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body }, response)
  return { response, fetch, result: JSON.parse(response.send.mock.calls[0][0]) }
}
it('returns validated estimates for each original task id', async () => {
  const estimates = [{ id: 'a', estimate: '10–20 min', minutes: 15 }, { id: 'b', estimate: 'Ongoing', minutes: null }]
  const { result, response } = await request({ mode: 'estimates', items: [{ id: 'a', text: 'Book appointment' }, { id: 'b', text: 'Learn Spanish' }] }, estimates)
  expect(response.status).toHaveBeenCalledWith(200)
  expect(result.estimates).toEqual(estimates)
})
it('rejects malformed requests before sending task data to Gemini', async () => {
  const { response, fetch } = await request({ mode: 'estimates', items: [{ id: 'a', text: '' }] }, [])
  expect(response.status).toHaveBeenCalledWith(400)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('rejects fabricated ids and incomplete model responses', async () => {
  const { response } = await request({ mode: 'estimates', items: [{ id: 'a', text: 'Book appointment' }] }, [{ id: 'invented', estimate: '5 min', minutes: 5 }])
  expect(response.status).toHaveBeenCalledWith(502)
})
