const usage = new Map()
const MAX_REQUESTS_PER_HOUR = 10

function json(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', 'no-store').send(JSON.stringify(body))
}

async function authenticatedUser(token) {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey || !token) return null
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
  if (!authResponse.ok) return null
  return authResponse.json()
}

function withinLimit(userId) {
  const now = Date.now()
  const current = usage.get(userId)
  if (!current || now - current.startedAt > 3_600_000) {
    usage.set(userId, { count: 1, startedAt: now })
    return true
  }
  if (current.count >= MAX_REQUESTS_PER_HOUR) return false
  current.count += 1
  return true
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' })
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const user = await authenticatedUser(token)
  if (!user?.id) return json(response, 401, { error: 'Please sign in again before using AI.' })
  if (!withinLimit(user.id)) return json(response, 429, { error: 'AI limit reached for this hour.' })

  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
  const mode = request.body?.mode === 'tasks' ? 'tasks' : 'summary'
  if (!text || text.length > 12000) return json(response, 400, { error: 'Brain dump must be between 1 and 12,000 characters.' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return json(response, 503, { error: 'AI has not been connected yet.' })

  const instruction = mode === 'summary'
    ? 'Summarize the main themes with warmth and clarity in 2-4 concise sentences. Return no tasks unless the text contains an unmistakable commitment.'
    : 'Extract only genuine, concrete action items. Rewrite each as a short verb-led task. Do not turn feelings, worries, or observations into tasks.'
  const prompt = `You organize a private journal brain dump without judging, diagnosing, giving therapy, or inventing details. ${instruction}\n\nReturn valid JSON only with this exact shape: {"content":"brief helpful overview","tasks":["task"]}.\n\nBRAIN DUMP:\n${text}`

  try {
    const gemini = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 900 } }),
    })
    if (!gemini.ok) return json(response, 502, { error: 'Gemini could not organize this right now.' })
    const data = await gemini.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(raw || '{}')
    return json(response, 200, { content: String(parsed.content || ''), tasks: Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 20).map(String) : [] })
  } catch {
    return json(response, 502, { error: 'AI organization failed safely.' })
  }
}
