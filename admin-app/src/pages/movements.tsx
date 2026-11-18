import { useState } from "react"
import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, ErrorBox, Loading, PageHeader, SelectField } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { api } from "@/lib/api"
import { dateTime, num } from "@/lib/format"
import type { Movement } from "@/lib/types"

const MAX = 300

export function MovementsPage() {
  const { data: list, error } = useData(() => api<Movement[]>("movements"))
  const [q, setQ] = useState("")
  const [dir, setDir] = useState("all")
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />
  const t = q.toLowerCase()
  const rows = list.filter(m => (!t || [m.name, m.sku, m.reason, m.ref].join(" ").toLowerCase().includes(t)) && (dir === "all" || (dir === "in" ? m.delta > 0 : m.delta < 0)))
  return (
    <>
      <PageHeader title="Mouvements de stock" description="Historique de toutes les entrées et sorties" actions={<Button variant="outline" asChild><a href="/api/admin/export/movements.csv"><Download /> Exporter</a></Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Produit, SKU, motif, commande…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <SelectField className="sm:w-48" value={dir} onChange={setDir} options={[{ value: "all", label: "Entrées et sorties" }, { value: "in", label: "Entrées" }, { value: "out", label: "Sorties" }]} />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow><TableHead className="pl-4">Date</TableHead><TableHead>Produit</TableHead><TableHead className="text-right">Mouvement</TableHead><TableHead className="text-right">Stock après</TableHead><TableHead>Motif</TableHead><TableHead>Réf.</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.slice(0, MAX).map(m => (
              <TableRow key={m.id}>
                <TableCell className="pl-4 text-muted-foreground">{dateTime(m.at)}</TableCell>
                <TableCell><a className="font-medium hover:underline" href={"#/produits/" + m.productId}>{m.name}</a> <span className="text-xs text-muted-foreground">{m.sku}</span></TableCell>
                <TableCell className={"text-right font-medium tabular-nums " + (m.delta > 0 ? "text-emerald-600" : "text-red-600")}>{m.delta > 0 ? "+" : ""}{num(m.delta)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(m.stockAfter)}</TableCell>
                <TableCell>{m.reason}</TableCell>
                <TableCell>{m.ref && <a className="hover:underline" href={"#/commandes/" + m.ref}>{m.ref}</a>}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={6}>Aucun mouvement</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      {rows.length > MAX && <p className="mt-3 text-sm text-muted-foreground">{MAX} premiers sur {num(rows.length)}. Affinez la recherche ou exportez le CSV.</p>}
    </>
  )
}
