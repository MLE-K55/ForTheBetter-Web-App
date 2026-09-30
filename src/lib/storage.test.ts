// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getStartDate, loadFontMode, loadProgress, loadTheme, saveFontMode, saveProgress, saveTheme } from './storage'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('ignores malformed JSON and invalid progress shapes', () => {
  for (const value of ['{', 'null', '[]', '{"page":null}', '{"page":{"answers":null}}']) {
    localStorage.setItem('ftb-progress-v1', value)
    expect(loadProgress()).toEqual({})
  }
})

it('keeps valid journal entries', () => {
  const progress = { page: { answers: { text: 'My answer', list: ['one'] }, completed: true, updatedAt: '2026-09-30' } }
  expect(saveProgress(progress)).toBe(true)
  expect(loadProgress()).toEqual(progress)
})

it('falls back from invalid preferences and dates', () => {
  localStorage.setItem('ftb-theme-v1', 'invalid')
  localStorage.setItem('ftb-font-v1', 'invalid')
  localStorage.setItem('ftb-start-date-v1', 'invalid')
  expect(loadTheme()).toBe('light')
  expect(loadFontMode()).toBe('default')
  expect(getStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

it('survives blocked storage reads and quota failures and reports non-persistence', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  expect(loadTheme()).toBe('light')
  expect(loadFontMode()).toBe('default')
  expect(loadProgress()).toEqual({})
  expect(getStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(saveTheme('dark')).toBe(false)
  expect(loadTheme()).toBe('dark')
  expect(saveFontMode('adhd')).toBe(false)
  expect(saveProgress({})).toBe(false)
})
