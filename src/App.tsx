import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Bell, Download, Target, BookOpen, Bookmark, Brain, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, Flame, ListTodo, LockKeyhole, LogOut, MessageCircle, Palette, Settings2, Smartphone, Sparkles, Sprout, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import BrainDump from './components/BrainDump'
import TodoLists from './components/TodoLists'
import TodayFocus from './components/TodayFocus'
import { EntryQueue } from './lib/entry-sync'
import { downloadExport } from './lib/export'
import EmailReminders from './components/EmailReminders'
import ReminderSignIn from './components/ReminderSignIn'
import { readTodos, type TodoStore } from './lib/todos'
import { availabilityDay, journalPages, totalDays } from './data/journal'
import { getStartDate, loadFontMode, loadProgress, loadTheme, saveFontMode, saveProgress, saveTheme } from './lib/storage'
import { cloudConfigured, loadCloudProgress, saveCloudEntry, saveCloudProfile, supabase } from './lib/supabase'
import type { FontMode, JournalAnswers, JournalField, ProgressStore, SavedEntry, ThemeName } from './types'

const themes: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Pure white & black' },
  { id: 'dark', label: 'Dark', hint: 'Purple, grey & black' },
  { id: 'pastel', label: 'Pastel', hint: 'Candy fairy' },
  { id: 'hacker', label: 'Hacker', hint: 'Matrix green' },
  { id: 'gothic', label: 'Gothic', hint: 'Velvet & candlelight' },
  { id: 'zen', label: 'Zen', hint: 'Sage & clear water' },
]

const fontModes: { id: FontMode; label: string; hint: string }[] = [
  { id: 'default', label: 'Default', hint: 'Theme’s original type' },
  { id: 'adhd', label: 'ADHD friendly', hint: 'Lexend · open and steady' },
  { id: 'dyslexic', label: 'Dyslexia friendly', hint: 'Atkinson · distinct letters' },
]

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.every(item => String(item || '').trim().length > 0)
  return String(value || '').trim().length > 0
}

function Field({ field, value, onChange, checked = [], onCheck }: { field: JournalField; value: JournalAnswers[string]; onChange: (value: JournalAnswers[string]) => void; checked?: string[]; onCheck?: (value: string[]) => void }) {
  if (field.kind === 'date') return <label className="field"><span>{field.label}</span><input type="date" value={String(value || '')} onChange={e => onChange(e.target.value)} /></label>
  if (field.kind === 'checklist') {
    const values = Array.isArray(value) ? value : Array.from({ length: field.count || 3 }, () => '')
    return <fieldset className="field checklist"><legend>{field.label}</legend>{values.map((item, index) => <div key={index} className="check-row">{onCheck ? <input className="journal-task-check" type="checkbox" aria-label={`Complete ${field.label} item ${index + 1}`} checked={checked.includes(String(index))} onChange={e => onCheck(e.target.checked ? [...checked, String(index)] : checked.filter(id => id !== String(index)))} /> : <span className="check-box">{index + 1}</span>}<input aria-label={`${field.label} item ${index + 1}`} value={item} placeholder={`Item ${index + 1}`} onChange={e => { const next = [...values]; next[index] = e.target.value; onChange(next) }} /></div>)}</fieldset>
  }
  return <label className="field"><span>{field.label}</span><textarea rows={field.kind === 'text' ? 2 : 4} value={String(value || '')} placeholder="Write honestly…" onChange={e => onChange(e.target.value)} /></label>
}

function MyWhyFields({ fields, answers, onChange }: { fields: JournalField[]; answers: JournalAnswers; onChange: (fieldId: string, value: JournalAnswers[string]) => void }) {
  const renderField = (id: string) => {
    const field = fields.find(item => item.id === id)!
    return <Field key={id} field={field} value={answers[id]} onChange={value => onChange(id, value)} />
  }

  return <div className="why-workbook">
    <section className="why-section">
      <span className="why-step">01 · Start from within</span>
      <h3>This change has to be for you</h3>
      <p>If you are only changing to make someone else happy, it can be hard to stick with it once that pressure is gone. Research shows that change is more likely to last when the reason actually matters to you.</p>
      <p>You do not have to do it alone. The right people can support you, push you, and help you keep going. They just cannot be the only reason you are doing it.</p>
      <a className="research-link" href="https://pubmed.ncbi.nlm.nih.gov/31983293/" target="_blank" rel="noreferrer">Read more about the research <ExternalLink size={15} /></a>
      {renderField('team')}
    </section>
    <section className="why-section">
      <span className="why-step">02 · Know what you are moving away from</span>
      <h3>Who do you refuse to become?</h3>
      <p>Sometimes knowing who you do not want to become can motivate you. Be honest about that person and their traits. Then write the opposite so you know what kind of person you are trying to become.</p>
      {renderField('not-become')}
      {renderField('avoid-traits')}
      {renderField('desired-traits')}
    </section>
    <section className="why-section why-finale">
      <span className="why-step">03 · Make it yours</span>
      <h3>Now make it personal</h3>
      <p>The people on your team can walk beside you, but they cannot choose your life for you. The only person who can change you is you. The only person truly stopping you, is also you. In your own words why do you want to change? Before you begin to write set a timer for 3 minutes, close your eyes, and truly reflect and why you want to change. Envision yourself as the person you wish to be, why do you want to be them?</p>
      {renderField('personal-why')}
    </section>
  </div>
}

function App() {
  const [theme, setTheme] = useState<ThemeName>(loadTheme)
  const [fontMode, setFontMode] = useState<FontMode>(loadFontMode)
  const [progress, setProgress] = useState<ProgressStore>(loadProgress)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!cloudConfigured)
  const [authError, setAuthError] = useState('')
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [showTheme, setShowTheme] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [reminderToken, setReminderToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reminder_token') || '')
  const [showHelp, setShowHelp] = useState(false)
  const tutorialKey = `ftb-tutorial-v1:${user?.id || 'local'}`
  const closeHelp = useCallback(() => {
    try { localStorage.setItem(tutorialKey, 'seen') } catch { /* Tutorial remains usable without storage. */ }
    setShowHelp(false)
  }, [tutorialKey])
  useEffect(() => {
    if (!authReady || (cloudConfigured && (!user || loadedUserId !== user.id))) return
    try { if (!localStorage.getItem(tutorialKey) && Object.keys(latestProgress.current).length === 0) setShowHelp(true) } catch { setShowHelp(true) }
  }, [authReady, user, loadedUserId, tutorialKey])
  const [activeTab, setActiveTab] = useState<'focus' | 'journal' | 'brain' | 'journey' | 'todos' | 'daily'>('focus')
  const todos = useMemo(() => readTodos(progress['to-do-list']?.answers), [progress])
  const queue = useRef<EntryQueue | null>(null)
  const latestProgress = useRef(progress)
  latestProgress.current = progress
  const [waitingToSync, setWaitingToSync] = useState(false)
  const [deviceSaved, setDeviceSaved] = useState(true)
  const [exportError, setExportError] = useState('')
  const startDate = useMemo(getStartDate, [])
  const page = journalPages[pageIndex]
  const entry = progress[page.id]
  const answers = entry?.answers || {}
  const completedCount = journalPages.filter(item => progress[item.id]?.completed).length
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000))
  const timeUnlockedIndex = journalPages.reduce((latest, item, index) => availabilityDay(item) <= elapsedDays ? index : latest, 0)
  const maxUnlocked = Math.min(completedCount, timeUnlockedIndex, journalPages.length - 1)
  const percent = Math.round((completedCount / journalPages.length) * 100)
  const currentDay = journalPages.slice(0, maxUnlocked + 1).filter(item => item.day > 0 && item.day < 8).length || 1

  useEffect(() => {
    if (!user) { queue.current = null; return }
    let active = true
    const accountQueue = new EntryQueue(user.id, (id, value) => saveCloudEntry(user, id, value), (pending, durable) => {
      if (active) { setWaitingToSync(pending); setDeviceSaved(durable) }
    })
    queue.current = accountQueue
    setWaitingToSync(Boolean(Object.keys(accountQueue.pending).length))
    const retryOnline = () => { void accountQueue.flush() }
    window.addEventListener('online', retryOnline)
    return () => { active = false; window.removeEventListener('online', retryOnline) }
  }, [user])

  const persistEntry = useCallback((id: string, value: SavedEntry) => {
    const next = { ...latestProgress.current, [id]: value }
    latestProgress.current = next
    setProgress(next)
    if (user) queue.current?.add(id, value)
    else setDeviceSaved(saveProgress(next))
  }, [user])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.font = fontMode
    saveTheme(theme)
    saveFontMode(fontMode)
    if (user) void saveCloudProfile(user, theme, fontMode).catch(() => {
      setSaveError('Your appearance could not sync. Check your connection before leaving.')
    })
  }, [theme, fontMode, user])

  useEffect(() => {
    if (!supabase) return
    let active = true
    let receivedAuthEvent = false
    setAuthError('')
    const timeout = window.setTimeout(() => {
      if (active) setAuthError('Sign in is taking longer than expected. Check your connection and try again.')
    }, 15000)
    // Never await a Supabase request inside its auth callback: the auth lock
    // remains held until the callback returns. Load entries in a separate effect.
    const applyUser = (nextUser: User | null) => {
      if (!active) return
      window.clearTimeout(timeout)
      setUser(previous => previous?.id === nextUser?.id ? previous : nextUser)
      setAuthError('')
      setAuthReady(true)
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true
      applyUser(session?.user || null)
    })
    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active || receivedAuthEvent) return
      if (error) throw error
      applyUser(sessionData.session?.user || null)
    }).catch(() => {
      if (!active || receivedAuthEvent) return
      window.clearTimeout(timeout)
      setAuthError('We could not restore your sign in. Check your connection and try again.')
    })
    return () => {
      active = false
      window.clearTimeout(timeout)
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!cloudConfigured) return
    setProgress({})
    setLoadedUserId(null)
    setLoadError('')
    setSaveError('')
    setPageIndex(0)
    setActiveTab('focus')
    if (!user) return
    let active = true
    const timeout = window.setTimeout(() => {
      if (!active) return
      active = false
      setLoadError('Your saved journal is taking longer than expected to load. Please try again.')
    }, 15000)
    void loadCloudProgress(user).then(entries => {
      if (!active) return
      const restored = { ...entries, ...(queue.current?.userId === user.id ? queue.current.pending : {}) }
      latestProgress.current = restored
      setProgress(restored)
      setPageIndex(Math.min(journalPages.filter(item => restored[item.id]?.completed).length, journalPages.reduce((latest, item, index) => availabilityDay(item) <= Math.max(0, Math.floor((Date.now() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000)) ? index : latest, 0), journalPages.length - 1))
      setLoadedUserId(user.id)
      void queue.current?.flush()
    }).catch(() => {
      if (active) setLoadError('We could not load your saved journal. Check your connection and try again.')
    }).finally(() => window.clearTimeout(timeout))
    return () => { active = false; window.clearTimeout(timeout) }
  }, [user, retry, startDate])

  useEffect(() => {
    if (!showHelp) return
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('.help-modal')
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href]') || [])
    focusable()[0]?.focus()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0], last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      if (event.key === 'Escape') closeHelp()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = oldOverflow; previousFocus?.focus() }
  }, [showHelp, closeHelp])

  const updateAnswer = (fieldId: string, value: JournalAnswers[string]) => {
    const previous = latestProgress.current[page.id]
    persistEntry(page.id, { answers: { ...(previous?.answers || {}), [fieldId]: value }, completed: previous?.completed || false, completedAt: previous?.completedAt, updatedAt: new Date().toISOString() })
  }

  const canComplete = page.fields.filter(field => field.required).every(field => isFilled(answers[field.id]))
  const nextPageIsTimeLocked = pageIndex < journalPages.length - 1 && pageIndex + 1 > timeUnlockedIndex
  const nextUnlockDate = new Date(new Date(`${startDate}T00:00:00`).getTime() + availabilityDay(journalPages[Math.min(pageIndex + 1, journalPages.length - 1)]) * 86_400_000)

  const completePage = () => {
    if (!canComplete) return
    persistEntry(page.id, { answers, completed: true, completedAt: entry?.completedAt || new Date().toISOString(), updatedAt: new Date().toISOString() })
    if (pageIndex < journalPages.length - 1 && pageIndex + 1 <= timeUnlockedIndex) setPageIndex(pageIndex + 1)
  }

  const goToPage = (index: number) => {
    if (index <= maxUnlocked) {
      setPageIndex(index)
      setActiveTab('journal')
    }
  }

  const saveBrainDump = useCallback((brainAnswers: JournalAnswers) => {
    persistEntry('brain-dump', { answers: brainAnswers, completed: false, updatedAt: new Date().toISOString() })
  }, [persistEntry])

  const saveTodos = (store: TodoStore) => {
    if (!store.dailyEnabled && activeTab === 'daily') setActiveTab('todos')
    persistEntry('to-do-list', { answers: { list: JSON.stringify(store) }, completed: false, updatedAt: new Date().toISOString() })
  }
  const retrySave = () => {
    if (user) { void queue.current?.flush(); void saveCloudProfile(user, theme, fontMode).then(() => setSaveError('')).catch(() => setSaveError('Appearance is waiting to sync.')) }
    else setDeviceSaved(saveProgress(latestProgress.current))
  }
  const exportData = () => {
    try { downloadExport(latestProgress.current, theme, fontMode, startDate); setExportError('') }
    catch { setExportError('Could not download your data. Please try again.') }
  }

  // All hooks above must run on login, loading, and journal renders alike.
  if (reminderToken) return <ReminderSignIn token={reminderToken} onDone={() => setReminderToken('')} />
  if (authError) return <main className="loading-screen" role="alert"><p>{authError}</p><button className="primary" onClick={() => window.location.reload()}>Try again</button></main>
  if (!authReady) return <div className="loading-screen"><span className="brand-mark">FTB</span><p>Opening your private journal…</p></div>
  if (cloudConfigured && !user) return <AuthScreen />
  if (loadError) return <main className="loading-screen" role="alert"><p>{loadError}</p><button className="primary" onClick={() => setRetry(value => value + 1)}>Try again</button></main>
  if (user && loadedUserId !== user.id) return <div className="loading-screen"><p>Loading your saved journal…</p></div>

  const journalEditor = <article className="journal-card">
        <div className="journal-heading"><div><span className="kicker">{page.eyebrow}</span><h2>{page.title}</h2></div>{entry?.completed && <span className="done-badge"><Check size={15} /> Complete</span>}</div>
        {page.sourceStatus === 'draft' && <p className="draft-note">This heading came from the original book. These questions are still a draft because the source PDF repeats earlier pages.</p>}
        {page.quote && <blockquote>“{page.quote}”</blockquote>}
        {page.intro && <p className="intro">{page.intro}</p>}
        {page.id === 'week-1-my-why' ? <MyWhyFields fields={page.fields} answers={answers} onChange={updateAnswer} /> : <div className="fields">{page.fields.map(field => <Field key={field.id} field={field} value={answers[field.id]} onChange={value => updateAnswer(field.id, value)} checked={Array.isArray(answers[`${field.id}-checked`]) ? answers[`${field.id}-checked`] as string[] : []} onCheck={field.id === 'today' ? value => updateAnswer(`${field.id}-checked`, value) : undefined} />)}</div>}
        <div className="completion-note"><LockKeyhole size={17} /><span>{entry?.completed && nextPageIsTimeLocked ? `You are done for today. Your next page opens ${nextUnlockDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.` : 'Answer every required question to unlock the next page. New daily entries open on their scheduled day.'}</span></div>
        <div className="page-actions"><button className="secondary" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={18} /> Back</button><button className="primary" disabled={!canComplete || Boolean(entry?.completed && nextPageIsTimeLocked)} onClick={completePage}>{entry?.completed && nextPageIsTimeLocked ? 'Saved for today' : entry?.completed ? 'Continue' : 'Complete page'} <ChevronRight size={18} /></button></div>
      </article>

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-left"><button className="brand" onClick={() => setPageIndex(Math.min(pageIndex, maxUnlocked))} aria-label="For The Better home"><img className="brand-logo" src={`/logos/ftb-${theme}.png`} alt="" /><span><b>For The Better</b><small>Small steps. Real change.</small></span></button></div>
      <div className="header-actions"><button className="help-button" onClick={() => setShowHelp(true)} aria-label="Open help and app tips" aria-haspopup="dialog"><CircleHelp size={22} /></button><button className="icon-button" onClick={() => setShowReminders(true)} aria-label="Email reminders"><Bell size={20} /></button><button className="icon-button" onClick={() => setShowTheme(true)} aria-label="Choose appearance"><Palette size={20} /></button><button className="logout-button" onClick={() => user && supabase?.auth.signOut()}><LogOut size={16} /> Log out</button></div>
    </header>

    <main className={activeTab === 'todos' || activeTab === 'daily' || activeTab === 'focus' ? 'todo-main' : undefined}>
      <div className="save-status" role="status"><span>{user ? waitingToSync ? 'Waiting to sync' : 'Synced' : deviceSaved ? 'Saved on this device' : 'Not saved on this device'}{user && waitingToSync && deviceSaved ? ' · Changes kept on this device' : ''}</span>{(waitingToSync || !deviceSaved || saveError) && <button className="secondary" onClick={retrySave}>Retry saving</button>}</div>
      {!deviceSaved && <p className="form-error" role="alert">This browser could not keep a recovery copy. Keep the app open until synced, or download your data.</p>}
      {exportError && <p className="form-error" role="alert">{exportError}</p>}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <section className="progress-card">
        <div><span className="kicker"><Flame size={15} /> 9 week journey</span><h1>Day {Math.min(currentDay, totalDays)} of {totalDays}</h1><p>Started {new Date(`${startDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as React.CSSProperties}><span>{percent}%</span></div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      </section>

      <nav className="section-tabs" aria-label="Journal navigation"><button className={activeTab === 'focus' ? 'active' : ''} onClick={() => { setPageIndex(maxUnlocked); setActiveTab('focus') }}><Target size={18} /> Today’s focus</button><button className={activeTab === 'journal' ? 'active' : ''} onClick={() => setActiveTab('journal')}><BookOpen size={18} /> Journal</button><button className={activeTab === 'brain' ? 'active' : ''} onClick={() => setActiveTab('brain')}><Brain size={18} /> Brain Dump</button><button className={activeTab === 'journey' ? 'active' : ''} onClick={() => setActiveTab('journey')}><CalendarDays size={18} /> Journey</button><button className={activeTab === 'todos' ? 'active' : ''} onClick={() => setActiveTab('todos')}><ListTodo size={18} /> To do list</button>{todos.dailyEnabled && <button className={activeTab === 'daily' ? 'active' : ''} onClick={() => setActiveTab('daily')}><Sprout size={18} /> Daily to do list</button>}</nav>

      {activeTab === 'focus' ? <TodayFocus store={todos} onChange={saveTodos} journal={journalEditor} onOpenTasks={() => setActiveTab('todos')} /> : activeTab === 'todos' || activeTab === 'daily' ? <TodoLists key={user?.id || 'local'} store={todos} onChange={saveTodos} dailyOnly={activeTab === 'daily'} /> : activeTab === 'brain' ? <BrainDump entry={progress['brain-dump']} onSave={saveBrainDump} /> : activeTab === 'journey' ? <section className="journey-panel">
        <div className="section-heading"><div><span className="kicker">Your path</span><h2>Nine weeks, one day at a time</h2></div><Sparkles /></div>
        {Array.from({ length: 9 }, (_, weekIndex) => {
          const weekPages = journalPages.map((item, index) => ({ item, index })).filter(({ item }) => item.week === weekIndex + 1)
          const weekLesson = weekPages.find(({ item }) => item.id === `week-${weekIndex + 1}-lesson`)?.item || weekPages[0].item
          const done = weekPages.filter(({ item }) => progress[item.id]?.completed).length
          const unlocked = weekPages[0].index <= maxUnlocked
          return <article className={`week-card ${unlocked ? '' : 'locked'}`} key={weekIndex}>
            <button disabled={!unlocked} onClick={() => goToPage(weekPages.find(({ index }) => index <= maxUnlocked && !progress[journalPages[index].id]?.completed)?.index ?? weekPages[0].index)}>
              <span className="week-number">{unlocked ? weekIndex + 1 : <LockKeyhole size={18} />}</span><span><small>Week {weekIndex + 1}</small><b>{weekLesson.title}</b><em>{done} of {weekPages.length} complete</em></span><ChevronRight size={20} />
            </button>
          </article>
        })}
      </section> : journalEditor}
      <div className="back-to-top"><button className="secondary" onClick={() => { window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); document.querySelector<HTMLButtonElement>('.help-button')?.focus({ preventScroll: true }) }}><ArrowUp size={17} /> Back to top</button></div>
    </main>

    <footer>
      <div className="footer-details"><button onClick={exportData}><Download size={15} /> Download my data</button><span>{user ? 'Signed in · Your entries are private to your account.' : 'Prototype mode · Entries save privately on this device.'}</span><button onClick={() => setShowTheme(true)}><Settings2 size={15} /> Appearance</button></div>
      <div className="creator-watermark"><img src="/kq-logo-watermark.png" alt="KQ brand logo" /><span>Created by Killer_Queen55</span></div>
    </footer>
    {showReminders && <EmailReminders key={user?.id || 'local'} email={user?.email} onClose={() => setShowReminders(false)} />}

    {showTheme && <div className="modal-backdrop" onClick={() => setShowTheme(false)}><section className="theme-modal" onClick={event => event.stopPropagation()}><div className="section-heading"><div><span className="kicker">Make it yours</span><h2>Appearance</h2></div><button className="icon-button" onClick={() => setShowTheme(false)} aria-label="Close appearance">×</button></div><h3 className="option-heading">Color theme</h3><div className="theme-grid">{themes.map(item => <button key={item.id} className={`theme-choice ${theme === item.id ? 'selected' : ''}`} data-preview={item.id} onClick={() => setTheme(item.id)}><span className="theme-swatch"><i /><i /><i /></span><b>{item.label}</b><small>{item.hint}</small>{theme === item.id && <Check size={18} />}</button>)}</div><h3 className="option-heading font-heading">Reading font</h3><div className="font-grid">{fontModes.map(item => <button key={item.id} className={`font-choice ${fontMode === item.id ? 'selected' : ''}`} data-font-preview={item.id} onClick={() => setFontMode(item.id)}><span><b>{item.label}</b><small>{item.hint}</small></span>{fontMode === item.id && <Check size={18} />}</button>)}</div></section></div>}
    {showHelp && <div className="modal-backdrop help-backdrop" onClick={closeHelp}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={event => event.stopPropagation()}><div className="help-heading"><div><span className="kicker"><CircleHelp size={15} /> Help and tips</span><h2 id="help-title">Welcome to For The Better</h2><p>Take small steps, reflect on your day, and build lasting change at your own pace.</p></div><button className="icon-button" onClick={closeHelp} aria-label="Close help"><X size={20} /></button></div><div className="help-sections"><section className="help-tip"><Sprout size={21} /><div><h3>What is Kaizen?</h3><p>Kaizen means improvement. Its philosophy is to keep making small, continuous improvements rather than trying to change everything at once. Choose one manageable action, practice it, reflect on what worked, and adjust your next step. Progress does not require perfection.</p></div></section><section className="help-tip"><BookOpen size={21} /><div><h3>Start your journal</h3><p>Today’s focus brings your current journal page, priorities, and daily habits together. Use Journal to answer the prompts, then select Complete page when you are ready. Required answers unlock the next page; daily pages open on their scheduled day. Journey shows your nine-week path and lets you revisit unlocked pages.</p></div></section><section className="help-tip"><ListTodo size={21} /><div><h3>Turn intentions into small actions</h3><p>Use To do list to capture tasks and goals, break goals into steps, and star up to three priorities. Enable the Daily to do list for repeatable habits; its checkmarks reset each day. On Daily Reflection pages, write your mission, three actions, gratitude, and reflection. Check an action’s box when you have done it—typing it does not complete it.</p></div></section><section className="help-tip"><Brain size={21} /><div><h3>Make the app work for you</h3><p>Brain Dump gives you space to clear your mind. Your edits save automatically; check the save status for confirmation. Use the palette at the top to change themes and reading fonts, the bell for email reminders, and Download my data at the bottom to export your journal. Open this question mark anytime to revisit the tutorial.</p></div></section><section className="help-tip"><Smartphone size={21} /><div><h3>Add it to an iPhone home screen</h3><ol><li>Open For The Better in Safari.</li><li>Tap the Share button at the bottom of the screen.</li><li>Scroll down and tap Add to Home Screen.</li><li>Tap Add in the top right corner.</li></ol></div></section><section className="help-tip"><Smartphone size={21} /><div><h3>Add it to an Android home screen</h3><ol><li>Open For The Better in Chrome.</li><li>Tap the three dots in the top right corner.</li><li>Tap Add to Home screen or Install app.</li><li>Follow the message on your screen to finish.</li></ol></div></section><section className="help-tip"><Bookmark size={21} /><div><h3>Bookmark the app</h3><p>On a computer, press Ctrl and D on Windows or Command and D on a Mac. On a phone, open your browser menu or Share menu and choose Add Bookmark.</p></div></section></div><div className="help-contact"><MessageCircle size={22} /><div><h3>Still need help?</h3><p>Questions, concerns, and feedback are always welcome.</p><a href="https://www.instagram.com/killer__queen55/" target="_blank" rel="noreferrer">Message killer__queen55 on Instagram <ExternalLink size={15} /></a></div></div><button className="primary tutorial-done" onClick={closeHelp}>Start my journey</button></section></div>}
  </div>
}

export default App
