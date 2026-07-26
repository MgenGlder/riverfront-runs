// Reads the Meetup group's public events page and returns the NEXT upcoming
// event (title, exact time, link, and the "going" count). Runs on Netlify so
// it's same-origin for the site and keeps the Fly server out of it.
// Unofficial (parses Meetup's embedded JSON) — the client falls back to static
// info if this ever fails.
const GROUP = 'meetup-group-frisqziq'
const EVENTS_URL = `https://www.meetup.com/${GROUP}/events/`
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function extractEvents(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return []
  const data = JSON.parse(m[1])
  const out = []
  const seen = new Set()
  const walk = (o) => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) return o.forEach(walk)
    if (o.title && o.dateTime && o.eventUrl && !seen.has(o.id)) {
      seen.add(o.id)
      const going = o.going && typeof o.going === 'object' ? o.going.totalCount ?? o.going.count : null
      out.push({ id: o.id, title: o.title, dateTime: o.dateTime, url: o.eventUrl, going, status: o.status })
    }
    for (const k in o) walk(o[k])
  }
  walk(data)
  return out
}

export const handler = async () => {
  try {
    const res = await fetch(EVENTS_URL, {
      headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' },
    })
    if (!res.ok) throw new Error(`meetup ${res.status}`)
    const events = extractEvents(await res.text())
    const now = Date.now()
    const next =
      events
        .filter((e) => !e.status || e.status === 'ACTIVE')
        // keep the current run visible for a few hours after it starts
        .filter((e) => new Date(e.dateTime).getTime() >= now - 4 * 3600 * 1000)
        .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))[0] || null
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        // cache at the CDN for 5 min so we don't refetch Meetup on every visit
        'cache-control': 'public, max-age=300, s-maxage=300',
      },
      body: JSON.stringify({ ok: true, event: next, fetchedAt: new Date().toISOString() }),
    }
  } catch (e) {
    // Return ok:false (still 200) so the client falls back cleanly to static info.
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
      body: JSON.stringify({ ok: false, error: String(e?.message || e) }),
    }
  }
}
