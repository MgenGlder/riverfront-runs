// "Add to calendar" for the recurring Sunday run — reliable reminders with no
// backend, and it works even when the app is closed (unlike web push).
// Anchored to a known Sunday; the weekly RRULE covers all future runs.
const TITLE = 'Riverfront Run Detroit'
const LOCATION = 'Detroit Riverfront (in front of the Renaissance Center)'
const DETAILS =
  'A welcoming weekly community run. All paces welcome — walk, jog, or run. https://www.meetup.com/meetup-group-frisqziq/'
const TZID = 'America/Detroit'
const START = '20260726T140000' // Sun Jul 26 2026, 2:00 PM
const END = '20260726T150000' // 3:00 PM
const RRULE = 'RRULE:FREQ=WEEKLY;BYDAY=SU'

export const GOOGLE_CAL_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE' +
  `&text=${encodeURIComponent(TITLE)}` +
  `&dates=${START}/${END}` +
  `&ctz=${TZID}` +
  `&recur=${encodeURIComponent(RRULE)}` +
  `&location=${encodeURIComponent(LOCATION)}` +
  `&details=${encodeURIComponent(DETAILS)}`

export function icsContent() {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Riverfront Run Detroit//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:riverfront-run-sunday@riverfrontruns',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;TZID=${TZID}:${START}`,
    `DTEND;TZID=${TZID}:${END}`,
    RRULE,
    `SUMMARY:${TITLE}`,
    `LOCATION:${LOCATION}`,
    `DESCRIPTION:${DETAILS}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Riverfront Run in 2 hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs() {
  const blob = new Blob([icsContent()], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'riverfront-run-detroit.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
