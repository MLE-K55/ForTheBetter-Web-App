import type { JournalPage } from '../types'

const myWhyPage: JournalPage = {
  id: 'week-1-my-why',
  week: 1,
  day: 0,
  eyebrow: 'Week 1 · Day 1 Foundation',
  title: 'My Why',
  intro: 'In order to change and truly change, you have to have a why. Why do you want to be better? Is it for family, friends, or yourself?',
  fields: [
    { id: 'team', label: 'Who is on your team? List the people who support your growth and who you want beside you as you change.', kind: 'textarea', required: true },
    { id: 'not-become', label: 'Describe the person you do not want to become.', kind: 'textarea', required: true },
    { id: 'avoid-traits', label: 'What traits, habits, and choices does that person have?', kind: 'textarea', required: true },
    { id: 'desired-traits', label: 'Now write the opposite. What traits, habits, and choices belong to the person you want to be?', kind: 'textarea', required: true },
    { id: 'personal-why', label: 'Why are you changing for you?', kind: 'textarea', required: true },
  ],
}

const dailyQuotes = [
  'The best way to predict your future is to create it. Abraham Lincoln',
  'Success is not final, failure is not fatal: It is the courage to continue that counts. Winston Churchill',
  'It’s not the size of the dog in the fight, it’s the size of the fight in the dog. Mark Twain',
  'You must expect great things of yourself before you can do them. Michael Jordan',
  'Do not wait to strike till the iron is hot, but make it hot by striking. William Butler Yeats',
  'The only limit to our realization of tomorrow is our doubts of today. Franklin D. Roosevelt',
  'A man who stands for nothing will fall for anything. Malcolm X',
]

const lessons = [
  {
    title: 'Eliminate Waste',
    intro: 'Before you can get better, you need to see what is getting in your way. This week is about finding the habits, distractions, and wasted time that keep holding you back.',
    fields: [
      ['waste', 'List three major areas in your life where you’re wasting time, energy, or money. Be specific.'],
      ['impact', 'For each area, how is it negatively affecting your progress?'],
      ['action', 'How will you reduce or eliminate these? Write one concrete action for each.'],
      ['replace', 'What will you do instead to fill that time with something productive?'],
      ['today', 'What is one thing you can do TODAY to start eliminating waste?'],
    ],
  },
  {
    title: 'Optimize Your Environment',
    intro: 'Your surroundings affect what you do. This week, set up your space and your time so it is easier to make better choices.',
    fields: [
      ['space', 'What area do you spend the most time in? What helps you focus there?'],
      ['distraction', 'What constantly distracts you, and how can you remove or minimize it?'],
      ['routine', 'When do you feel most productive? What bad habits creep into your routine?'],
      ['circle', 'Who pushes you to improve, and who drains your energy?'],
      ['inputs', 'What can you remove or change this week to improve your mental clarity?'],
    ],
  },
  {
    title: 'Mastering Focus & Eliminating Distractions',
    intro: 'It is hard to make progress when everything is pulling at your attention. This week, figure out what distracts you and take back control of your time.',
    fields: [
      ['distractions', 'What are the top three things that pull your attention away from important tasks?'],
      ['hours', 'When are your peak focus hours? When is your free time?'],
      ['place', 'Where is the best place for you to focus and feel energized?'],
      ['changes', 'What changes can you make to your space to reduce distractions?'],
    ],
  },
  {
    title: 'Powerful Morning Routine',
    intro: 'How you start the morning can affect the rest of your day. Build a routine that is realistic, simple, and something you can actually keep doing.',
    fields: [
      ['wake', 'What time will you wake up?'],
      ['habits', 'Choose at least three morning habits you will not skip.'],
      ['routine', 'Write your ideal morning routine in the order you’ll complete it. Keep it realistic and repeatable.'],
      ['commitment', 'Commit to following your morning routine for seven days. What will keep you accountable?'],
    ],
  },
  {
    title: 'Strong Bedtime Routine',
    intro: 'A good night starts before you get into bed. Build a simple routine that helps you slow down, get enough sleep, and feel ready for tomorrow.',
    fields: [
      ['wake', 'What time do you need to wake up?'],
      ['sleep', 'How many hours of sleep do you need, and what time must you be asleep?'],
      ['disruption', 'What distraction keeps you up, and what will you do to eliminate it?'],
      ['nonnegotiables', 'What three things do you need to do before bed to wind down?'],
      ['tomorrow', 'What three things can you set up now to make tomorrow smoother?'],
      ['accountability', 'How will you hold yourself accountable to this routine?'],
    ],
  },
  {
    title: 'Budgeting & Accountability',
    intro: 'Money gets easier to manage when you know where it is going. Be honest about what comes in, what goes out, and what you can change.',
    fields: [
      ['income', 'What is your total monthly income?'],
      ['expenses', 'What are your estimated total monthly expenses?'],
      ['cuts', 'Where can you reduce unnecessary spending?'],
      ['savings', 'What amount can you consistently save each month?'],
      ['accountability', 'How will you track every purchase and stay accountable?'],
    ],
  },
  {
    title: 'Reflection & Course Correction',
    intro: 'Look back at what has happened so far. Keep what is working, be honest about what is not, and decide what you need to change.',
    draft: true,
    fields: [
      ['wins', 'What have been your strongest wins so far?'],
      ['setbacks', 'What setbacks or repeated patterns have slowed you down?'],
      ['working', 'What is working well enough to keep?'],
      ['change', 'What specific change will you make this week?'],
    ],
  },
  {
    title: 'Pushing Beyond Your Comfort Zone',
    intro: 'Growth can feel uncomfortable. Pick something you have been avoiding and take one real step toward it.',
    draft: true,
    fields: [
      ['avoidance', 'What have you been avoiding because it feels uncomfortable?'],
      ['challenge', 'What challenge will you take on this week?'],
      ['first-step', 'What is the smallest courageous first step?'],
      ['learning', 'What did stepping outside your comfort zone teach you?'],
    ],
  },
  {
    title: 'Teach & Lead Others',
    intro: 'One way to prove that you have learned something is to live it and share it. Think about who you can help and how you can lead by example.',
    draft: true,
    fields: [
      ['lesson', 'What lesson from these nine weeks matters most to you?'],
      ['person', 'Who could benefit from what you learned?'],
      ['share', 'How will you share or demonstrate this lesson?'],
      ['lead', 'What does leading by example look like in your daily life?'],
    ],
  },
]

export const journalPages: JournalPage[] = lessons.flatMap((lesson, index) => {
  const week = index + 1
  const lessonPage: JournalPage = {
    id: `week-${week}-lesson`,
    week,
    day: 0,
    eyebrow: `Week ${week} · Lesson`,
    title: lesson.title,
    intro: lesson.intro,
    sourceStatus: lesson.draft ? 'draft' : 'confirmed',
    fields: lesson.fields.map(([id, label]) => ({ id, label, kind: 'textarea', required: true })),
  }

  const days: JournalPage[] = Array.from({ length: 7 }, (_, dayIndex) => ({
    id: `week-${week}-day-${dayIndex + 1}`,
    week,
    day: dayIndex + 1,
    eyebrow: `Week ${week} · Day ${dayIndex + 1}`,
    title: 'Daily Reflection',
    quote: dailyQuotes[dayIndex],
    fields: [
      { id: 'date', label: 'Date', kind: 'date', required: true },
      { id: 'mission', label: 'Main Mission', kind: 'textarea', required: true },
      { id: 'today', label: 'Do It Today', kind: 'checklist', required: true, count: 3 },
      { id: 'gratitude', label: 'I am grateful for…', kind: 'checklist', required: true, count: 3 },
      { id: 'review', label: 'Daily Reflection', kind: 'textarea', required: true },
    ],
  }))

  const reflection: JournalPage = {
    id: `week-${week}-reflection`,
    week,
    day: 8,
    eyebrow: `Week ${week} · Reflection`,
    title: 'Take Ownership, Make Progress',
    intro: 'Real growth comes from being honest with yourself. Do not beat yourself up. Learn from the week and keep improving.',
    fields: [
      { id: 'wins', label: 'What were your biggest wins this week?', kind: 'textarea', required: true },
      { id: 'challenges', label: 'What were your biggest challenges or setbacks?', kind: 'textarea', required: true },
      { id: 'response', label: 'How did you handle those challenges?', kind: 'textarea', required: true },
      { id: 'improve', label: 'What can you improve for next week?', kind: 'textarea', required: true },
      { id: 'learned', label: 'What did you learn this week?', kind: 'textarea', required: true },
      { id: 'lesson', label: 'Did you succeed at this week’s lesson?', kind: 'textarea', required: true },
    ],
  }

  return index === 0 ? [myWhyPage, lessonPage, ...days, reflection] : [lessonPage, ...days, reflection]
})

export const totalDays = 63
export const totalPages = journalPages.length

export function availabilityDay(page: JournalPage) {
  const weekStart = (page.week - 1) * 7
  if (page.day === 0) return weekStart
  if (page.day === 8) return weekStart + 6
  return weekStart + page.day - 1
}
