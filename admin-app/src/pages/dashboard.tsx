import { useEffect } from "react"
import { ExternalLink } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ErrorBox, Loading, PageHeader, SiteBadge, StatusOf, StockBadge } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { eur, lowOf, num, ORDER_ST, REQ_ST } from "@/lib/format"
import type { Order, Product, QuoteRequest, Stats } from "@/lib/types"

const chart = { destock: { label: "Destock (gros)", color: "var(--color-ds)" }, market: { label: "Market (détail)", color: "var(--color-mk)" } } satisfies ChartConfig

export function DashboardPage() {
  const { settings, refresh } = useApp()
  const { data, error } = useData(() => Promise.all([api<Stats>("stats"), api<Order[]>("orders"), api<QuoteRequest[]>("requests"), api<Product[]>("products")]))
  useEffect(refresh, [refresh])
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const [st, orders, reqs, prods] = data
  const low = prods.filter(p => (p.destock.active || p.market.active) && p.stock <= lowOf(p, settings)).sort((a, b) => a.stock - b.stock).slice(0, 6)
  const todoReq = reqs.filter(r => ["nouvelle", "en_cours"].includes(r.status)).slice(0, 6)
  const todoOrd = orders.filter(o => ["en_attente", "confirmee", "preparation"].includes(o.status)).slice(0, 6)
  const Row = ({ href, label, right }: { href: string; label: string; right: React.ReactNode }) => (
    <li className="flex items-center justify-between gap-3 py-2.5"><a href={href} className="min-w-0 truncate text-sm font-medium hover:underline">{label}</a><span className="flex shrink-0 gap-1.5">{right}</span></li>
  )
  const Empty = ({ children }: { children: string }) => <li className="py-6 text-center text-sm text-muted-foreground">{children}</li>
  const kpis = [
    ["CA Destock · 30 jours", eur(st.revenue30.destock), "HT, hors annulées"],
    ["CA Market · 30 jours", eur(st.revenue30.market), "HT, hors annulées"],
    ["À traiter", `${st.ordersToProcess} commandes`, `${st.newRequests} nouvelles demandes · ${st.newMessages} messages`],
    ["Stock", `${num(st.stockUnits)} unités`, `Valeur estimée ${eur(st.stockValue)} · ${st.lowStock} alertes`],
  ]
  return (
    <>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble des deux sites" actions={<>
        <Button variant="outline" asChild><a href="/destock/" target="_blank" rel="noreferrer">Destock <ExternalLink /></a></Button>
        <Button variant="outline" asChild><a href="/market/" target="_blank" rel="noreferrer">Market <ExternalLink /></a></Button>
      </>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([t, v, d]) => (
          <Card key={t}><CardHeader><CardDescription>{t}</CardDescription><CardTitle className="text-2xl tabular-nums">{v}</CardTitle><CardDescription className="text-xs">{d}</CardDescription></CardHeader></Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Ventes des 14 derniers jours</CardTitle><CardDescription>Montants HT</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={chart} className="h-64 w-full">
              <BarChart data={st.series} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={d => String(new Date(d).getDate())} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => new Date(p[0]?.payload.d).toLocaleDateString("fr-FR")} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="destock" stackId="a" fill="var(--color-destock)" />
                <Bar dataKey="market" stackId="a" fill="var(--color-market)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Meilleures ventes</CardTitle><CardAction><Button variant="link" size="sm" asChild><a href="#/produits">Produits</a></Button></CardAction></CardHeader>
          <CardContent><ul className="divide-y">{st.top.map(t => <Row key={t.id} href={"#/produits/" + t.id} label={t.name} right={<span className="text-sm text-muted-foreground tabular-nums">{num(t.units)} u.</span>} />)}{!st.top.length && <Empty>Aucune vente</Empty>}</ul></CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Demandes à traiter</CardTitle><CardAction><Button variant="link" size="sm" asChild><a href="#/demandes">Tout voir</a></Button></CardAction></CardHeader>
          <CardContent><ul className="divide-y">{todoReq.map(r => <Row key={r.id} href={"#/demandes/" + r.id} label={`${r.id} · ${r.customerName}`} right={<StatusOf map={REQ_ST} value={r.status} />} />)}{!todoReq.length && <Empty>Rien à traiter</Empty>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Commandes à préparer</CardTitle><CardAction><Button variant="link" size="sm" asChild><a href="#/commandes">Tout voir</a></Button></CardAction></CardHeader>
          <CardContent><ul className="divide-y">{todoOrd.map(o => <Row key={o.id} href={"#/commandes/" + o.id} label={`${o.id} · ${o.customerName}`} right={<><SiteBadge site={o.site} /><StatusOf map={ORDER_ST} value={o.status} /></>} />)}{!todoOrd.length && <Empty>Rien à préparer</Empty>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Alertes de stock</CardTitle><CardAction><Button variant="link" size="sm" asChild><a href="#/produits?f=low">Tout voir</a></Button></CardAction></CardHeader>
          <CardContent><ul className="divide-y">{low.map(p => <Row key={p.id} href={"#/produits/" + p.id} label={p.name} right={<StockBadge p={p} />} />)}{!low.length && <Empty>Aucune alerte</Empty>}</ul></CardContent>
        </Card>
      </div>
    </>
  )
}
