import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { num, lowOf, type Tone } from "@/lib/format"
import { useApp } from "@/lib/app-context"
import type { Product, Site } from "@/lib/types"

const DOT: Record<Tone, string> = { warn: "bg-amber-500", info: "bg-blue-500", ok: "bg-emerald-500", bad: "bg-red-500", mute: "bg-muted-foreground/50", ds: "bg-ds", mk: "bg-mk" }

export const Status = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <Badge variant="outline" className="gap-1.5 font-medium">
    <span className={cn("size-1.5 rounded-full", DOT[tone])} />{children}
  </Badge>
)
export const StatusOf = ({ map, value }: { map: Record<string, [string, Tone]>; value: string }) => <Status tone={map[value]?.[1] || "mute"}>{map[value]?.[0] || value}</Status>
export const SiteBadge = ({ site }: { site: Site }) => <Status tone={site === "destock" ? "ds" : "mk"}>{site === "destock" ? "Destock" : "Market"}</Status>
export function StockBadge({ p }: { p: Product }) {
  const { settings } = useApp()
  if (p.stock <= 0) return <Status tone="bad">Rupture</Status>
  if (p.stock <= lowOf(p, settings)) return <Status tone="warn">{num(p.stock)} · bas</Status>
  return <Status tone="ok">{num(p.stock)}</Status>
}

export const PageHeader = ({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3 print:mb-3">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{description}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
  </div>
)

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
    </div>
  )
}

export function SelectField({ id, value, onChange, options, placeholder, disabled, className }: {
  id?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean; className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export const EmptyRow = ({ cols, children }: { cols: number; children: ReactNode }) => (
  <TableRow><TableCell colSpan={cols} className="h-24 text-center text-muted-foreground">{children}</TableCell></TableRow>
)
export const Loading = () => (
  <div className="grid gap-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-28 w-full" /><Skeleton className="h-72 w-full" /></div>
)
export const ErrorBox = ({ message }: { message: string }) => <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>

/** Exécute une action et affiche l'erreur éventuelle en toast. */
export const run = async (fn: () => Promise<unknown>) => {
  try { await fn() } catch (e) { toast.error((e as Error).message) }
}
