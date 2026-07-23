import { FAQS, MEETUP_GROUP_URL } from '../config.js'

export default function Faq() {
  return (
    <section className="faq" id="faq">
      <div className="container">
        <p className="eyebrow eyebrow-dark center">Good to know</p>
        <h2 className="center">Frequently asked</h2>
        <div className="faq-list">
          {FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          <details>
            <summary>How do I stay in the loop?</summary>
            <p>
              RSVP and follow us on{' '}
              <a href={MEETUP_GROUP_URL} target="_blank" rel="noopener">
                Meetup
              </a>
              , or DM Kunle or Varun with any questions.
            </p>
          </details>
        </div>
      </div>
    </section>
  )
}
