import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Opts = { title: string; description?: string; action?: string; destructive?: boolean }
const Ctx = createContext<(o: Opts) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(Ctx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [o, setO] = useState<Opts | null>(null)
  const res = useRef<(v: boolean) => void>(() => {})
  const ask = useCallback((opts: Opts) => new Promise<boolean>(ok => { res.current = ok; setO(opts) }), [])
  const done = (v: boolean) => { res.current(v); setO(null) }
  return (
    <Ctx.Provider value={ask}>
      {children}
      <AlertDialog open={!!o} onOpenChange={v => { if (!v) done(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{o?.title}</AlertDialogTitle>
            {o?.description && <AlertDialogDescription>{o.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => done(false)}>Retour</AlertDialogCancel>
            <AlertDialogAction variant={o?.destructive ? "destructive" : "default"} onClick={() => done(true)}>{o?.action || "Confirmer"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  )
}
