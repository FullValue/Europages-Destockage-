import { useEffect, useState } from "react"

function parse() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?")
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(query) }
}
export function useHashRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0) }
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return route
}
export const go = (path: string) => { location.hash = "#/" + path.replace(/^\//, "") }
