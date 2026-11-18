import { useState } from "react"
import { Download, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyRow, ErrorBox, Loading, PageHeader, SelectField, SiteBadge, StatusOf } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { dateTime, eur, opts, ORDER_ST, PAY_ST } from "@/lib/format"
import type { Order } from "@/lib/types"

export function OrdersPage() {
  const { data: list, error } = useData(() => api<Order[]>("orders"))
  const [site, setSite] = useState("all")
  const [st, setSt] = useState("all")
  const [q, setQ] = useState("")
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />
  const t = q.toLowerCase()
  const rows = list.filter(o => (site === "all" || o.site === site) && (st === "all" || (st === "todo" ? ["en_attente", "confirmee", "preparation"].includes(o.status) : o.status === st)) && (!t || [o.id, o.customerName, o.email].join(" ").toLowerCase().includes(t)))
  const total = rows.filter(o => o.status !== "annulee").reduce((s, o) => s + o.totalHT, 0)
  return (
    <>
      <PageHeader title="Commandes" description="Gros (Destock) et détail (Market)" actions={<>
        <Button variant="outline" asChild><a href="/api/admin/export/orders.csv"><Download /> Exporter</a></Button>
        <Button asChild><a href="#/commandes/nouvelle"><Plus /> Saisir une commande</a></Button>
      </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={site} onValueChange={setSite}><TabsList><TabsTrigger value="all">Toutes</TabsTrigger><TabsTrigger value="destock">Destock</TabsTrigger><TabsTrigger value="market">Market</TabsTrigger></TabsList></Tabs>
        <SelectField className="sm:w-48" value={st} onChange={setSt} options={[{ value: "all", label: "Tous statuts" }, { value: "todo", label: "À traiter" }, ...opts(ORDER_ST)]} />
        <div className="relative w-full sm:w-64"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="N°, client, e-mail…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow><TableHead className="pl-4">N°</TableHead><TableHead>Date</TableHead><TableHead>Site</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Articles</TableHead><TableHead className="text-right">Total HT</TableHead><TableHead className="text-right">Total TTC</TableHead><TableHead>Paiement</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(o => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => go("commandes/" + o.id)}>
                <TableCell className="pl-4 font-medium">{o.id}</TableCell>
                <TableCell className="text-muted-foreground">{dateTime(o.createdAt)}</TableCell>
                <TableCell><SiteBadge site={o.site} /></TableCell>
                <TableCell>{o.customerName}</TableCell>
                <TableCell className="text-right tabular-nums">{o.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(o.totalHT)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(o.totalTTC)}</TableCell>
                <TableCell><StatusOf map={PAY_ST} value={o.paymentStatus} /></TableCell>
                <TableCell><StatusOf map={ORDER_ST} value={o.status} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={9}>Aucune commande</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      <div className="mt-3 flex justify-between text-sm text-muted-foreground"><span>{rows.length} commande{rows.length > 1 ? "s" : ""}</span><span>Total HT hors annulées : <b className="text-foreground">{eur(total)}</b></span></div>
    </>
  )
}
