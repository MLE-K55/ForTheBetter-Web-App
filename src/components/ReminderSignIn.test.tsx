// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ReminderSignIn from './ReminderSignIn'
const verify = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { auth: { verifyOtp: verify } } }))
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, '', '/') })
it('only consumes a login token after the user clicks, keeping scanners from signing in', async () => {
  window.history.replaceState(null, '', '/#reminder_token=secret')
  verify.mockResolvedValue({ error: null })
  const done = vi.fn()
  render(<ReminderSignIn token="secret" onDone={done} />)
  expect(window.location.hash).toBe('')
  expect(verify).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Continue to my journal' }))
  await screen.findByRole('button', { name: 'Continue to my journal' })
  expect(verify).toHaveBeenCalledWith({ token_hash: 'secret', type: 'email' })
})
it('offers the existing sign-in flow when a link has expired', async () => {
  verify.mockResolvedValue({ error: new Error('Expired') })
  const done = vi.fn()
  render(<ReminderSignIn token="expired" onDone={done} />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue to my journal' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Request a fresh sign-in link' }))
  expect(done).toHaveBeenCalled()
})
