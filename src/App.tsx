import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Brain, CalendarDays, Check, ChevronLeft, ChevronRight, ExternalLink, Flame, ListTodo, LockKeyhole, LogOut, Palette, Settings2, Sparkles, Sprout } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import BrainDump from './components/BrainDump'
import TodoLists from './components/TodoLists'
import { readTodos, type TodoStore } from './lib/todos'
import { availabilityDay, journalPages, totalDays } from './data/journal'
import { getStartDate, loadFontMode, loadProgress, loadTheme, saveFontMode, saveProgress, saveTheme } from './lib/storage'
import { cloudConfigured, loadCloudProgress, saveCloudEntry, saveCloudProfile, supabase } from './lib/supabase'
import type { FontMode, JournalAnswers, JournalField, ProgressStore, ThemeName } from './types'

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

function Field({ field, value, onChange }: { field: JournalField; value: JournalAnswers[string]; onChange: (value: JournalAnswers[string]) => void }) {
  if (field.kind === 'date') return <label className="field"><span>{field.label}</span><input type="date" value={String(value || '')} onChange={e => onChange(e.target.value)} /></label>
  if (field.kind === 'checklist') {
    const values = Array.isArray(value) ? value : Array.from({ length: field.count || 3 }, () => '')
    return <fieldset className="field checklist"><legend>{field.label}</legend>{values.map((item, index) => <label key={index} className="check-row"><span className="check-box">{item ? <Check size={14} /> : index + 1}</span><input value={item} placeholder={`Item ${index + 1}`} onChange={e => { const next = [...values]; next[index] = e.target.value; onChange(next) }} /></label>)}</fieldset>
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
  const [activeTab, setActiveTab] = useState<'journal' | 'brain' | 'journey' | 'todos' | 'daily'>('journal')
  const todos = useMemo(() => readTodos(progress['to-do-list']?.answers), [progress])
  const todoSync = useRef<Promise<void>>(Promise.resolve())
  const startDate = useMemo(getStartDate, [])
  const page = journalPages[pageIndex]
  const entry = progress[page.id]
  const answers = entry?.answers || {}
  const completedCount = Object.values(progress).filter(item => item.completed).length
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000))
  const timeUnlockedIndex = journalPages.reduce((latest, item, index) => availabilityDay(item) <= elapsedDays ? index : latest, 0)
  const maxUnlocked = Math.min(completedCount, timeUnlockedIndex, journalPages.length - 1)
  const percent = Math.round((completedCount / journalPages.length) * 100)
  const currentDay = journalPages.slice(0, maxUnlocked + 1).filter(item => item.day > 0 && item.day < 8).length || 1

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
    setActiveTab('journal')
    if (!user) return
    let active = true
    const timeout = window.setTimeout(() => {
      if (!active) return
      active = false
      setLoadError('Your saved journal is taking longer than expected to load. Please try again.')
    }, 15000)
    void loadCloudProgress(user).then(entries => {
      if (!active) return
      setProgress(entries)
      setLoadedUserId(user.id)
    }).catch(() => {
      if (active) setLoadError('We could not load your saved journal. Check your connection and try again.')
    }).finally(() => window.clearTimeout(timeout))
    return () => { active = false; window.clearTimeout(timeout) }
  }, [user, retry])

  const updateAnswer = (fieldId: string, value: JournalAnswers[string]) => {
    setProgress(previous => {
      const next = {
        ...previous,
        [page.id]: {
          answers: { ...(previous[page.id]?.answers || {}), [fieldId]: value },
          completed: previous[page.id]?.completed || false,
          completedAt: previous[page.id]?.completedAt,
          updatedAt: new Date().toISOString(),
        },
      }
      if (!saveProgress(next)) setSaveError('This browser cannot save on this device. Keep this page open until your entries sync.')
      if (user) void saveCloudEntry(user, page.id, next[page.id]).catch(() => setSaveError('Your latest changes could not sync. Keep this page open and check your connection.'))
      return next
    })
  }

  const canComplete = page.fields.filter(field => field.required).every(field => isFilled(answers[field.id]))
  const nextPageIsTimeLocked = pageIndex < journalPages.length - 1 && pageIndex + 1 > timeUnlockedIndex
  const nextUnlockDate = new Date(new Date(`${startDate}T00:00:00`).getTime() + availabilityDay(journalPages[Math.min(pageIndex + 1, journalPages.length - 1)]) * 86_400_000)

  const completePage = () => {
    if (!canComplete) return
    setProgress(previous => {
      const next = {
        ...previous,
        [page.id]: {
          answers,
          completed: true,
          completedAt: previous[page.id]?.completedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
      if (!saveProgress(next)) setSaveError('This browser cannot save on this device. Keep this page open until your entries sync.')
      if (user) void saveCloudEntry(user, page.id, next[page.id]).catch(() => setSaveError('Your latest changes could not sync. Keep this page open and check your connection.'))
      return next
    })
    if (pageIndex < journalPages.length - 1 && pageIndex + 1 <= timeUnlockedIndex) setPageIndex(pageIndex + 1)
  }

  const goToPage = (index: number) => {
    if (index <= maxUnlocked) {
      setPageIndex(index)
      setActiveTab('journal')
    }
  }

  const saveBrainDump = useCallback((brainAnswers: JournalAnswers) => {
    setProgress(previous => {
      const nextEntry = { answers: brainAnswers, completed: false, updatedAt: new Date().toISOString() }
      const next = { ...previous, 'brain-dump': nextEntry }
      if (!saveProgress(next)) setSaveError('This browser cannot save on this device. Keep this page open until your entries sync.')
      if (user) void saveCloudEntry(user, 'brain-dump', nextEntry).catch(() => setSaveError('Your latest changes could not sync. Keep this page open and check your connection.'))
      return next
    })
  }, [user])

  const saveTodos = (store: TodoStore) => {
    if (!store.dailyEnabled && activeTab === 'daily') setActiveTab('todos')
    const nextEntry = { answers: { list: JSON.stringify(store) }, completed: false, updatedAt: new Date().toISOString() }
    setProgress(previous => {
      const next = { ...previous, 'to-do-list': nextEntry }
      if (!saveProgress(next)) setSaveError('This browser cannot save on this device. Keep this page open until your entries sync.')
      return next
    })
    if (user) todoSync.current = todoSync.current.then(() => saveCloudEntry(user, 'to-do-list', nextEntry)).catch(() => setSaveError('Your latest changes could not sync. Keep this page open and check your connection.'))
  }

  // All hooks above must run on login, loading, and journal renders alike.
  if (authError) return <main className="loading-screen" role="alert"><p>{authError}</p><button className="primary" onClick={() => window.location.reload()}>Try again</button></main>
  if (!authReady) return <div className="loading-screen"><span className="brand-mark">FTB</span><p>Opening your private journal…</p></div>
  if (cloudConfigured && !user) return <AuthScreen />
  if (loadError) return <main className="loading-screen" role="alert"><p>{loadError}</p><button className="primary" onClick={() => setRetry(value => value + 1)}>Try again</button></main>
  if (user && loadedUserId !== user.id) return <div className="loading-screen"><p>Loading your saved journal…</p></div>

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPageIndex(Math.min(pageIndex, maxUnlocked))} aria-label="For The Better home"><img className="brand-logo" src={`/logos/ftb-${theme}.png`} alt="" /><span><b>For The Better</b><small>Small steps. Real change.</small></span></button>
      <div className="header-actions"><button className="icon-button" onClick={() => setShowTheme(true)} aria-label="Choose appearance"><Palette size={20} /></button><button className="logout-button" onClick={() => user && supabase?.auth.signOut()}><LogOut size={16} /> Log out</button></div>
    </header>

    <main className={activeTab === 'todos' || activeTab === 'daily' ? 'todo-main' : undefined}>
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <section className="progress-card">
        <div><span className="kicker"><Flame size={15} /> 9 week journey</span><h1>Day {Math.min(currentDay, totalDays)} of {totalDays}</h1><p>Started {new Date(`${startDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as React.CSSProperties}><span>{percent}%</span></div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      </section>

      <nav className="section-tabs" aria-label="Journal navigation"><button className={activeTab === 'journal' ? 'active' : ''} onClick={() => setActiveTab('journal')}><BookOpen size={18} /> Journal</button><button className={activeTab === 'brain' ? 'active' : ''} onClick={() => setActiveTab('brain')}><Brain size={18} /> Brain Dump</button><button className={activeTab === 'journey' ? 'active' : ''} onClick={() => setActiveTab('journey')}><CalendarDays size={18} /> Journey</button><button className={activeTab === 'todos' ? 'active' : ''} onClick={() => setActiveTab('todos')}><ListTodo size={18} /> To do list</button>{todos.dailyEnabled && <button className={activeTab === 'daily' ? 'active' : ''} onClick={() => setActiveTab('daily')}><Sprout size={18} /> Daily to do list</button>}</nav>

      {activeTab === 'todos' || activeTab === 'daily' ? <TodoLists key={user?.id || 'local'} store={todos} onChange={saveTodos} dailyOnly={activeTab === 'daily'} /> : activeTab === 'brain' ? <BrainDump entry={progress['brain-dump']} onSave={saveBrainDump} /> : activeTab === 'journey' ? <section className="journey-panel">
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
      </section> : <article className="journal-card">
        <div className="journal-heading"><div><span className="kicker">{page.eyebrow}</span><h2>{page.title}</h2></div>{entry?.completed && <span className="done-badge"><Check size={15} /> Complete</span>}</div>
        {page.sourceStatus === 'draft' && <p className="draft-note">This heading came from the original book. These questions are still a draft because the source PDF repeats earlier pages.</p>}
        {page.quote && <blockquote>“{page.quote}”</blockquote>}
        {page.intro && <p className="intro">{page.intro}</p>}
        {page.id === 'week-1-my-why' ? <MyWhyFields fields={page.fields} answers={answers} onChange={updateAnswer} /> : <div className="fields">{page.fields.map(field => <Field key={field.id} field={field} value={answers[field.id]} onChange={value => updateAnswer(field.id, value)} />)}</div>}
        <div className="completion-note"><LockKeyhole size={17} /><span>{entry?.completed && nextPageIsTimeLocked ? `You are done for today. Your next page opens ${nextUnlockDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.` : 'Answer every required question to unlock the next page. New daily entries open on their scheduled day.'}</span></div>
        <div className="page-actions"><button className="secondary" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={18} /> Back</button><button className="primary" disabled={!canComplete || Boolean(entry?.completed && nextPageIsTimeLocked)} onClick={completePage}>{entry?.completed && nextPageIsTimeLocked ? 'Saved for today' : entry?.completed ? 'Continue' : 'Complete page'} <ChevronRight size={18} /></button></div>
      </article>}
    </main>

    <footer>
      <div className="footer-details"><span>{user ? 'Signed in · Your entries are private to your account.' : 'Prototype mode · Entries save privately on this device.'}</span><button onClick={() => setShowTheme(true)}><Settings2 size={15} /> Appearance</button></div>
      <div className="creator-watermark"><img src="/kq-logo-watermark.png" alt="KQ brand logo" /><span>Created by Killer_Queen55</span></div>
    </footer>

    {showTheme && <div className="modal-backdrop" onClick={() => setShowTheme(false)}><section className="theme-modal" onClick={event => event.stopPropagation()}><div className="section-heading"><div><span className="kicker">Make it yours</span><h2>Appearance</h2></div><button className="icon-button" onClick={() => setShowTheme(false)} aria-label="Close appearance">×</button></div><h3 className="option-heading">Color theme</h3><div className="theme-grid">{themes.map(item => <button key={item.id} className={`theme-choice ${theme === item.id ? 'selected' : ''}`} data-preview={item.id} onClick={() => setTheme(item.id)}><span className="theme-swatch"><i /><i /><i /></span><b>{item.label}</b><small>{item.hint}</small>{theme === item.id && <Check size={18} />}</button>)}</div><h3 className="option-heading font-heading">Reading font</h3><div className="font-grid">{fontModes.map(item => <button key={item.id} className={`font-choice ${fontMode === item.id ? 'selected' : ''}`} data-font-preview={item.id} onClick={() => setFontMode(item.id)}><span><b>{item.label}</b><small>{item.hint}</small></span>{fontMode === item.id && <Check size={18} />}</button>)}</div></section></div>}
  </div>
}

export default App
