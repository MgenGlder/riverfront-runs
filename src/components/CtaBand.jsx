import { NEXT_EVENT_URL } from '../config.js'

export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="container">
        <h2>See you Sunday!</h2>
        <p>Lace up, show up, and let's run Detroit together.</p>
        <a className="btn btn-lg btn-light" href={NEXT_EVENT_URL} target="_blank" rel="noopener">
          RSVP on Meetup
        </a>
        <p className="cta-note">
          Questions or updates? DM <strong>Kunle</strong> or <strong>Varun</strong>.
        </p>
      </div>
    </section>
  )
}
