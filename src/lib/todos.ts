import type { JournalAnswers } from '../types'

export interface Todo { id: string; text: string; done: boolean; priority: boolean; estimate: string; completedOn: string }
export interface TodoStore { items: Todo[]; daily: Todo[]; dailyEnabled: boolean }
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function newTodo(text: string): Todo {
  return { id: crypto.randomUUID(), text, done: false, priority: false, estimate: '', completedOn: '' }
}
export function readTodos(answers?: JournalAnswers): TodoStore {
  const empty = { items: [], daily: [], dailyEnabled: false }
  try {
    const parsed = JSON.parse(String(answers?.list || '{}'))
    const normalize = (value: unknown): Todo[] => {
      if (!Array.isArray(value)) return []
      const ids = new Set<string>()
      let priorities = 0
      return value.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string' && !ids.has(item.id) && Boolean(ids.add(item.id))).map(item => ({
        id: item.id, text: item.text, done: item.done === true,
        priority: item.priority === true && ++priorities <= 3,
        estimate: typeof item.estimate === 'string' ? item.estimate : '',
        completedOn: typeof item.completedOn === 'string' ? item.completedOn : '',
      }))
    }
    return { items: normalize(parsed.items), daily: normalize(parsed.daily), dailyEnabled: parsed.dailyEnabled === true }
  } catch { return empty }
}
export function moveTodo(items: Todo[], from: string, to: string) {
  const source = items.findIndex(item => item.id === from)
  const target = items.findIndex(item => item.id === to)
  if (source < 0 || target < 0 || source === target) return items
  const result = [...items]
  const [item] = result.splice(source, 1)
  result.splice(target, 0, item)
  return result
}
