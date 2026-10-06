import { useEffect, useRef, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { GoalStep, Todo } from '../lib/todos'

export default function GoalSteps({ task, onChange }: { task: Todo; onChange: (steps: GoalStep[]) => void }) {
  const [draft, setDraft] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [source, setSource] = useState('')
  const latest = useRef(task)
  latest.current = task
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const steps = task.steps || []
  async function suggest() {
    setBusy(true); setError(''); setSuggestions([])
    const goal = task.text
    try {
      const session = (await supabase?.auth.getSession())?.data.session
      if (!session) throw new Error('Sign in to use AI suggestions.')
      const response = await fetch('/api/organize', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ mode: 'steps', text: goal }), signal: AbortSignal.timeout(60000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'AI suggestions are unavailable.')
      if (!Array.isArray(result.steps) || !result.steps.length || result.steps.length > 6 || result.steps.some((step: unknown) => typeof step !== 'string' || !step.trim() || step.length > 500)) throw new Error('AI returned invalid steps. Please try again.')
      if (!alive.current) return
      if (latest.current.text !== goal) throw new Error('Your goal changed. Request fresh suggestions for the updated goal.')
      setSource(goal); setSuggestions(result.steps)
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Could not suggest steps.') }
    finally { if (alive.current) setBusy(false) }
  }
  return <details className="goal-steps"><summary>Small steps · {steps.filter(step => step.done).length}/{steps.length}</summary>
    <p className="todo-hint">Give your goal somewhere to start. Try a step you can do in five minutes.</p>
    <ul>{steps.map(step => <li key={step.id}><input type="checkbox" aria-label={`Complete step ${step.text}`} checked={step.done} onChange={() => onChange(steps.map(item => item.id === step.id ? { ...item, done: !item.done } : item))} /><input aria-label={`Edit step ${step.text}`} value={step.text} maxLength={500} onChange={event => onChange(steps.map(item => item.id === step.id ? { ...item, text: event.target.value } : item))} /><button type="button" aria-label={`Remove step ${step.text}`} onClick={() => onChange(steps.filter(item => item.id !== step.id))}>×</button></li>)}</ul>
    <div className="step-add"><input aria-label={`New step for ${task.text}`} value={draft} maxLength={500} placeholder="Practice for five minutes…" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (draft.trim()) { onChange([...steps, { id: crypto.randomUUID(), text: draft.trim(), done: false }]); setDraft('') } } }} /><button type="button" disabled={!draft.trim()} onClick={() => { onChange([...steps, { id: crypto.randomUUID(), text: draft.trim(), done: false }]); setDraft('') }}><Plus size={14} /> Add step</button></div>
    <label className="step-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Send this goal to Google Gemini for step suggestions. Its free service may use it to improve products.</label>
    <button type="button" className="secondary" disabled={!consent || busy || !task.text.trim()} onClick={suggest}><Sparkles size={14} />{busy ? 'Suggesting…' : 'Suggest small steps'}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {suggestions.length > 0 && <section className="step-review" aria-label="Review suggested steps"><h4>Review and edit before adding</h4>{suggestions.map((text, index) => <div className="step-add" key={index}><input aria-label={`Suggested step ${index + 1}`} maxLength={500} value={text} onChange={event => setSuggestions(previous => previous.map((item, position) => position === index ? event.target.value : item))} /><button type="button" aria-label={`Discard suggestion ${index + 1}`} onClick={() => setSuggestions(previous => previous.filter((_, position) => position !== index))}>×</button></div>)}<button type="button" className="primary" disabled={task.text !== source || !suggestions.some(text => text.trim())} onClick={() => { onChange([...(latest.current.steps || []), ...suggestions.filter(text => text.trim()).map(text => ({ id: crypto.randomUUID(), text: text.trim(), done: false }))]); setSuggestions([]) }}>Add reviewed steps</button><button type="button" className="secondary" onClick={() => setSuggestions([])}>Discard all</button>{task.text !== source && <p role="status">Your goal changed. Request fresh suggestions.</p>}</section>}
  </details>
}
