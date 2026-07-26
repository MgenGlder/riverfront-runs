// Persists an in-progress run to the device so closing/backgrounding the
// browser pauses (rather than loses) it, and reopening can resume.
const KEY = 'rrd.runSession.v1'
const RESUMABLE_MS = 3 * 60 * 60 * 1000 // offer resume for up to 3 hours

export function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    return s && s.sessionId ? s : null
  } catch {
    return null
  }
}

export function saveSession(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, updatedAt: Date.now() }))
  } catch {
    /* storage unavailable (private mode / disabled) — resume just won't persist */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// A saved run is only worth resuming if it was updated recently.
export function isResumable(s) {
  return !!s && Date.now() - (s.updatedAt || 0) < RESUMABLE_MS
}
