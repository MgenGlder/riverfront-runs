import { useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Details from './components/Details.jsx'
import Attendance from './components/Attendance.jsx'
import About from './components/About.jsx'
import Faq from './components/Faq.jsx'
import CtaBand from './components/CtaBand.jsx'
import Footer from './components/Footer.jsx'
import LiveMap from './components/LiveMap.jsx'
import { EventProvider } from './eventContext.jsx'

export default function App() {
  const [view, setView] = useState('home') // 'home' | 'live'

  return (
    <EventProvider>
      <Header view={view} onNavigate={setView} />
      {view === 'home' ? (
        <main>
          <Hero onNavigate={setView} />
          <Details />
          <Attendance />
          <About />
          <Faq />
          <CtaBand />
        </main>
      ) : (
        <main>
          <LiveMap />
        </main>
      )}
      <Footer />
    </EventProvider>
  )
}
