import * as React from "react"

export const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

/** Server/first-paint default: assume desktop, like the rest of the shell. */
function getServerSnapshot() {
  return false
}

/**
 * Reports whether the viewport is narrower than the mobile breakpoint.
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect`: the media
 * query is an external store, so this reads it as the single source of truth and
 * never calls `setState` synchronously inside an effect (which the React
 * Compiler lint rejects because it triggers a cascading render).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
