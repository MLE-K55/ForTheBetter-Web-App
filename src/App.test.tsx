// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const cloud = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: unknown) => unknown),
  getSession: vi.fn(), load: vi.fn(), save: vi.fn(),
}))
vi.mock('./lib/supabase', () => ({
  cloudConfigured: true,
  supabase: { auth: {
    getSession: cloud.getSession,
    onAuthStateChange: vi.fn((listener) => {
      cloud.listener = listener
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  } },
  loadCloudProgress: cloud.load,
  saveCloudEntry: cloud.save,
  saveCloudProfile: cloud.save,
}))
const user = { id: 'test-user', email: 'test@example.com' }
it('syncs the to do list and preserves daily habits when their tab is disabled', async () => {
  cloud.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'To do list' }))
  fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'Build my app' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
  await waitFor(() => expect(cloud.save).toHaveBeenCalledWith(user, 'to-do-list', expect.objectContaining({ completed: false })))
  fireEvent.click(screen.getByRole('switch'))
  fireEvent.click(screen.getByRole('button', { name: 'Daily to do list' }))
  fireEvent.click(screen.getByRole('button', { name: 'Make the bed' }))
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.queryByRole('button', { name: 'Daily to do list' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Ultimate to do list' })).toBeTruthy()
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.getByLabelText('Complete Make the bed')).toBeTruthy()
})
beforeEach(() => {
  localStorage.clear()
  cloud.getSession.mockResolvedValue({ data: { session: null }, error: null })
  cloud.load.mockResolvedValue({})
  cloud.save.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

it('renders login, journal, and logout without changing hook order', async () => {
  render(<StrictMode><App /></StrictMode>)
  await screen.findByText('Send secure sign in link')
  await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
  await screen.findByRole('navigation', { name: 'Journal navigation' })
  await act(async () => { cloud.listener?.('SIGNED_OUT', null) })
  await screen.findByText('Send secure sign in link')
})

it('restores an existing session without changing hook order', async () => {
  cloud.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  render(<App />)
  await screen.findByRole('navigation', { name: 'Journal navigation' })
})

it('keeps the auth callback synchronous', async () => {
  render(<App />)
  await screen.findByText('Send secure sign in link')
  let result: unknown
  await act(async () => { result = cloud.listener?.('SIGNED_IN', { user }) })
  expect(result).toBeUndefined()
})

it('shows a recoverable error when cloud entries cannot load', async () => {
  cloud.load.mockRejectedValue(new Error('Network unavailable'))
  render(<App />)
  await screen.findByText('Send secure sign in link')
  await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
  await screen.findByRole('button', { name: 'Try again' })
  expect(screen.queryByRole('navigation', { name: 'Journal navigation' })).toBeNull()
  cloud.load.mockResolvedValue({})
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('navigation', { name: 'Journal navigation' })
})

it('shows a retry screen when restoring a session rejects', async () => {
  cloud.getSession.mockRejectedValue(new Error('Offline'))
  render(<App />)
  await screen.findByRole('button', { name: 'Try again' })
})

it('shows a retry screen when restoring a session stalls', async () => {
  vi.useFakeTimers()
  cloud.getSession.mockReturnValue(new Promise(() => {}))
  render(<App />)
  await act(async () => { vi.advanceTimersByTime(15000) })
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

it('shows a retry screen when loading entries stalls', async () => {
  vi.useFakeTimers()
  cloud.load.mockReturnValue(new Promise(() => {}))
  render(<App />)
  await act(async () => {})
  await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
  await act(async () => { vi.advanceTimersByTime(15000) })
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
})

it('ignores an old account load after logout', async () => {
  let resolveLoad!: (value: unknown) => void
  cloud.load.mockReturnValue(new Promise(resolve => { resolveLoad = resolve }))
  render(<App />)
  await screen.findByText('Send secure sign in link')
  await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
  await act(async () => { cloud.listener?.('SIGNED_OUT', null) })
  await act(async () => { resolveLoad({}) })
  expect(screen.getByText('Send secure sign in link')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Journal navigation' })).toBeNull()
})

it('opens login even when browser storage is blocked', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  try {
    render(<App />)
    await screen.findByText('Send secure sign in link')
    await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
    await screen.findByRole('navigation', { name: 'Journal navigation' })
  } finally { get.mockRestore(); set.mockRestore() }
})

it('does not reload entries on a same-user token refresh', async () => {
  render(<App />)
  await screen.findByText('Send secure sign in link')
  await act(async () => { cloud.listener?.('SIGNED_IN', { user }) })
  await screen.findByRole('navigation', { name: 'Journal navigation' })
  const count = cloud.load.mock.calls.length
  await act(async () => { cloud.listener?.('TOKEN_REFRESHED', { user: { ...user } }) })
  await waitFor(() => expect(cloud.load).toHaveBeenCalledTimes(count))
})
it('shows pending saves and retries them without losing the latest task', async () => {
  cloud.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'To do list' }))
  cloud.save.mockRejectedValue(new Error('offline'))
  fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'Keep my draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
  await screen.findByText(/Waiting to sync/)
  cloud.save.mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
  await screen.findByText('Synced')
  expect(screen.getByLabelText('Complete Keep my draft')).toBeTruthy()
})
it('brings priorities, daily checklist, and the working journal into Today’s focus', async () => {
  cloud.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  cloud.load.mockResolvedValue({ 'to-do-list': { answers: { list: JSON.stringify({ items: [{ id: 'p', text: 'Spanish', priority: true, done: false, steps: [{ id: 's', text: 'Practice five minutes', done: false }] }], dailyEnabled: true, daily: [{ id: 'd', text: 'Drink water' }] }) }, completed: false, updatedAt: 'now' } })
  render(<App />)
  await screen.findByLabelText('Complete priority Spanish')
  expect(screen.getByLabelText('Daily focus Drink water')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Complete page' })).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Complete next step Practice five minutes'))
  await waitFor(() => expect(screen.queryByLabelText('Complete next step Practice five minutes')).toBeNull())
})
