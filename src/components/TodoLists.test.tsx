// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import TodoLists from './TodoLists'
import { localDay, newTodo, readTodos, type TodoStore } from '../lib/todos'

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'test' } } })) } } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
function Harness({ initial, dailyOnly = false }: { initial: TodoStore; dailyOnly?: boolean }) {
  const [store, setStore] = useState(initial)
  return <TodoLists store={store} onChange={setStore} dailyOnly={dailyOnly} />
}
const empty = (): TodoStore => ({ items: [], daily: [], dailyEnabled: false })
it('adds, edits, completes, reorders, and deletes tasks while limiting priorities to three', () => {
  render(<Harness initial={{ ...empty(), items: ['One', 'Two', 'Three', 'Four'].map(newTodo) }} />)
  for (const text of ['One', 'Two', 'Three']) fireEvent.click(screen.getByRole('button', { name: `Top priority: ${text}` }))
  expect((screen.getByRole('button', { name: 'Top priority: Four' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Top priority: One' }))
  fireEvent.click(screen.getByRole('button', { name: 'Top priority: Four' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move Four up' }))
  expect((screen.getByLabelText('Edit task 3') as HTMLInputElement).value).toBe('Four')
  fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'New goal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
  fireEvent.change(screen.getByLabelText('Edit task 5'), { target: { value: 'Updated goal' } })
  fireEvent.click(screen.getByLabelText('Complete Updated goal'))
  expect((screen.getByLabelText('Complete Updated goal') as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Delete Updated goal' }))
  expect(screen.queryByLabelText('Complete Updated goal')).toBeNull()
})
it('keeps habits when disabled and clears yesterday’s completion without clearing today', () => {
  render(<Harness initial={{ ...empty(), dailyEnabled: true, daily: [{ ...newTodo('Bed'), completedOn: '2000-01-01' }, { ...newTodo('Water'), completedOn: localDay() }] }} dailyOnly />)
  expect((screen.getByLabelText('Complete Bed') as HTMLInputElement).checked).toBe(false)
  expect((screen.getByLabelText('Complete Water') as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.queryByLabelText('Complete Water')).toBeNull()
  fireEvent.click(screen.getByRole('switch'))
  expect((screen.getByLabelText('Complete Water') as HTMLInputElement).checked).toBe(true)
})
it('refreshes daily checks across midnight while the app remains open', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 6, 23, 59, 50))
  render(<Harness initial={{ ...empty(), dailyEnabled: true, daily: [{ ...newTodo('Bed'), completedOn: localDay() }] }} dailyOnly />)
  expect((screen.getByLabelText('Complete Bed') as HTMLInputElement).checked).toBe(true)
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect((screen.getByLabelText('Complete Bed') as HTMLInputElement).checked).toBe(false)
})
it('uses real AI estimates, keeps priorities first, and preserves edits made during a request', async () => {
  const items = ['Slow priority', 'Quick', 'Edited'].map(newTodo)
  items[0].priority = true
  let resolve!: (value: unknown) => void
  const fetch = vi.fn(() => new Promise(done => { resolve = done }))
  vi.stubGlobal('fetch', fetch)
  render(<Harness initial={{ ...empty(), items }} />)
  expect((screen.getByRole('button', { name: 'AI sort & estimate' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText(/Use Gemini/))
  fireEvent.click(screen.getByRole('button', { name: 'AI sort & estimate' }))
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('Edit task 3'), { target: { value: 'Changed during AI' } })
  await act(async () => resolve({ ok: true, json: async () => ({ estimates: items.map((item, index) => ({ id: item.id, estimate: `${30 - index * 10} min`, minutes: 30 - index * 10 })) }) }))
  expect((screen.getByLabelText('Edit task 1') as HTMLInputElement).value).toBe('Slow priority')
  expect((screen.getByLabelText('Time estimate for Quick') as HTMLInputElement).value).toBe('20 min')
  expect((screen.getByLabelText('Time estimate for Changed during AI') as HTMLInputElement).value).toBe('')
})
it('leaves the list intact when AI fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'AI has not been connected yet.' }) })))
  render(<Harness initial={{ ...empty(), items: [newTodo('My task')] }} />)
  fireEvent.click(screen.getByLabelText(/Use Gemini/))
  fireEvent.click(screen.getByRole('button', { name: 'AI sort & estimate' }))
  await screen.findByText('AI has not been connected yet.')
  expect((screen.getByLabelText('Time estimate for My task') as HTMLInputElement).value).toBe('')
})
it('restores stored lists and safely handles corrupt saved data', () => {
  expect(readTodos({ list: '{broken' })).toEqual(empty())
  const store = { ...empty(), items: ['a', 'b', 'c', 'd'].map(text => ({ ...newTodo(text), priority: true })), dailyEnabled: true }
  const restored = readTodos({ list: JSON.stringify(store) })
  expect(restored.dailyEnabled).toBe(true)
  expect(restored.items.filter(item => item.priority)).toHaveLength(3)
})
it('filters and archives completed tasks without deleting them, and restores them', () => {
  render(<Harness initial={{ ...empty(), items: [newTodo('Spanish'), { ...newTodo('Call dentist'), done: true }] }} />)
  fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'dentist' } })
  expect(screen.queryByLabelText('Complete Spanish')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Archive Call dentist' }))
  expect(screen.queryByLabelText('Complete Call dentist')).toBeNull()
  fireEvent.change(screen.getByLabelText('Filter tasks'), { target: { value: 'archived' } })
  expect(screen.getByLabelText('Complete Call dentist')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Restore Call dentist' }))
  fireEvent.change(screen.getByLabelText('Filter tasks'), { target: { value: 'completed' } })
  expect(screen.getByLabelText('Complete Call dentist')).toBeTruthy()
})
it('lets users edit AI steps and add them only after review', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ steps: ['Practice five minutes', 'Learn three words'] }) })))
  render(<Harness initial={{ ...empty(), items: [newTodo('Learn Spanish')] }} />)
  fireEvent.click(screen.getByLabelText(/Send this goal to Google/))
  fireEvent.click(screen.getByRole('button', { name: 'Suggest small steps' }))
  await screen.findByLabelText('Suggested step 1')
  expect(screen.queryByLabelText('Complete step Practice five minutes')).toBeNull()
  fireEvent.change(screen.getByLabelText('Suggested step 1'), { target: { value: 'Practice two minutes' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add reviewed steps' }))
  fireEvent.click(screen.getByLabelText('Complete step Practice two minutes'))
  expect((screen.getByLabelText('Complete step Practice two minutes') as HTMLInputElement).checked).toBe(true)
})
