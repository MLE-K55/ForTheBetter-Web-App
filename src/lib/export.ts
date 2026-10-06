import type { FontMode, ProgressStore, ThemeName } from '../types'
import { journalPages } from '../data/journal'
import { readTodos } from './todos'

export function buildExport(progress: ProgressStore, theme: ThemeName, fontMode: FontMode, startDate: string) {
  return {
    format: 'for-the-better', version: 1, exportedAt: new Date().toISOString(),
    preferences: { theme, fontMode, startDate },
    journal: journalPages.filter(page => progress[page.id]).map(page => ({ id: page.id, title: page.title, ...progress[page.id], questions: page.fields.map(field => ({ id: field.id, label: field.label })) })),
    tasks: readTodos(progress['to-do-list']?.answers),
    brainDump: progress['brain-dump'] || null,
    entries: progress,
  }
}
export function downloadExport(progress: ProgressStore, theme: ThemeName, fontMode: FontMode, startDate: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(buildExport(progress, theme, fontMode, startDate), null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `for-the-better-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
