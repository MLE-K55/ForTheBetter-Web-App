import type { FontMode, ProgressStore, ThemeName } from '../types'

const PROGRESS_KEY = 'ftb-progress-v1'
const THEME_KEY = 'ftb-theme-v1'
const FONT_KEY = 'ftb-font-v1'
const START_KEY = 'ftb-start-date-v1'

export function loadProgress(): ProgressStore {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveProgress(progress: ProgressStore) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function loadTheme(): ThemeName {
  return (localStorage.getItem(THEME_KEY) as ThemeName) || 'light'
}

export function saveTheme(theme: ThemeName) {
  localStorage.setItem(THEME_KEY, theme)
}

export function loadFontMode(): FontMode {
  return (localStorage.getItem(FONT_KEY) as FontMode) || 'default'
}

export function saveFontMode(font: FontMode) {
  localStorage.setItem(FONT_KEY, font)
}

export function getStartDate(): string {
  const existing = localStorage.getItem(START_KEY)
  if (existing) return existing
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem(START_KEY, today)
  return today
}
