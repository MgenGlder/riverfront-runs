import { createContext, useContext, useEffect, useState } from 'react'
import { NEXT_EVENT_URL } from './config.js'

// Shares the live "next Meetup event" (from the Netlify function) across the
// app. Falls back to the static event URL if the fetch fails or is unavailable
// (e.g. local dev without Netlify functions).
const EventContext = createContext({ event: null, eventUrl: NEXT_EVENT_URL, loading: true })

export const useEventInfo = () => useContext(EventContext)

export function EventProvider({ children }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/.netlify/functions/next-event')
      .then((r) => r.json())
      .then((d) => {
        if (alive && d && d.ok && d.event) setEvent(d.event)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const eventUrl = event?.url || NEXT_EVENT_URL
  return <EventContext.Provider value={{ event, eventUrl, loading }}>{children}</EventContext.Provider>
}

// Format an ISO datetime (with offset) in Detroit local time.
export function formatEvent(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return null
  const opt = { timeZone: 'America/Detroit' }
  return {
    weekday: new Intl.DateTimeFormat('en-US', { ...opt, weekday: 'long' }).format(d),
    date: new Intl.DateTimeFormat('en-US', { ...opt, month: 'short', day: 'numeric' }).format(d),
    time: new Intl.DateTimeFormat('en-US', { ...opt, hour: 'numeric', minute: '2-digit' }).format(d),
  }
}
