import { MEETUP_GROUP_URL, NEXT_EVENT_URL } from '../config.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Riverfront Run Detroit</span>
        <div className="footer-links">
          <a href={MEETUP_GROUP_URL} target="_blank" rel="noopener">
            Meetup Group
          </a>
          <a href={NEXT_EVENT_URL} target="_blank" rel="noopener">
            Next Run
          </a>
        </div>
      </div>
    </footer>
  )
}
