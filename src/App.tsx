import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Flame, LockKeyhole, Palette, Settings2, Sparkles } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import AuthScreen from './components/AuthScreen'
import { availabilityDay, journalPages, totalDays } from './data/journal'
import { getStartDate, loadProgress, loadTheme, saveProgress, saveTheme } from './lib/storage'
import { cloudConfigured, loadCloudProgress, saveCloudEntry, saveCloudProfile, supabase } from './lib/supabase'
import type { JournalAnswers, JournalField, ProgressStore, ThemeName } from './types'

const themes: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Warm & clear' },
  { id: 'dark', label: 'Dark', hint: 'Calm & focused' },
  { id: 'pastel', label: 'Pastel', hint: 'Candy fairy' },
  { id: 'hacker', label: 'Hacker', hint: 'Matrix green' },
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

function App() {
  const [theme, setTheme] = useState<ThemeName>(loadTheme)
  const [progress, setProgress] = useState<ProgressStore>(loadProgress)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!cloudConfigured)
  const [pageIndex, setPageIndex] = useState(0)
  const [showTheme, setShowTheme] = useState(false)
  const [showJourney, setShowJourney] = useState(false)
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
    saveTheme(theme)
    if (user) void saveCloudProfile(user, theme)
  }, [theme, user])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user || null)
      if (data.session?.user) setProgress(await loadCloudProgress(data.session.user))
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      if (session?.user) setProgress(await loadCloudProgress(session.user))
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="loading-screen"><span className="brand-mark">FTB</span><p>Opening your private journal…</p></div>
  if (cloudConfigured && !user) return <AuthScreen />

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
      saveProgress(next)
      if (user) void saveCloudEntry(user, page.id, next[page.id])
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
      saveProgress(next)
      if (user) void saveCloudEntry(user, page.id, next[page.id])
      return next
    })
    if (pageIndex < journalPages.length - 1 && pageIndex + 1 <= timeUnlockedIndex) setPageIndex(pageIndex + 1)
  }

  const goToPage = (index: number) => {
    if (index <= maxUnlocked) {
      setPageIndex(index)
      setShowJourney(false)
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPageIndex(Math.min(pageIndex, maxUnlocked))} aria-label="For The Better home"><span className="brand-mark">FTB</span><span><b>For The Better</b><small>Small steps. Real change.</small></span></button>
      <div className="header-actions"><button className="icon-button" onClick={() => setShowTheme(true)} aria-label="Choose appearance"><Palette size={20} /></button><button className="avatar" aria-label="Account settings" onClick={() => user && supabase?.auth.signOut()}>{user?.email?.slice(0, 2).toUpperCase() || 'FT'}</button></div>
    </header>

    <main>
      <section className="progress-card">
        <div><span className="kicker"><Flame size={15} /> 9-week journey</span><h1>Day {Math.min(currentDay, totalDays)} of {totalDays}</h1><p>Started {new Date(`${startDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as React.CSSProperties}><span>{percent}%</span></div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      </section>

      <nav className="section-tabs" aria-label="Journal navigation"><button className={!showJourney ? 'active' : ''} onClick={() => setShowJourney(false)}><BookOpen size={18} /> Journal</button><button className={showJourney ? 'active' : ''} onClick={() => setShowJourney(true)}><CalendarDays size={18} /> Journey</button></nav>

      {showJourney ? <section className="journey-panel">
        <div className="section-heading"><div><span className="kicker">Your path</span><h2>Nine weeks, one day at a time</h2></div><Sparkles /></div>
        {Array.from({ length: 9 }, (_, weekIndex) => {
          const weekPages = journalPages.map((item, index) => ({ item, index })).filter(({ item }) => item.week === weekIndex + 1)
          const done = weekPages.filter(({ item }) => progress[item.id]?.completed).length
          const unlocked = weekPages[0].index <= maxUnlocked
          return <article className={`week-card ${unlocked ? '' : 'locked'}`} key={weekIndex}>
            <button disabled={!unlocked} onClick={() => goToPage(weekPages.find(({ index }) => index <= maxUnlocked && !progress[journalPages[index].id]?.completed)?.index ?? weekPages[0].index)}>
              <span className="week-number">{unlocked ? weekIndex + 1 : <LockKeyhole size={18} />}</span><span><small>Week {weekIndex + 1}</small><b>{weekPages[0].item.title}</b><em>{done} of {weekPages.length} complete</em></span><ChevronRight size={20} />
            </button>
          </article>
        })}
      </section> : <article className="journal-card">
        <div className="journal-heading"><div><span className="kicker">{page.eyebrow}</span><h2>{page.title}</h2></div>{entry?.completed && <span className="done-badge"><Check size={15} /> Complete</span>}</div>
        {page.sourceStatus === 'draft' && <p className="draft-note">This lesson’s heading is from the original book. Its prompts are a working draft because the source PDF repeats earlier text.</p>}
        {page.quote && <blockquote>“{page.quote}”</blockquote>}
        {page.intro && <p className="intro">{page.intro}</p>}
        <div className="fields">{page.fields.map(field => <Field key={field.id} field={field} value={answers[field.id]} onChange={value => updateAnswer(field.id, value)} />)}</div>
        <div className="completion-note"><LockKeyhole size={17} /><span>{entry?.completed && nextPageIsTimeLocked ? `Today is complete. Your next page unlocks ${nextUnlockDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}.` : 'Complete every required response to unlock the next page. Each new daily entry opens on its scheduled day.'}</span></div>
        <div className="page-actions"><button className="secondary" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={18} /> Back</button><button className="primary" disabled={!canComplete || Boolean(entry?.completed && nextPageIsTimeLocked)} onClick={completePage}>{entry?.completed && nextPageIsTimeLocked ? 'Saved for today' : entry?.completed ? 'Continue' : 'Complete page'} <ChevronRight size={18} /></button></div>
      </article>}
    </main>

    <footer><span>{user ? 'Signed in · Your entries are private to your account.' : 'Prototype mode · Entries save privately on this device.'}</span><button onClick={() => setShowTheme(true)}><Settings2 size={15} /> Appearance</button></footer>

    {showTheme && <div className="modal-backdrop" onClick={() => setShowTheme(false)}><section className="theme-modal" onClick={event => event.stopPropagation()}><div className="section-heading"><div><span className="kicker">Make it yours</span><h2>Choose your vibe</h2></div><button className="icon-button" onClick={() => setShowTheme(false)}>×</button></div><div className="theme-grid">{themes.map(item => <button key={item.id} className={`theme-choice ${theme === item.id ? 'selected' : ''}`} data-preview={item.id} onClick={() => setTheme(item.id)}><span className="theme-swatch"><i /><i /><i /></span><b>{item.label}</b><small>{item.hint}</small>{theme === item.id && <Check size={18} />}</button>)}</div></section></div>}
  </div>
}

export default App
