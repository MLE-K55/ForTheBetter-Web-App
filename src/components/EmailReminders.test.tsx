// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import EmailReminders from './EmailReminders'
const getSession = vi.hoisted(() => vi.fn(async () => ({ data: { session: { access_token: 'test-token' } } })))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession } } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
it('loads, saves the chosen schedule, and explicitly sends a test', async () => {
  const preferences = { enabled: false, delivery_time: '07:00', time_zone: 'America/Chicago' }
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true, preferences }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true, preferences: { ...preferences, enabled: true, delivery_time: '18:30' } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Test email sent.' }) })
  vi.stubGlobal('fetch', fetch)
  render(<EmailReminders email="me@example.com" onClose={vi.fn()} />)
  await screen.findByRole('switch')
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('switch'))
  fireEvent.change(screen.getByLabelText('Delivery time'), { target: { value: '18:30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByText('Your daily reminder is scheduled.')
  const body = JSON.parse(fetch.mock.calls[1][1].body)
  expect(body).toMatchObject({ enabled: true, delivery_time: '18:30', time_zone: 'America/Chicago' })
  fireEvent.click(screen.getByRole('button', { name: 'Send a test email' }))
  await screen.findByText('Test email sent.')
})
it('does not claim reminders are active if the server is not configured', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ready: false, error: 'Daily emails are not available yet.' }) })))
  render(<EmailReminders email="me@example.com" onClose={vi.fn()} />)
  await screen.findByText('Daily emails are not available yet.')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save preferences' }) as HTMLButtonElement).disabled).toBe(true))
})
it('keeps unsaved preferences visible after a failed save', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ready: true, preferences: { enabled: false, delivery_time: '07:00', time_zone: 'America/Chicago' } }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Could not save.' }) }))
  render(<EmailReminders email="me@example.com" onClose={vi.fn()} />)
  await screen.findByRole('switch')
  fireEvent.click(screen.getByRole('switch'))
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByText('Could not save.')
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
})
