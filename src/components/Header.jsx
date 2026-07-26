import { useEventInfo } from '../eventContext.jsx'

export default function Header({ view, onNavigate }) {
  const { eventUrl } = useEventInfo()
  const onLive = view === 'live'
  return (
    <header className="site-header">
      <nav className="nav container">
        <a
          href="#top"
          className="brand"
          onClick={() => onNavigate('home')}
        >
          <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 15.5l4.2-1.3 2.6-3.1 3.4.6 2.1-2.6 5.7-1.4-.5-1.9-5 1.2-2.2 2.7-3.8-.7-3 3.6L3 13.5z" />
          </svg>
          <span>Riverfront Run<span className="brand-accent"> Detroit</span></span>
        </a>
        <div className="nav-links">
          {!onLive && (
            <>
              <a href="#details">Details</a>
              <a href="#about">About</a>
              <a href="#faq">FAQ</a>
            </>
          )}
          <button
            type="button"
            className={`nav-tab${onLive ? ' active' : ''}`}
            onClick={() => onNavigate(onLive ? 'home' : 'live')}
          >
            {onLive ? '← Home' : '📍 Live Map'}
          </button>
          <a className="btn btn-sm" href={eventUrl} target="_blank" rel="noopener">
            Join Sunday
          </a>
        </div>
      </nav>
    </header>
  )
}
