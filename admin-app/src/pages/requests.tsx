import { useEffect, useState } from "react"
import { ArrowLeft, Download, Mail, Search } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmptyRow, ErrorBox, Field, Loading, PageHeader, run, SelectField, StatusOf, StockBadge } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { dateTime, eur, num, opts, REQ_ST } from "@/lib/format"
import type { Customer, Order, Product, QuoteRequest } from "@/lib/types"

export function RequestsPage() {
  const { data: list, error } = useData(() => api<QuoteRequest[]>("requests"))
  const [s, setS] = useState("all")
  const [q, setQ] = useState("")
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />
  const t = q.toLowerCase()
  const rows = list.filter(r => (s === "all" || r.status === s) && (!t || [r.id, r.customerName, r.email].join(" ").toLowerCase().includes(t)))
  return (
    <>
      <PageHeader title="Demandes de devis" description="Demandes reçues sur Compack Destock" actions={<Button variant="outline" asChild><a href="/api/admin/export/requests.csv"><Download /> Exporter</a></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={s} onValueChange={setS} className="max-w-full overflow-x-auto"><TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          {Object.entries(REQ_ST).map(([k, v]) => <TabsTrigger key={k} value={k}>{v[0]} ({list.filter(r => r.status === k).length})</TabsTrigger>)}
        </TabsList></Tabs>
        <div className="relative w-full sm:w-64"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Client, e-mail, n°…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow><TableHead className="pl-4">N°</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Lots demandés</TableHead><TableHead className="text-right">Montant estimé HT</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => {
              const est = r.quoteAmount ?? r.items.reduce((a, i) => a + (i.lotPrice || 0) * i.lots, 0)
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => go("demandes/" + r.id)}>
                  <TableCell className="pl-4 font-medium">{r.id}</TableCell>
                  <TableCell className="text-muted-foreground">{dateTime(r.createdAt)}</TableCell>
                  <TableCell><div className="font-medium">{r.customerName}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                  <TableCell>{r.items.map(i => `${i.lots} × ${i.ref}`).join(", ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{est ? eur(est) : "Sur devis"}</TableCell>
                  <TableCell><StatusOf map={REQ_ST} value={r.status} /></TableCell>
                </TableRow>
              )
            })}
            {!rows.length && <EmptyRow cols={6}>Aucune demande</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

export function RequestDetailPage({ id }: { id: string }) {
  const { refresh } = useApp()
  const confirm = useConfirm()
  const { data, error, reload } = useData(() => Promise.all([api<QuoteRequest>("requests/" + id), api<Product[]>("products"), api<Customer[]>("customers")]), [id])
  const [prices, setPrices] = useState<string[]>([])
  const [ship, setShip] = useState("0")
  const [status, setStatus] = useState("")
  const [quote, setQuote] = useState("")
  const [notes, setNotes] = useState("")
  useEffect(() => {
    if (!data) return
    const r = data[0]
    setPrices(r.items.map(i => (i.lotPrice ?? "") + "")); setStatus(r.status); setQuote((r.quoteAmount ?? "") + ""); setNotes(r.notes)
  }, [data])
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const [r, prods, custs] = data
  const cu = custs.find(c => c.id === r.customerId)
  const locked = !!r.orderId
  const total = r.items.reduce((s, it, k) => s + (+prices[k] || 0) * it.lots, 0) + (+ship || 0)

  const saveFollow = () => run(async () => { await api("requests/" + id, "PATCH", { status, quoteAmount: quote, notes }); toast.success("Demande mise à jour"); refresh(); reload() })
  const convert = () => run(async () => {
    const p = prices.map(x => (x === "" ? null : +x))
    if (p.some(x => !(Number(x) > 0))) throw new Error("Chiffrez chaque lot avant de convertir")
    if (!await confirm({ title: "Créer la commande ?", description: "Le stock des lots sera déduit immédiatement.", action: "Créer la commande" })) return
    const body = { prices: p, shipping: +ship || 0 }
    let o: Order
    try { o = await api<Order>(`requests/${id}/convert`, "POST", body) }
    catch (e) {
      const msg = (e as Error).message
      if (!/Stock insuffisant/.test(msg) || !await confirm({ title: "Stock insuffisant", description: msg + ". Convertir quand même ? Le stock passera à 0.", action: "Convertir quand même", destructive: true })) { if (/Stock insuffisant/.test(msg)) return; throw e }
      o = await api<Order>(`requests/${id}/convert`, "POST", { ...body, force: true })
    }
    toast.success("Commande " + o.id + " créée"); refresh(); go("commandes/" + o.id)
  })

  return (
    <>
      <PageHeader title={`Demande ${r.id}`} description={<>Reçue le {dateTime(r.createdAt)} <StatusOf map={REQ_ST} value={r.status} /></>} actions={<>
        <Button variant="outline" asChild><a href="#/demandes"><ArrowLeft /> Retour</a></Button>
        <Button variant="outline" asChild><a href={`mailto:${r.email}?subject=${encodeURIComponent(`Votre demande ${r.id} — Compack Destock`)}`}><Mail /> Répondre</a></Button>
      </>} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Lots demandés</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Table>
                <TableHeader><TableRow><TableHead>Lot</TableHead><TableHead className="text-right">Lots</TableHead><TableHead className="text-right">Unités</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="w-36 text-right">Prix du lot HT</TableHead><TableHead className="text-right">Total HT</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.items.map((i, k) => {
                    const p = prods.find(x => x.id === i.productId)
                    return (
                      <TableRow key={k}>
                        <TableCell className="whitespace-normal"><a className="font-medium hover:underline" href={"#/produits/" + i.productId}>{i.name}</a><div className="text-xs text-muted-foreground">{i.ref}</div></TableCell>
                        <TableCell className="text-right tabular-nums">{i.lots}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(i.lots * (i.lotQty || 1))}</TableCell>
                        <TableCell className="text-right">{p ? <StockBadge p={p} /> : "—"}</TableCell>
                        <TableCell><Input type="number" step="0.01" className="text-right" placeholder="À chiffrer" disabled={locked} value={prices[k] ?? ""} onChange={e => setPrices(a => a.map((v, j) => (j === k ? e.target.value : v)))} /></TableCell>
                        <TableCell className="text-right tabular-nums">{+prices[k] ? eur(+prices[k] * i.lots) : "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Frais de transport HT"><Input type="number" step="0.01" disabled={locked} value={ship} onChange={e => setShip(e.target.value)} /></Field>
                <Field label="Total du devis HT"><Input disabled value={eur(total)} /></Field>
              </div>
              {locked
                ? <Alert><AlertDescription>Convertie en commande <a className="font-medium underline" href={"#/commandes/" + r.orderId}>{r.orderId}</a>.</AlertDescription></Alert>
                : <Button onClick={convert}>Valider et convertir en commande</Button>}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Message du client</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{r.message || <span className="text-muted-foreground">Aucun message</span>}</CardContent></Card>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardHeader><CardTitle>Client</CardTitle>{cu && <CardAction><Button variant="link" size="sm" asChild><a href={"#/clients/" + cu.id}>Fiche</a></Button></CardAction>}</CardHeader>
            <CardContent><dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Société</dt><dd>{cu?.company || "—"}</dd>
              <dt className="text-muted-foreground">Contact</dt><dd>{cu?.name || "—"}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd className="break-all"><a className="hover:underline" href={"mailto:" + r.email}>{r.email}</a></dd>
              <dt className="text-muted-foreground">Téléphone</dt><dd>{cu?.phone || "—"}</dd>
              <dt className="text-muted-foreground">SIRET / TVA</dt><dd>{cu?.siret || "—"}</dd>
              <dt className="text-muted-foreground">Adresse</dt><dd>{[cu?.address, cu?.zip, cu?.city].filter(Boolean).join(", ") || "—"}</dd>
            </dl></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Suivi commercial</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Statut"><SelectField value={status} onChange={setStatus} disabled={locked} options={opts(REQ_ST)} /></Field>
              <Field label="Montant du devis envoyé HT"><Input type="number" step="0.01" value={quote} onChange={e => setQuote(e.target.value)} /></Field>
              <Field label="Notes internes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
              <Button variant="secondary" onClick={saveFollow}>Enregistrer</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent><ul className="grid gap-2 text-sm">{r.history.map((h, k) => <li key={k} className="flex flex-wrap items-center justify-between gap-2"><StatusOf map={REQ_ST} value={h.status} /><span className="text-xs text-muted-foreground">{dateTime(h.at)} · {h.by}</span></li>)}</ul></CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
