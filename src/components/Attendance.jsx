import { useEventInfo, formatEvent } from '../eventContext.jsx'

const MAX_DOTS = 12

export default function Attendance() {
  const { event, eventUrl, loading } = useEventInfo()

  // Nothing to show until we have a live event with a count.
  if (loading || !event || event.going == null) return null

  const going = event.going
  const when = event.dateTime ? formatEvent(event.dateTime) : null
  const dots = Math.min(going, MAX_DOTS)
  const extra = going - dots

  return (
    <section className="attendance" id="attending">
      <div className="container attendance-inner">
        <p className="eyebrow eyebrow-dark">Who’s coming</p>
        <h2>
          <span className="attend-count">{going}</span> {going === 1 ? 'person is' : 'people are'} in
          {when ? ` for ${when.weekday}` : ' for the next run'}
        </h2>
        {when && (
          <p className="attend-when">
            {when.weekday}, {when.date} · {when.time} · Detroit Riverfront
          </p>
        )}

        <div className="avatars" aria-hidden="true">
          {Array.from({ length: dots }).map((_, i) => (
            <span className="avatar" key={i} style={{ '--i': i }}>
              🏃
            </span>
          ))}
          {extra > 0 && <span className="avatar avatar-more">+{extra}</span>}
        </div>
        <p className="attend-note">Anonymous count from Meetup — RSVP to add yourself.</p>

        <a className="btn btn-lg" href={eventUrl} target="_blank" rel="noopener">
          RSVP on Meetup
        </a>
      </div>
    </section>
  )
}
