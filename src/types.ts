export type ThemeName = 'light' | 'dark' | 'pastel' | 'hacker' | 'gothic' | 'zen'
export type FontMode = 'default' | 'adhd' | 'dyslexic'

export type FieldKind = 'text' | 'textarea' | 'date' | 'checklist' | 'rating'

export interface JournalField {
  id: string
  label: string
  kind: FieldKind
  required?: boolean
  count?: number
  options?: string[]
}

export interface JournalPage {
  id: string
  week: number
  day: number
  eyebrow: string
  title: string
  intro?: string
  quote?: string
  fields: JournalField[]
  sourceStatus?: 'confirmed' | 'draft'
}

export type JournalAnswers = Record<string, string | string[] | number>

export interface SavedEntry {
  answers: JournalAnswers
  completed: boolean
  completedAt?: string
  updatedAt: string
}

export type ProgressStore = Record<string, SavedEntry>
