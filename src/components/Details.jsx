import { DETAILS } from '../config.js'

export default function Details() {
  return (
    <section className="details" id="details">
      <div className="container detail-grid">
        {DETAILS.map((d) => (
          <div className="card" key={d.title}>
            <div className="card-icon">{d.icon}</div>
            <h3>{d.title}</h3>
            <p className="card-lead">{d.lead}</p>
            <p>{d.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
