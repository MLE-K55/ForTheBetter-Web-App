// Minute-level scheduling in IANA time zones. A missing spring-forward time
// moves to the first available minute; a repeated fall-back time sends once.
const formatters = new Map()
export function zonedClock(date, timeZone) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, formatter)
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
export function validSchedule(time, timeZone) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || typeof timeZone !== 'string' || timeZone.length > 100) return false
  try { zonedClock(new Date(), timeZone); return true } catch { return false }
}
export function nextReminder(time, timeZone, now = new Date(), excludeDate) {
  if (!validSchedule(time, timeZone)) throw new Error('Invalid delivery time or time zone.')
  const [hour, minute] = time.split(':').map(Number)
  const targetMinutes = hour * 60 + minute
  const local = zonedClock(now, timeZone)
  let targetDate = local.date
  if (local.minutes >= targetMinutes || targetDate === excludeDate) {
    const tomorrow = new Date(`${targetDate}T12:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    targetDate = tomorrow.toISOString().slice(0, 10)
  }
  const start = Math.floor(now.getTime() / 60000) * 60000 + 60000
  for (let offset = 0; offset < 49 * 60; offset++) {
    const candidate = new Date(start + offset * 60000)
    const clock = zonedClock(candidate, timeZone)
    if (clock.date === targetDate && clock.minutes >= targetMinutes) return candidate.toISOString()
  }
  throw new Error('Could not find the next delivery time.')
}
