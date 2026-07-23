import { NEXT_EVENT_URL } from '../config.js'
import { GOOGLE_CAL_URL, downloadIcs } from '../calendar.js'

export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="container">
        <h2>See you Sunday!</h2>
        <p>Lace up, show up, and let's run Detroit together.</p>
        <div className="cta-buttons">
          <a className="btn btn-lg btn-light" href={NEXT_EVENT_URL} target="_blank" rel="noopener">
            RSVP on Meetup
          </a>
          <a className="btn btn-lg btn-ghost" href={GOOGLE_CAL_URL} target="_blank" rel="noopener">
            Add to Google Calendar
          </a>
          <button type="button" className="btn btn-lg btn-ghost" onClick={downloadIcs}>
            Download .ics
          </button>
        </div>
        <p className="cta-note">
          Weekly reminder, every Sunday at 2 PM — with a heads-up 2 hours before.
        </p>
        <p className="cta-note">
          Questions or updates? DM <strong>Kunle</strong> or <strong>Varun</strong>.
        </p>
      </div>
    </section>
  )
}
