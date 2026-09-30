import type { FontMode, ProgressStore, ThemeName } from '../types'

const PROGRESS_KEY = 'ftb-progress-v1'
const THEME_KEY = 'ftb-theme-v1'
const FONT_KEY = 'ftb-font-v1'
const START_KEY = 'ftb-start-date-v1'

// Accessing localStorage itself can throw in restricted/private browsers.
// Memory fallback keeps the current session usable without claiming persistence.
const memory = new Map<string, string>()
function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string): boolean {
  memory.set(key, value)
  try { localStorage.setItem(key, value); memory.delete(key); return true } catch { return false }
}

export function normalizeProgress(value: unknown): ProgressStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
    const { answers, completed, updatedAt } = entry
    return answers && typeof answers === 'object' && !Array.isArray(answers)
      && Object.values(answers).every(answer => typeof answer === 'string' || typeof answer === 'number'
        || (Array.isArray(answer) && answer.every(item => typeof item === 'string')))
      && typeof completed === 'boolean' && typeof updatedAt === 'string'
  }))
}

export function loadProgress(): ProgressStore {
  try {
    return normalizeProgress(JSON.parse(read(PROGRESS_KEY) || '{}'))
  } catch {
    return {}
  }
}

export function saveProgress(progress: ProgressStore) {
  return write(PROGRESS_KEY, JSON.stringify(progress))
}

export function loadTheme(): ThemeName {
  const theme = read(THEME_KEY) as ThemeName
  return ['light', 'dark', 'pastel', 'hacker', 'gothic', 'zen'].includes(theme) ? theme : 'light'
}

export function saveTheme(theme: ThemeName) {
  return write(THEME_KEY, theme)
}

export function loadFontMode(): FontMode {
  const font = read(FONT_KEY) as FontMode
  return ['default', 'adhd', 'dyslexic'].includes(font) ? font : 'default'
}

export function saveFontMode(font: FontMode) {
  return write(FONT_KEY, font)
}

export function getStartDate(): string {
  const existing = read(START_KEY)
  if (existing && /^\d{4}-\d{2}-\d{2}$/.test(existing) && !Number.isNaN(Date.parse(existing))) return existing
  const today = new Date().toISOString().slice(0, 10)
  write(START_KEY, today)
  return today
}
