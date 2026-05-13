import { useState } from 'react'
import ConstraintInput from './components/ConstraintInput'
import ScheduleResults from './components/ScheduleResults'
import './App.css'

function App() {
  const [phase, setPhase] = useState('input') // 'input' | 'loading' | 'results'
  const [schedules, setSchedules] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (inputText) => {
    setQuery(inputText)
    setPhase('loading')
    setError(null)

    try {
      // Hit the NLP parser endpoint — returns 501 until Kieran's parser is live
      const res = await fetch('http://localhost:3001/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inputText }),
      })

      if (res.status === 501) {
        // Endpoint not implemented yet — use mock data
        await new Promise((r) => setTimeout(r, 1200)) // simulate latency
        setSchedules(MOCK_SCHEDULES)
        setPhase('results')
        return
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setSchedules(data.schedules ?? MOCK_SCHEDULES)
      setPhase('results')
    } catch (err) {
      // Network error (server not running) — fall back to mock
      await new Promise((r) => setTimeout(r, 800))
      setSchedules(MOCK_SCHEDULES)
      setPhase('results')
    }
  }

  const handleReset = () => {
    setPhase('input')
    setSchedules([])
    setQuery('')
    setError(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark">H</span>
            <span className="brand-name">HuskyPath</span>
          </div>
          <p className="brand-tagline">AI-powered schedule planner for UW students</p>
        </div>
      </header>

      <main className="app-main">
        {phase === 'input' && (
          <ConstraintInput onSubmit={handleSubmit} />
        )}
        {phase === 'loading' && (
          <div className="loading-state">
            <div className="loading-ring">
              <span />
              <span />
              <span />
            </div>
            <p className="loading-label">Parsing your preferences…</p>
            <p className="loading-sub">Finding conflict-free schedules for you</p>
          </div>
        )}
        {phase === 'results' && (
          <ScheduleResults
            schedules={schedules}
            query={query}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>HuskyPath &middot; DYOP Final Project &middot; University of Washington</p>
      </footer>
    </div>
  )
}

// ─── MOCK DATA (used when server returns 501) ─────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const MOCK_SCHEDULES = [
  {
    id: 1,
    rank: 1,
    score: 91,
    label: 'Light mornings, open Friday',
    explanation:
      'All classes start at 10am or later, your Friday is completely free, and lecture blocks are separated by at least one hour.',
    courses: [
      {
        code: 'CSE 311',
        title: 'Foundations of Computing I',
        credits: 4,
        instructor: 'BEAME, P',
        days: ['Mon', 'Wed', 'Fri'],
        startTime: '10:30',
        endTime: '11:20',
        building: 'EEB',
        room: '105',
        color: '#5b8af5',
      },
      {
        code: 'MATH 307',
        title: 'Introduction to Differential Equations',
        credits: 3,
        instructor: 'LOVELESS, A',
        days: ['Tue', 'Thu'],
        startTime: '11:30',
        endTime: '12:50',
        building: 'SMI',
        room: '304',
        color: '#f5a623',
      },
      {
        code: 'ENGL 202',
        title: 'Critical Practice: Argument',
        credits: 5,
        instructor: 'DANIELS, R',
        days: ['Mon', 'Wed'],
        startTime: '13:30',
        endTime: '14:50',
        building: 'SAV',
        room: '131',
        color: '#50c878',
      },
    ],
  },
  {
    id: 2,
    rank: 2,
    score: 84,
    label: 'Compact Tuesday–Thursday',
    explanation:
      'Heavy T/Th load keeps Mon, Wed, Fri light. All classes cluster between 10am–3pm with no dead gaps over 90 minutes.',
    courses: [
      {
        code: 'CSE 311',
        title: 'Foundations of Computing I',
        credits: 4,
        instructor: 'BEAME, P',
        days: ['Mon', 'Wed', 'Fri'],
        startTime: '10:30',
        endTime: '11:20',
        building: 'EEB',
        room: '105',
        color: '#5b8af5',
      },
      {
        code: 'MATH 307',
        title: 'Introduction to Differential Equations',
        credits: 3,
        instructor: 'LOVELESS, A',
        days: ['Tue', 'Thu'],
        startTime: '10:00',
        endTime: '11:20',
        building: 'SMI',
        room: '304',
        color: '#f5a623',
      },
      {
        code: 'ENGL 202',
        title: 'Critical Practice: Argument',
        credits: 5,
        instructor: 'DANIELS, R',
        days: ['Tue', 'Thu'],
        startTime: '13:00',
        endTime: '14:20',
        building: 'SAV',
        room: '131',
        color: '#50c878',
      },
    ],
  },
  {
    id: 3,
    rank: 3,
    score: 76,
    label: 'Balanced spread',
    explanation:
      'Credits distributed evenly M–F. No day exceeds 3 hours of class. Slightly earlier start on Mon to leave late afternoons free.',
    courses: [
      {
        code: 'CSE 311',
        title: 'Foundations of Computing I',
        credits: 4,
        instructor: 'BEAME, P',
        days: ['Mon', 'Wed', 'Fri'],
        startTime: '09:30',
        endTime: '10:20',
        building: 'EEB',
        room: '105',
        color: '#5b8af5',
      },
      {
        code: 'MATH 307',
        title: 'Introduction to Differential Equations',
        credits: 3,
        instructor: 'LOVELESS, A',
        days: ['Mon', 'Wed'],
        startTime: '12:00',
        endTime: '13:20',
        building: 'SMI',
        room: '304',
        color: '#f5a623',
      },
      {
        code: 'ENGL 202',
        title: 'Critical Practice: Argument',
        credits: 5,
        instructor: 'DANIELS, R',
        days: ['Tue', 'Thu'],
        startTime: '11:30',
        endTime: '12:50',
        building: 'SAV',
        room: '131',
        color: '#50c878',
      },
    ],
  },
]

export default App
