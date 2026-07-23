import { MEETUP_GROUP_URL, NEXT_EVENT_URL } from '../config.js'

export default function Hero({ onNavigate }) {
  return (
    <section className="hero" id="top">
      <div className="hero-inner container">
        <p className="eyebrow">Move. Connect. Detroit.</p>
        <h1 className="hero-title">
          RIVERFRONT <span className="run">RUN</span>{' '}
          <span className="detroit">DETROIT</span>
        </h1>
        <p className="hero-sub">
          A welcoming weekly run for all paces and all people.
          <br />
          Come for the run, stay for the community.
        </p>
        <div className="hero-cta">
          <a className="btn btn-lg" href={NEXT_EVENT_URL} target="_blank" rel="noopener">
            RSVP for this Sunday
          </a>
          <a className="btn btn-lg btn-ghost" href={MEETUP_GROUP_URL} target="_blank" rel="noopener">
            See the Meetup group
          </a>
        </div>
        <p className="hero-when">
          🗓️ Every Sunday · 2:00 PM &nbsp;•&nbsp; 📍 Detroit Riverfront, in front of the Ren Cen
        </p>
        <button type="button" className="hero-live-link" onClick={() => onNavigate('live')}>
          Running today? Share your location on the Live Map →
        </button>
      </div>
      <div className="hero-skyline" aria-hidden="true"></div>
    </section>
  )
}
