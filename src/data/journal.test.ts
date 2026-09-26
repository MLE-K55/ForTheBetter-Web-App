import { describe, expect, it } from 'vitest'
import { availabilityDay, journalPages, totalDays } from './journal'

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

  it('holds future daily pages to the nine-week calendar', () => {
    expect(availabilityDay(journalPages.find(page => page.id === 'week-1-day-1')!)).toBe(0)
    expect(availabilityDay(journalPages.find(page => page.id === 'week-1-day-2')!)).toBe(1)
    expect(availabilityDay(journalPages.find(page => page.id === 'week-2-lesson')!)).toBe(7)
    expect(availabilityDay(journalPages.find(page => page.id === 'week-9-reflection')!)).toBe(62)
  })
})
