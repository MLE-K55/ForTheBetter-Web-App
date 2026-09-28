import { useEffect, useRef, useState } from 'react'
import { Brain, Check, ListTodo, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { JournalAnswers, SavedEntry } from '../types'

type OrganizeMode = 'summary' | 'tasks'
interface OrganizedResult { content: string; tasks: string[]; source: 'ai' | 'device' }

function linesFrom(text: string) {
  return text.split(/\n|[.!?]+\s+/).map(line => line.replace(/^\s*[-*\d.)]+\s*/, '').trim()).filter(Boolean)
}

function organizeOnDevice(text: string, mode: OrganizeMode): OrganizedResult {
  const lines = linesFrom(text)
  if (mode === 'summary') {
    const summary = lines.slice(0, 3).join('. ')
    return { content: summary ? `${summary}${/[.!?]$/.test(summary) ? '' : '.'}` : '', tasks: [], source: 'device' }
  }
  const actionPattern = /\b(call|email|text|ask|buy|bring|book|clean|complete|contact|do|finish|fix|get|make|pay|plan|remember|schedule|send|start|submit|talk|update|write)\b/i
  const likelyTasks = lines.filter(line => actionPattern.test(line))
  return { content: likelyTasks.length ? 'Here are the things you may need to do.' : 'I did not see any clear tasks, so I listed each thought in case you want to do something with it.', tasks: (likelyTasks.length ? likelyTasks : lines).slice(0, 12), source: 'device' }
}

async function organizeWithAI(text: string, mode: OrganizeMode): Promise<OrganizedResult> {
  const session = (await supabase?.auth.getSession())?.data.session
  if (!session) throw new Error('You need to be signed in to use AI.')
  const response = await fetch('/api/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text, mode }),
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'AI organization is unavailable.')
  const result = await response.json()
  return { content: String(result.content || ''), tasks: Array.isArray(result.tasks) ? result.tasks.map(String) : [], source: 'ai' }
}

export default function BrainDump({ entry, onSave }: { entry?: SavedEntry; onSave: (answers: JournalAnswers) => void }) {
  const [draft, setDraft] = useState(String(entry?.answers.draft || ''))
  const [content, setContent] = useState(String(entry?.answers.organized || ''))
  const [tasks, setTasks] = useState<string[]>(Array.isArray(entry?.answers.tasks) ? entry.answers.tasks.map(String) : [])
  const [checked, setChecked] = useState<boolean[]>(Array.isArray(entry?.answers.checked) ? entry.answers.checked.map(value => value === 'true') : [])
  const [source, setSource] = useState<'ai' | 'device' | ''>((entry?.answers.source as 'ai' | 'device') || '')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState<OrganizeMode | null>(null)
  const [notice, setNotice] = useState('')
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current || !entry) return
    setDraft(String(entry.answers.draft || ''))
    setContent(String(entry.answers.organized || ''))
    setTasks(Array.isArray(entry.answers.tasks) ? entry.answers.tasks.map(String) : [])
    setChecked(Array.isArray(entry.answers.checked) ? entry.answers.checked.map(value => value === 'true') : [])
    setSource((entry.answers.source as 'ai' | 'device') || '')
    hydrated.current = true
  }, [entry])

  useEffect(() => {
    const timer = window.setTimeout(() => onSave({ draft, organized: content, tasks, checked: checked.map(String), source }), 500)
    return () => window.clearTimeout(timer)
  }, [draft, content, tasks, checked, source, onSave])

  const applyResult = (result: OrganizedResult) => {
    setContent(result.content); setTasks(result.tasks); setChecked(result.tasks.map(() => false)); setSource(result.source)
  }

  const organize = async (mode: OrganizeMode, useAI: boolean) => {
    if (!draft.trim()) return
    setLoading(mode); setNotice('')
    if (!useAI) { applyResult(organizeOnDevice(draft, mode)); setLoading(null); return }
    try { applyResult(await organizeWithAI(draft, mode)) }
    catch (error) {
      applyResult(organizeOnDevice(draft, mode))
      setNotice(`${error instanceof Error ? error.message : 'AI is unavailable'} I organized it privately on this device instead.`)
    } finally { setLoading(null) }
  }

  return <section className="brain-panel">
    <div className="brain-heading"><div><span className="kicker"><Brain size={15} /> Get it out of your head</span><h2>Brain Dump</h2><p>Write whatever is on your mind. It does not need to be neat or make sense. Just get it all out.</p></div><span className="autosave-badge"><Check size={13} /> Saved</span></div>
    <label className="brain-input"><span>What is taking up space in your head?</span><textarea rows={13} value={draft} maxLength={12000} placeholder="Appointments, worries, ideas, things to remember, conversations to have… dump it all here." onChange={event => setDraft(event.target.value)} /><small>{draft.length.toLocaleString()} / 12,000 characters</small></label>
    <div className="organize-card">
      <div><span className="kicker"><Sparkles size={14} /> Sort it out</span><h3>Organize your thoughts</h3><p>You can organize it on your device or let AI give you a summary or a list of things to do.</p></div>
      <div className="local-actions"><button disabled={!draft.trim() || Boolean(loading)} onClick={() => organize('summary', false)}>Quick summary on this device</button><button disabled={!draft.trim() || Boolean(loading)} onClick={() => organize('tasks', false)}><ListTodo size={16} /> Find tasks on this device</button></div>
      <label className="ai-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span><b>Use Google Gemini for this</b><small>This sends your brain dump to Google. Google may use information sent through the free version to improve its products. Do not include anything you do not want to share.</small></span></label>
      <div className="ai-actions"><button disabled={!draft.trim() || !consent || Boolean(loading)} onClick={() => organize('summary', true)}>{loading === 'summary' ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} AI summary</button><button disabled={!draft.trim() || !consent || Boolean(loading)} onClick={() => organize('tasks', true)}>{loading === 'tasks' ? <LoaderCircle className="spin" size={17} /> : <ListTodo size={17} />} AI task list</button></div>
      <p className="privacy-line"><ShieldCheck size={15} /> Nothing goes to AI unless you check the box and choose one of the AI buttons.</p>
      {notice && <p className="brain-notice">{notice}</p>}
    </div>
    {(content || tasks.length > 0) && <div className="organized-card">
      <div className="organized-heading"><div><span className="kicker">{source === 'ai' ? 'Organized with Gemini' : 'Organized on this device'}</span><h3>{tasks.length ? 'Your next steps' : 'The main idea'}</h3></div><button onClick={() => { setContent(''); setTasks([]); setChecked([]); setSource('') }}>Clear result</button></div>
      {content && <p>{content}</p>}
      {tasks.length > 0 && <ul className="task-list">{tasks.map((task, index) => <li key={`${task}-${index}`}><label><input type="checkbox" checked={Boolean(checked[index])} onChange={() => setChecked(previous => { const next = [...previous]; next[index] = !next[index]; return next })} /><span>{task}</span></label></li>)}</ul>}
    </div>}
  </section>
}
