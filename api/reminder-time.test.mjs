import { expect, it } from 'vitest'
import { nextReminder, validSchedule, zonedClock } from './_lib/reminder-time.mjs'
it('schedules the chosen local morning and rolls passed times to tomorrow', () => {
  expect(nextReminder('07:00', 'America/Chicago', new Date('2026-10-06T11:00:00Z'))).toBe('2026-10-06T12:00:00.000Z')
  expect(nextReminder('07:00', 'America/Chicago', new Date('2026-10-06T13:00:00Z'))).toBe('2026-10-07T12:00:00.000Z')
})
it('moves a nonexistent spring-forward time to the first available minute', () => {
  expect(nextReminder('02:30', 'America/Chicago', new Date('2026-03-08T06:00:00Z'))).toBe('2026-03-08T08:00:00.000Z')
})
it('never schedules a second daily email in the repeated fall-back hour', () => {
  expect(nextReminder('01:30', 'America/Chicago', new Date('2026-11-01T05:00:00Z'))).toBe('2026-11-01T06:30:00.000Z')
  expect(nextReminder('01:30', 'America/Chicago', new Date('2026-11-01T07:00:00Z'), '2026-11-01')).toBe('2026-11-02T07:30:00.000Z')
})
it('handles fractional offsets and invalid input', () => {
  expect(nextReminder('07:00', 'Asia/Kathmandu', new Date('2026-10-06T00:00:00Z'))).toBe('2026-10-06T01:15:00.000Z')
  expect(zonedClock(new Date('2026-10-06T01:15:00Z'), 'Asia/Kathmandu').minutes).toBe(420)
  expect(validSchedule('25:00', 'UTC')).toBe(false)
  expect(validSchedule('07:00', 'not-a-zone')).toBe(false)
})
