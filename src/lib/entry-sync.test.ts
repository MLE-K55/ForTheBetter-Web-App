// @vitest-environment jsdom
import { expect, it, vi, beforeEach } from 'vitest'
import { EntryQueue, loadPending } from './entry-sync'
const entry = (text: string) => ({ answers: { text }, completed: false, updatedAt: '2026-10-06T12:00:00Z' })
beforeEach(() => localStorage.clear())
it('keeps failed edits across reload and retries without mixing accounts', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  const queue = new EntryQueue('one', send, vi.fn())
  queue.add('page', entry('keep me'))
  await queue.flush(); await Promise.resolve()
  expect(loadPending('one').page.answers.text).toBe('keep me')
  expect(loadPending('two')).toEqual({})
  const restored = new EntryQueue('one', send, vi.fn())
  await restored.flush()
  expect(send).toHaveBeenLastCalledWith('page', entry('keep me'))
  expect(loadPending('one')).toEqual({})
})
it('sends edits in order and cannot acknowledge a newer edit with an older response', async () => {
  let resolve!: () => void
  const send = vi.fn().mockImplementationOnce(() => new Promise<void>(done => { resolve = done })).mockResolvedValue(undefined)
  const queue = new EntryQueue('one', send, vi.fn())
  queue.add('page', entry('first'))
  queue.add('page', entry('latest'))
  expect(send).toHaveBeenCalledTimes(1)
  resolve(); await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
  expect(send).toHaveBeenLastCalledWith('page', entry('latest'))
  expect(loadPending('one')).toEqual({})
})
it('does not claim a durable recovery copy when browser storage fails', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  const changed = vi.fn()
  const queue = new EntryQueue('one', vi.fn().mockRejectedValue(new Error('offline')), changed)
  queue.add('page', entry('draft'))
  expect(changed).toHaveBeenCalledWith(true, false)
  storage.mockRestore()
})
