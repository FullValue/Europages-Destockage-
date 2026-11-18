import { createContext, useContext } from "react"
import type { Settings, Stats } from "./types"

export const AppCtx = createContext<{ settings: Settings | null; stats: Stats | null; refresh: () => void }>({ settings: null, stats: null, refresh: () => {} })
export const useApp = () => useContext(AppCtx)
