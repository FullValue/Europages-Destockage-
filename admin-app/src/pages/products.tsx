import { useMemo, useState } from "react"
import { Download, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, ErrorBox, Loading, PageHeader, SelectField, Status, StockBadge } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { DS_ST, eur, imgUrl, lowOf } from "@/lib/format"
import type { Product } from "@/lib/types"

export function ProductsPage({ initialFilter }: { initialFilter: string }) {
  const { settings } = useApp()
  const { data: list, error } = useData(() => api<Product[]>("products"))
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [ch, setCh] = useState("all")
  const [f, setF] = useState(initialFilter)
  const [sort, setSort] = useState("recent")
  const cats = settings?.categories || {}
  const rows = useMemo(() => {
    const t = q.toLowerCase()
    return (list || []).filter(p =>
      (!t || [p.name, p.sku, p.destock.ref, p.market.title].join(" ").toLowerCase().includes(t)) &&
      (cat === "all" || p.cat === cat) &&
      (ch === "all" || (ch === "destock" ? p.destock.active : ch === "market" ? p.market.active : ch === "both" ? p.destock.active && p.market.active : !p.destock.active && !p.market.active)) &&
      (f === "all" || (f === "out" ? p.stock <= 0 : p.stock <= lowOf(p, settings)))
    ).sort(sort === "stock" ? (a, b) => a.stock - b.stock : sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [list, q, cat, ch, f, sort, settings])
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />
  return (
    <>
      <PageHeader title="Produits & stock" description={`${list.length} produits · catalogue commun aux deux sites`} actions={<>
        <Button variant="outline" asChild><a href="/api/admin/export/products.csv"><Download /> Exporter</a></Button>
        <Button asChild><a href="#/produits/nouveau"><Plus /> Nouveau produit</a></Button>
      </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Nom, SKU, référence…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <SelectField className="sm:w-52" value={cat} onChange={setCat} options={[{ value: "all", label: "Toutes catégories" }, ...Object.entries(cats).map(([value, c]) => ({ value, label: c.name }))]} />
        <SelectField className="sm:w-48" value={ch} onChange={setCh} options={[{ value: "all", label: "Tous canaux" }, { value: "destock", label: "En ligne sur Destock" }, { value: "market", label: "En ligne sur Market" }, { value: "both", label: "Sur les deux" }, { value: "none", label: "Hors ligne" }]} />
        <SelectField className="sm:w-40" value={f} onChange={setF} options={[{ value: "all", label: "Tout le stock" }, { value: "low", label: "Stock bas" }, { value: "out", label: "En rupture" }]} />
        <SelectField className="sm:w-40" value={sort} onChange={setSort} options={[{ value: "recent", label: "Plus récents" }, { value: "stock", label: "Stock croissant" }, { value: "name", label: "Nom A→Z" }]} />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow><TableHead className="pl-4">Produit</TableHead><TableHead>Catégorie</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Destock (gros)</TableHead><TableHead>Market (détail)</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(p => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => go("produits/" + p.id)}>
                <TableCell className="pl-4"><div className="flex min-w-64 items-center gap-3">
                  {p.images[0] ? <img src={imgUrl(p.images[0])} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border bg-white object-contain" /> : <div className="size-10 shrink-0 rounded-md border bg-muted" />}
                  <div className="min-w-0"><div className="max-w-sm truncate font-medium">{p.name}</div><div className="max-w-sm truncate text-xs text-muted-foreground">{p.sku} · {p.cond}</div></div>
                </div></TableCell>
                <TableCell className="text-muted-foreground">{cats[p.cat]?.name || p.cat}</TableCell>
                <TableCell className="text-right"><StockBadge p={p} /></TableCell>
                <TableCell>{p.destock.active ? <div className="flex flex-col items-start gap-1"><Status tone="ds">En ligne</Status><span className="text-xs text-muted-foreground">{p.destock.status === "disponible" ? eur(p.destock.lotPrice) + " / lot" : DS_ST[p.destock.status || ""]}</span></div> : <Status tone="mute">Hors ligne</Status>}</TableCell>
                <TableCell>{p.market.active ? <div className="flex flex-col items-start gap-1"><Status tone="mk">En ligne</Status><span className="text-xs text-muted-foreground">{eur(p.market.price)} TTC</span></div> : <Status tone="mute">Hors ligne</Status>}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>Aucun produit</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-sm text-muted-foreground">{rows.length} résultat{rows.length > 1 ? "s" : ""}</p>
    </>
  )
}
