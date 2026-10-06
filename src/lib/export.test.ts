import { expect, it } from 'vitest'
import { buildExport } from './export'
it('exports readable journal labels and every task including archived goals and steps', () => {
  const task = { id: 'a', text: 'Spanish', done: true, archived: true, priority: false, completedOn: '', estimate: '', steps: [{ id: 's', text: 'Five minutes', done: true }] }
  const entries = { 'to-do-list': { answers: { list: JSON.stringify({ items: [task], daily: [], dailyEnabled: false }) }, completed: false, updatedAt: 'now' }, 'brain-dump': { answers: { thoughts: 'My thoughts' }, completed: false, updatedAt: 'now' } }
  const exported = buildExport(entries, 'zen', 'default', '2026-10-06')
  expect(exported.tasks.items[0]).toMatchObject(task)
  expect(exported.brainDump?.answers.thoughts).toBe('My thoughts')
  expect(exported.entries).toEqual(entries)
  expect(JSON.stringify(exported)).not.toContain('access_token')
})
