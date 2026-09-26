import { describe, expect, it } from 'vitest'
import { journalPages, totalDays } from './journal'

describe('nine-week journal structure', () => {
  it('contains nine complete weekly sequences', () => {
    expect(totalDays).toBe(63)
    expect(journalPages).toHaveLength(81)
    for (let week = 1; week <= 9; week += 1) {
      const pages = journalPages.filter(page => page.week === week)
      expect(pages).toHaveLength(9)
      expect(pages[0].day).toBe(0)
      expect(pages.at(-1)?.day).toBe(8)
    }
  })

  it('gives every page required responses', () => {
    expect(journalPages.every(page => page.fields.some(field => field.required))).toBe(true)
  })

  it('uses unique stable page ids', () => {
    expect(new Set(journalPages.map(page => page.id)).size).toBe(journalPages.length)
  })
})
