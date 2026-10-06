import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Clock3, GripVertical, ListTodo, LoaderCircle, Plus, Sparkles, Sprout, Star, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDay, moveTodo, newTodo, type Todo, type TodoStore } from '../lib/todos'

export default function TodoLists({ store, onChange, dailyOnly }: { store: TodoStore; onChange: (value: TodoStore) => void; dailyOnly: boolean }) {
  const [draft, setDraft] = useState('')
  const [dailyDraft, setDailyDraft] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [today, setToday] = useState(localDay)
  const current = useRef(store)
  const mounted = useRef(true)
  current.current = store
  useEffect(() => {
    mounted.current = true
    const timer = window.setInterval(() => setToday(localDay()), 30000)
    const refresh = () => setToday(localDay())
    window.addEventListener('focus', refresh)
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  const updateList = (daily: boolean, items: Todo[]) => onChange({ ...store, [daily ? 'daily' : 'items']: items })
  const edit = (daily: boolean, id: string, patch: Partial<Todo>) => updateList(daily, (daily ? store.daily : store.items).map(item => item.id === id ? { ...item, ...patch } : item))
  const add = (daily: boolean) => {
    const text = (daily ? dailyDraft : draft).trim()
    if (!text) return
    updateList(daily, [...(daily ? store.daily : store.items), newTodo(text)])
    if (daily) setDailyDraft(''); else setDraft('')
  }
  const toggleDaily = () => onChange({ ...store, dailyEnabled: !store.dailyEnabled })
  const estimate = async () => {
    const snapshot = store.items.filter(item => !item.done)
    setLoading(true); setNotice('')
    try {
      const session = (await supabase?.auth.getSession())?.data.session
      if (!session) throw new Error('Sign in to use AI estimates.')
      const suggestions: { id: string; estimate: string; minutes: number | null }[] = []
      // Keep individual requests small while supporting a master list of any size.
      for (let offset = 0; offset < snapshot.length; offset += 20) {
        if (!mounted.current) return
        const batch = snapshot.slice(offset, offset + 20)
        const response = await fetch('/api/organize', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: 'estimates', items: batch.map(({ id, text }) => ({ id, text })) }),
        signal: AbortSignal.timeout(60000),
      })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'AI estimates are unavailable.')
        if (!Array.isArray(result.estimates) || result.estimates.length !== batch.length) throw new Error('AI returned incomplete estimates. Please try again.')
        suggestions.push(...result.estimates)
      }
      if (!mounted.current) return
      const latest = current.current
      const estimates = new Map(suggestions.map(item => [item.id, item]))
      const unchanged = new Map(snapshot.map(item => [item.id, item.text]))
      const originalEstimates = new Map(snapshot.map(item => [item.id, item.estimate]))
      const items = latest.items.map(item => {
        const suggestion = estimates.get(item.id)
        return suggestion && unchanged.get(item.id) === item.text && originalEstimates.get(item.id) === item.estimate ? { ...item, estimate: suggestion.estimate } : item
      })
      const minutes = (item: Todo) => unchanged.get(item.id) === item.text ? estimates.get(item.id)?.minutes ?? Infinity : Infinity
      items.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.priority) - Number(a.priority) || minutes(a) - minutes(b))
      onChange({ ...latest, items })
      setNotice('Estimates added. Your priorities come first, then shorter tasks. You can change the order or any estimate.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'AI estimates are unavailable. Your list is unchanged.') }
    finally { setLoading(false) }
  }

  const rows = (daily: boolean) => {
    const items = daily ? store.daily : store.items
    return <ul className="todo-rows">{items.map((item, index) => {
      const done = daily ? item.completedOn === today : item.done
      return <li key={item.id} className={`todo-row ${item.priority && !daily ? 'is-priority' : ''} ${done ? 'is-done' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); updateList(daily, moveTodo(items, id, item.id)) }}>
        <span className="todo-grip" draggable onDragStart={event => event.dataTransfer.setData('text/plain', item.id)} title="Drag to reorder"><GripVertical size={18} /></span>
        <input className="todo-check" type="checkbox" aria-label={`Complete ${item.text}`} checked={done} onChange={() => edit(daily, item.id, daily ? { completedOn: done ? '' : today } : { done: !done })} />
        <div className="todo-content"><input className="todo-text" aria-label={`Edit task ${index + 1}${daily ? ' daily' : ''}`} value={item.text} maxLength={500} onChange={event => edit(daily, item.id, { text: event.target.value, estimate: '' })} />{item.priority && !daily && <small className="priority-label">Top priority</small>}
          {!daily && <label className="todo-estimate"><Clock3 size={13} /><input aria-label={`Time estimate for ${item.text}`} placeholder="Add time estimate" maxLength={80} value={item.estimate} onChange={event => edit(false, item.id, { estimate: event.target.value })} /></label>}
        </div>
        <div className="todo-tools">{!daily && <button className={`todo-star ${item.priority ? 'selected' : ''}`} aria-label={`Top priority: ${item.text}`} aria-pressed={item.priority} disabled={!item.priority && store.items.filter(task => task.priority).length >= 3} onClick={() => edit(false, item.id, { priority: !item.priority })}><Star size={18} fill={item.priority ? 'currentColor' : 'none'} /></button>}
          <button aria-label={`Move ${item.text} up`} disabled={index === 0} onClick={() => updateList(daily, moveTodo(items, item.id, items[index - 1].id))}><ArrowUp size={15} /></button>
          <button aria-label={`Move ${item.text} down`} disabled={index === items.length - 1} onClick={() => updateList(daily, moveTodo(items, item.id, items[index + 1].id))}><ArrowDown size={15} /></button>
          <button aria-label={`Delete ${item.text}`} onClick={() => updateList(daily, items.filter(task => task.id !== item.id))}><Trash2 size={15} /></button>
        </div>
      </li>
    })}</ul>
  }
  const dailyCard = <section className="todo-card daily-card">
    <div className="todo-heading"><div><span className="kicker"><Sprout size={15} /> A little every day</span><h2>Daily to do list</h2></div><button className="daily-toggle" role="switch" aria-label="Enable daily to do list" aria-checked={store.dailyEnabled} onClick={toggleDaily}><span /></button></div>
    <p className="todo-intro">Small wins can make the next step feel more manageable. Dopamine plays a role in reward learning and motivation. Small, achievable actions give you a clear way to see progress, and repeating them in the same context helps build habits.</p>
    <p className="kaizen-note">Kaizen is about small, continuous improvements. Make the bed, stretch, drink water—then take one small step toward the bigger things.</p>
    <details className="todo-science"><summary>Why small steps help</summary><p>A simple action gives you a clear place to start. Try attaching it to something you already do, such as stretching after brushing your teeth.</p><a href="https://discovery.ucl.ac.uk/id/eprint/10118622/" target="_blank" rel="noreferrer">Research on repetition and habits</a><a href="https://doi.org/10.1073/pnas.1014269108" target="_blank" rel="noreferrer">Research on dopamine and reward learning</a></details>
    {store.dailyEnabled ? <><span className="daily-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · {store.daily.filter(item => item.completedOn === today).length}/{store.daily.length} done</span>{rows(true)}
      {!store.daily.length && <div className="daily-suggestions"><p>Start with something small</p>{['Make the bed', 'Stretch for 5 minutes', 'Drink water'].map(text => <button key={text} onClick={() => updateList(true, [...store.daily, newTodo(text)])}><Plus size={14} />{text}</button>)}</div>}
      <form className="todo-add" onSubmit={event => { event.preventDefault(); add(true) }}><input aria-label="New daily task" placeholder="Add a small daily action…" value={dailyDraft} maxLength={500} onChange={event => setDailyDraft(event.target.value)} /><button className="primary" disabled={!dailyDraft.trim()}><Plus size={17} /><span>Add</span></button></form><small className="todo-hint">Checkmarks start fresh each day. Your habits stay on the list.</small></> : <p className="todo-hint">Turn this on to add a daily tab and build your own repeatable checklist. Turning it off keeps your habits saved.</p>}
  </section>

  if (dailyOnly) return <div className="todo-layout daily-only">{dailyCard}</div>
  return <div className={`todo-layout ${store.dailyEnabled ? 'with-daily' : ''}`}>
    <section className="todo-card master-card"><div className="todo-heading"><div><span className="kicker"><ListTodo size={15} /> Make room for your goals</span><h2>Ultimate to do list</h2></div><span className="todo-count"><Check size={13} />{store.items.filter(item => item.done).length}/{store.items.length}</span></div>
      <p className="todo-intro">Write down everything you want to do, big or small. Goals give your effort direction, and keeping them here helps you choose your next small step.</p>
      <form className="todo-add" onSubmit={event => { event.preventDefault(); add(false) }}><input aria-label="New task" placeholder="What do you want to do?" value={draft} maxLength={500} onChange={event => setDraft(event.target.value)} /><button className="primary" disabled={!draft.trim()}><Plus size={17} /><span>Add task</span></button></form>
      <div className="todo-ai"><button className="secondary" disabled={loading || !consent || !store.items.some(item => !item.done)} onClick={estimate}>{loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{loading ? 'Estimating…' : 'AI sort & estimate'}</button><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Use Gemini to estimate these tasks <small>Sends task names to Google. The free service may use them to improve its products.</small></span></label></div>
      {notice && <p className="todo-notice" role="status">{notice}</p>}
      <div className="todo-list-heading"><b>Everything you want to do</b><span>{store.items.filter(item => item.priority).length}/3 priorities</span></div>
      {rows(false)}{!store.items.length && <div className="todo-empty"><ListTodo size={30} /><h3>Start with what’s on your mind</h3><p>A phone call, a project, a dream. Add your first task above.</p></div>}
      <p className="todo-hint">Drag to reorder, or use the arrows. Star up to 3 items to mark them red as top priorities.</p><p className="todo-hint">AI times estimate effort, not deadlines. Adjust them to your pace; bigger goals may take many sessions.</p>
    </section>{dailyCard}
  </div>
}
