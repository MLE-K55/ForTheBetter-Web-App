// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AuthScreen from './AuthScreen'

vi.mock('../lib/supabase', () => ({ supabase: { auth: {
  signInWithOtp: vi.fn().mockRejectedValue(new Error('Offline')),
} } }))
afterEach(cleanup)
it('re-enables sign in and explains a rejected network request', async () => {
  render(<AuthScreen />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send secure sign in link' }))
  await screen.findByText('We could not send your sign in link. Check your connection and try again.')
  await waitFor(() => expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false))
})
