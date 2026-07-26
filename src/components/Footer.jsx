import { MEETUP_GROUP_URL } from '../config.js'
import { useEventInfo } from '../eventContext.jsx'

export default function Footer() {
  const { eventUrl } = useEventInfo()
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Riverfront Run Detroit</span>
        <div className="footer-links">
          <a href={MEETUP_GROUP_URL} target="_blank" rel="noopener">
            Meetup Group
          </a>
          <a href={eventUrl} target="_blank" rel="noopener">
            Next Run
          </a>
        </div>
      </div>
    </footer>
  )
}
