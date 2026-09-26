import { createClient, type User } from '@supabase/supabase-js'
import type { ProgressStore, SavedEntry, ThemeName } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudConfigured = Boolean(url && anonKey)
export const supabase = cloudConfigured ? createClient(url, anonKey) : null

export async function loadCloudProgress(user: User): Promise<ProgressStore> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('journal_entries')
    .select('page_id, answers, completed, completed_at, updated_at')
    .eq('user_id', user.id)

  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.page_id, {
    answers: row.answers,
    completed: row.completed,
    completedAt: row.completed_at || undefined,
    updatedAt: row.updated_at,
  } satisfies SavedEntry]))
}

export async function saveCloudEntry(user: User, pageId: string, entry: SavedEntry) {
  if (!supabase) return
  const { error } = await supabase.from('journal_entries').upsert({
    user_id: user.id,
    page_id: pageId,
    answers: entry.answers,
    completed: entry.completed,
    completed_at: entry.completedAt || null,
    updated_at: entry.updatedAt,
  }, { onConflict: 'user_id,page_id' })
  if (error) throw error
}

export async function saveCloudProfile(user: User, theme: ThemeName) {
  if (!supabase) return
  const { error } = await supabase.from('journal_profiles').upsert({
    user_id: user.id,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
    theme,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}
