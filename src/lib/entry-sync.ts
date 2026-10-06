import type { ProgressStore, SavedEntry } from '../types'
import { normalizeProgress } from './storage'

const key = (userId: string) => `ftb-pending-v1:${userId}`
export function loadPending(userId: string): ProgressStore {
  try { return normalizeProgress(JSON.parse(localStorage.getItem(key(userId)) || '{}')) } catch { return {} }
}
export function savePending(userId: string, entries: ProgressStore): boolean {
  try { localStorage.setItem(key(userId), JSON.stringify(entries)); return true } catch { return false }
}
// One ordered queue per account. Older requests cannot overwrite newer edits.
export class EntryQueue {
  pending: ProgressStore
  private running = false
  constructor(readonly userId: string, private send: (id: string, entry: SavedEntry) => Promise<void>, private changed: (pending: boolean, durable: boolean) => void) { this.pending = loadPending(userId) }
  add(id: string, entry: SavedEntry) {
    this.pending[id] = entry
    this.changed(true, savePending(this.userId, this.pending))
    void this.flush()
  }
  async flush() {
    if (this.running) return
    this.running = true
    try {
      while (Object.keys(this.pending).length) {
        const [id, entry] = Object.entries(this.pending)[0]
        await this.send(id, entry)
        if (this.pending[id] === entry) delete this.pending[id]
        this.changed(Boolean(Object.keys(this.pending).length), savePending(this.userId, this.pending))
      }
    } catch { this.changed(true, savePending(this.userId, this.pending)) }
    finally { this.running = false }
  }
}
