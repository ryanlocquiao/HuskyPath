import { useState } from 'react'
import WeeklyCalendar from './WeeklyCalendar'
import './ScheduleResults.css'

export default function ScheduleResults({ schedules, query, onReset }) {
  const [selected, setSelected] = useState(schedules[0]?.id ?? null)
  const [view, setView] = useState('split') // 'split' | 'cards' | 'calendar'

  const activeSchedule = schedules.find((s) => s.id === selected) ?? schedules[0]
  const totalCredits = (sched) =>
    sched.courses.reduce((sum, c) => sum + (c.credits ?? 0), 0)

  const handleExport = () => {
    if (!activeSchedule) return
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HuskyPath//UW Schedule//EN',
    ]
    activeSchedule.courses.forEach((course) => {
      course.days.forEach((day) => {
        const dayMap = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR' }
        const [sh, sm] = course.startTime.split(':').map(Number)
        const [eh, em] = course.endTime.split(':').map(Number)
        // Use a fixed near-future Monday as anchor
        const anchor = new Date(2026, 6, 27) // July 27, 2026 (Mon)
        const offset = ['Mon','Tue','Wed','Thu','Fri'].indexOf(day)
        const d = new Date(anchor)
        d.setDate(anchor.getDate() + offset)
        const fmt = (dt, h, m) =>
          `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}00`
        lines.push(
          'BEGIN:VEVENT',
          `SUMMARY:${course.code} - ${course.title}`,
          `DTSTART:${fmt(d, sh, sm)}`,
          `DTEND:${fmt(d, eh, em)}`,
          `LOCATION:${course.building} ${course.room}`,
          `DESCRIPTION:${course.instructor}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${dayMap[day]};COUNT=10`,
          'END:VEVENT',
        )
      })
    })
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `huskypath-schedule-${activeSchedule.rank}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="sr-root">
      {/* ── Top bar ── */}
      <div className="sr-topbar">
        <div className="sr-topbar-left">
          <button className="sr-back" onClick={onReset} aria-label="New search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New search
          </button>
          <div className="sr-query-pill">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0}}>
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span>{query}</span>
          </div>
        </div>

        <div className="sr-view-toggle" role="group" aria-label="View mode">
          {[
            { key: 'split', label: 'Split' },
            { key: 'cards', label: 'Cards' },
            { key: 'calendar', label: 'Calendar' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`sr-view-btn ${view === key ? 'sr-view-btn--active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`sr-body sr-body--${view}`}>
        {/* ── Schedule cards ── */}
        {(view === 'split' || view === 'cards') && (
          <aside className="sr-sidebar">
            <p className="sr-found">{schedules.length} schedules found</p>
            <div className="sr-cards">
              {schedules.map((sched) => (
                <div
                  key={sched.id}
                  className={`sr-card ${selected === sched.id ? 'sr-card--selected' : ''}`}
                  onClick={() => setSelected(sched.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(sched.id)}
                >
                  <div className="sr-card-header">
                    <div className="sr-card-rank">#{sched.rank}</div>
                    <div className="sr-score-pill">
                      <div
                        className="sr-score-fill"
                        style={{ width: `${sched.score}%` }}
                      />
                      <span>{sched.score}</span>
                    </div>
                  </div>
                  <p className="sr-card-label">{sched.label}</p>
                  <p className="sr-card-explanation">{sched.explanation}</p>

                  <div className="sr-courses">
                    {sched.courses.map((course) => (
                      <div key={course.code} className="sr-course-row">
                        <span
                          className="sr-course-dot"
                          style={{ background: course.color }}
                        />
                        <span className="sr-course-code">{course.code}</span>
                        <span className="sr-course-time">
                          {course.days.join('/')} {course.startTime}–{course.endTime}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="sr-card-stats">
                    <span>{totalCredits(sched)} credits</span>
                    <span>{sched.courses.length} courses</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* ── Calendar ── */}
        {(view === 'split' || view === 'calendar') && activeSchedule && (
          <div className="sr-calendar-wrap">
            <div className="sr-calendar-header">
              <div>
                <h2 className="sr-cal-title">{activeSchedule.label}</h2>
                <p className="sr-cal-sub">
                  {totalCredits(activeSchedule)} credits &middot; {activeSchedule.courses.length} courses
                </p>
              </div>
              <button className="sr-export-btn" onClick={handleExport}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Export .ics
              </button>
            </div>
            <WeeklyCalendar courses={activeSchedule.courses} />
          </div>
        )}
      </div>
    </div>
  )
}
