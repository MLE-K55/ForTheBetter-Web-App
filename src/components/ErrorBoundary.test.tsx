// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('shows recovery controls instead of a blank page after a render failure', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never { throw new Error('Test render failure') }
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('button', { name: 'Reload journal' })).toBeTruthy()
})
