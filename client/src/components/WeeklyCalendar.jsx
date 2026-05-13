import './WeeklyCalendar.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOUR_START = 8   // 8am
const HOUR_END   = 20  // 8pm
const TOTAL_HOURS = HOUR_END - HOUR_START
const PX_PER_HOUR = 64 // height of one hour slot in px

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToOffset(mins) {
  // px from top of the grid
  return ((mins - HOUR_START * 60) / 60) * PX_PER_HOUR
}

function minutesToHeight(durationMins) {
  return (durationMins / 60) * PX_PER_HOUR
}

function formatHour(h) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

export default function WeeklyCalendar({ courses }) {
  const totalHeight = TOTAL_HOURS * PX_PER_HOUR
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)

  // Build events per day
  const eventsByDay = {}
  DAYS.forEach((d) => { eventsByDay[d] = [] })

  courses.forEach((course) => {
    course.days.forEach((day) => {
      if (!eventsByDay[day]) return
      const startMins = timeToMinutes(course.startTime)
      const endMins   = timeToMinutes(course.endTime)
      eventsByDay[day].push({
        ...course,
        startMins,
        endMins,
        top: minutesToOffset(startMins),
        height: minutesToHeight(endMins - startMins),
      })
    })
  })

  // Current time indicator
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const showNow = nowMins >= HOUR_START * 60 && nowMins <= HOUR_END * 60
  const nowTop = showNow ? minutesToOffset(nowMins) : null

  return (
    <div className="wc-root">
      {/* Day headers */}
      <div className="wc-header">
        <div className="wc-time-gutter" aria-hidden="true" />
        {DAYS.map((day) => (
          <div key={day} className="wc-day-header">
            {day}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="wc-body">
        {/* Time gutter */}
        <div className="wc-time-gutter" aria-hidden="true">
          {hours.map((h) => (
            <div
              key={h}
              className="wc-hour-label"
              style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="wc-day-col"
            style={{ height: totalHeight }}
            role="region"
            aria-label={`${day} schedule`}
          >
            {/* Hour grid lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="wc-grid-line"
                style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
              />
            ))}

            {/* Current time line */}
            {showNow && (
              <div className="wc-now-line" style={{ top: nowTop }} aria-label="Current time" />
            )}

            {/* Course blocks */}
            {eventsByDay[day].map((ev, idx) => (
              <div
                key={`${ev.code}-${idx}`}
                className="wc-event"
                style={{
                  top: ev.top + 1,
                  height: ev.height - 2,
                  borderLeftColor: ev.color,
                  '--event-color': ev.color,
                }}
                title={`${ev.code}: ${ev.title}\n${ev.startTime}–${ev.endTime}\n${ev.building} ${ev.room}`}
                role="article"
                aria-label={`${ev.code} from ${ev.startTime} to ${ev.endTime}`}
              >
                <span className="wc-event-code">{ev.code}</span>
                {ev.height >= 44 && (
                  <span className="wc-event-time">
                    {ev.startTime}–{ev.endTime}
                  </span>
                )}
                {ev.height >= 58 && (
                  <span className="wc-event-room">
                    {ev.building} {ev.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
