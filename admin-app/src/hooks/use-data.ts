import { useCallback, useEffect, useRef, useState } from "react"

export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef(fn)
  ref.current = fn
  const reload = useCallback(async () => {
    try { setData(await ref.current()); setError(null) }
    catch (e) { setError((e as Error).message) }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); reload() }, deps)
  return { data, error, reload, setData }
}
