import { useEventInfo } from '../eventContext.jsx'

export default function About() {
  const { eventUrl } = useEventInfo()
  return (
    <section className="about" id="about">
      <div className="container about-grid">
        <div className="about-copy">
          <p className="eyebrow eyebrow-dark">About the run</p>
          <h2>
            Lace up. Show up.
            <br />
            <span className="detroit">Let's run Detroit.</span>
          </h2>
          <p>
            Riverfront Run Detroit is a free, weekly community run along the Detroit International
            Riverfront. Whether you're chasing a PR or out for your very first walk, there's a spot
            for you in the group.
          </p>
          <p>
            We meet in front of the Renaissance Center every Sunday at 2:00 PM, take in the skyline
            and the water, and finish the way we started — together.
          </p>
          <ul className="checklist">
            <li>Free, every week — no registration fee</li>
            <li>Beginner-friendly, walk or run at your own pace</li>
            <li>Scenic, flat riverfront route</li>
            <li>A community that sticks around after the finish</li>
          </ul>
          <a className="btn" href={eventUrl} target="_blank" rel="noopener">
            Join this Sunday's run
          </a>
        </div>
        <div className="about-flyer">
          <img
            src="/flyer.png"
            alt="Riverfront Run Detroit flyer — Every Sunday 2:00 PM at the Detroit Riverfront in front of the Ren Cen"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
