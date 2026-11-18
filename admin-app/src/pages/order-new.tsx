import { useState } from "react"
import { ArrowLeft, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ErrorBox, Field, Loading, PageHeader, run, SelectField, StockBadge } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { eur, num, PAYMENT } from "@/lib/format"
import type { Customer, Order, Product, Site } from "@/lib/types"

type Line = { productId: string; qty: string; price: string }
const empty = (): Line => ({ productId: "", qty: "1", price: "" })
const NEW = "new"

export function OrderNewPage() {
  const { refresh } = useApp()
  const { data, error } = useData(() => Promise.all([api<Product[]>("products"), api<Customer[]>("customers")]))
  const [site, setSite] = useState<Site>("destock")
  const [lines, setLines] = useState<Line[]>([empty()])
  const [ship, setShip] = useState("0")
  const [payment, setPayment] = useState("virement")
  const [notes, setNotes] = useState("")
  const [cu, setCu] = useState(NEW)
  const [c, setC] = useState({ name: "", company: "", email: "", phone: "", address: "", zip: "", city: "" })
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const [prods, custs] = data
  // reliquat de lot : même calcul que le serveur (une seule ligne, au prix unitaire du lot)
  const partial = (p: Product) => site === "destock" && !!p.destock.lotQty && p.stock < p.destock.lotQty
  const def = (p: Product) => {
    if (partial(p)) return Math.round((p.destock.lotPrice || 0) / p.destock.lotQty! * p.stock * 100) / 100
    return (site === "destock" ? p.destock.lotPrice : p.market.price) ?? null
  }
  const up = (k: number, patch: Partial<Line>) => setLines(ls => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)))
  const total = lines.reduce((s, l) => { const p = prods.find(x => x.id === l.productId); return s + (+l.price || (p ? def(p) || 0 : 0)) * (p && partial(p) ? 1 : +l.qty || 0) }, 0) + (+ship || 0)
  const options = prods.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` }))
  const create = () => run(async () => {
    const items = lines.filter(l => l.productId).map(l => ({ productId: l.productId, qty: +l.qty || 1, price: l.price === "" ? undefined : +l.price }))
    if (!items.length) throw new Error("Ajoutez au moins un produit")
    const body: Record<string, unknown> = { site, items, shipping: +ship || 0, payment, notes }
    if (cu !== NEW) body.customerId = cu
    else { if (!c.name.trim() || !c.email.trim()) throw new Error("Nom et e-mail du client obligatoires"); body.customer = c }
    const o = await api<Order>("orders", "POST", body)
    toast.success("Commande " + o.id + " créée"); refresh(); go("commandes/" + o.id)
  })
  const cf = (k: keyof typeof c, label: string, type = "text") => <Field label={label}><Input type={type} value={c[k]} onChange={e => setC({ ...c, [k]: e.target.value })} /></Field>
  return (
    <>
      <PageHeader title="Saisir une commande" description="Commande prise par téléphone, au showroom ou sur un salon" actions={<Button variant="outline" asChild><a href="#/commandes"><ArrowLeft /> Retour</a></Button>} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Commande</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Tabs value={site} onValueChange={v => setSite(v as Site)}><TabsList><TabsTrigger value="destock">Destock · par lot, HT</TabsTrigger><TabsTrigger value="market">Market · à l'unité, TTC</TabsTrigger></TabsList></Tabs>
            <Table>
              <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="w-20">Qté</TableHead><TableHead className="w-28">Prix</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, k) => {
                  const p = prods.find(x => x.id === l.productId)
                  return (
                    <TableRow key={k}>
                      <TableCell className="max-w-72"><SelectField value={l.productId} placeholder="Choisir un produit" onChange={v => up(k, { productId: v, price: "" })} options={options} /></TableCell>
                      <TableCell><Input type="number" min="1" value={l.qty} onChange={e => up(k, { qty: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" placeholder={p ? String(def(p) ?? "") : ""} value={l.price} onChange={e => up(k, { price: e.target.value })} /></TableCell>
                      <TableCell className="text-right">{p && <div className="flex flex-col items-end gap-1"><StockBadge p={p} />{site === "destock" && !!p.destock.lotQty && <span className="text-xs text-muted-foreground">{partial(p) ? "Lot partiel" : `${num(p.destock.lotQty)} u./lot`}</span>}</div>}</TableCell>
                      <TableCell><Button variant="ghost" size="icon-sm" aria-label="Retirer la ligne" onClick={() => setLines(ls => (ls.length > 1 ? ls.filter((_, i) => i !== k) : [empty()]))}><X /></Button></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div><Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, empty()])}><Plus /> Ajouter une ligne</Button></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Livraison"><Input type="number" step="0.01" value={ship} onChange={e => setShip(e.target.value)} /></Field>
              <Field label="Paiement"><SelectField value={payment} onChange={setPayment} options={Object.entries(PAYMENT).map(([value, label]) => ({ value, label }))} /></Field>
              <Field label="Total"><Input disabled value={`${eur(total)} ${site === "destock" ? "HT" : "TTC"}`} /></Field>
            </div>
            <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Client</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Client"><SelectField value={cu} onChange={setCu} options={[{ value: NEW, label: "Nouveau client" }, ...custs.map(x => ({ value: x.id, label: `${x.company || x.name} · ${x.email}` }))]} /></Field>
            {cu === NEW && <>{cf("name", "Nom *")}{cf("company", "Société")}{cf("email", "E-mail *", "email")}{cf("phone", "Téléphone")}{cf("address", "Adresse")}<div className="grid grid-cols-[1fr_1.5fr] gap-3">{cf("zip", "CP")}{cf("city", "Ville")}</div></>}
            <Button onClick={create}>Créer la commande</Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
