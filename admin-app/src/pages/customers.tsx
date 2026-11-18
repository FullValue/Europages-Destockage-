import { useEffect, useState } from "react"
import { ArrowLeft, Download, Mail, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmptyRow, ErrorBox, Field, Loading, PageHeader, run, SelectField, SiteBadge, Status, StatusOf } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { date, eur, ORDER_ST, REQ_ST } from "@/lib/format"
import type { Customer, Order, QuoteRequest } from "@/lib/types"

const TYPES = [{ value: "pro", label: "Professionnel" }, { value: "particulier", label: "Particulier" }]
const TypeBadge = ({ type }: { type: string }) => <Status tone={type === "pro" ? "ds" : "mk"}>{type === "pro" ? "Pro" : "Particulier"}</Status>

function NewCustomerDialog() {
  const [open, setOpen] = useState(false)
  const [c, setC] = useState({ type: "pro", name: "", company: "", email: "" })
  const create = () => run(async () => {
    const email = c.email.trim().toLowerCase()
    if (!c.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Nom et e-mail valide obligatoires")
    const r = await api<Customer>("customers", "POST", { ...c, email, sites: [], phone: "", siret: "", address: "", zip: "", city: "", notes: "", tags: [] })
    toast.success("Client créé"); setOpen(false); go("clients/" + r.id)
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus /> Nouveau client</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau client</DialogTitle><DialogDescription>Le reste des coordonnées se complète sur sa fiche.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <Field label="Type"><SelectField value={c.type} onChange={type => setC({ ...c, type })} options={TYPES} /></Field>
          <Field label="Nom du contact *"><Input value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Société"><Input value={c.company} onChange={e => setC({ ...c, company: e.target.value })} /></Field>
          <Field label="E-mail *"><Input type="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={create}>Créer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomersPage() {
  const { data, error } = useData(() => Promise.all([api<Customer[]>("customers"), api<Order[]>("orders")]))
  const [ty, setTy] = useState("all")
  const [q, setQ] = useState("")
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const [list, orders] = data
  const t = q.toLowerCase()
  const rows = list.filter(c => (ty === "all" || c.type === ty) && (!t || [c.name, c.company, c.email, c.city].join(" ").toLowerCase().includes(t)))
  const ca = (id: string) => orders.filter(o => o.customerId === id && o.status !== "annulee").reduce((s, o) => s + o.totalHT, 0)
  return (
    <>
      <PageHeader title="Clients" description={`${list.length} clients, professionnels et particuliers`} actions={<>
        <Button variant="outline" asChild><a href="/api/admin/export/customers.csv"><Download /> Exporter</a></Button>
        <NewCustomerDialog />
      </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={ty} onValueChange={setTy}><TabsList><TabsTrigger value="all">Tous</TabsTrigger><TabsTrigger value="pro">Professionnels</TabsTrigger><TabsTrigger value="particulier">Particuliers</TabsTrigger></TabsList></Tabs>
        <div className="relative w-full sm:w-64"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Nom, société, e-mail, ville…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow><TableHead className="pl-4">Client</TableHead><TableHead>Type</TableHead><TableHead>Sites</TableHead><TableHead>Contact</TableHead><TableHead>Ville</TableHead><TableHead className="text-right">Commandes</TableHead><TableHead className="text-right">CA HT</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => go("clients/" + c.id)}>
                <TableCell className="pl-4"><div className="font-medium">{c.company || c.name}</div>{c.company && <div className="text-xs text-muted-foreground">{c.name}</div>}</TableCell>
                <TableCell><TypeBadge type={c.type} /></TableCell>
                <TableCell><div className="flex gap-1">{(c.sites || []).map(s => <SiteBadge key={s} site={s} />)}</div></TableCell>
                <TableCell><div>{c.email}</div><div className="text-xs text-muted-foreground">{c.phone}</div></TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell className="text-right tabular-nums">{orders.filter(o => o.customerId === c.id).length}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(ca(c.id))}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={7}>Aucun client</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

export function CustomerDetailPage({ id }: { id: string }) {
  const confirm = useConfirm()
  const { data, error, reload } = useData(() => Promise.all([api<Customer>("customers/" + id), api<Order[]>("orders"), api<QuoteRequest[]>("requests")]), [id])
  const [c, setC] = useState<Customer | null>(null)
  useEffect(() => { if (data) setC(data[0]) }, [data])
  if (error) return <ErrorBox message={error} />
  if (!data || !c) return <Loading />
  const os = data[1].filter(o => o.customerId === id), rs = data[2].filter(r => r.customerId === id)
  const save = () => run(async () => { await api("customers/" + id, "PATCH", { ...c, email: c.email.trim().toLowerCase() }); toast.success("Client enregistré"); reload() })
  const del = () => run(async () => {
    if (os.length || rs.length) throw new Error("Ce client a des commandes ou des demandes : suppression impossible")
    if (!await confirm({ title: "Supprimer ce client ?", action: "Supprimer", destructive: true })) return
    await api("customers/" + id, "DELETE"); toast.success("Client supprimé"); go("clients")
  })
  const f = (k: keyof Customer, label: string, type = "text") => <Field label={label}><Input type={type} value={String(c[k] ?? "")} onChange={e => setC({ ...c, [k]: e.target.value })} /></Field>
  const kpis = [["Commandes", String(os.length)], ["CA HT", eur(os.filter(o => o.status !== "annulee").reduce((s, o) => s + o.totalHT, 0))], ["Demandes de devis", String(rs.length)]]
  return (
    <>
      <PageHeader title={data[0].company || data[0].name} description={`${c.type === "pro" ? "Professionnel" : "Particulier"} · client depuis le ${date(c.createdAt)}`} actions={<>
        <Button variant="outline" asChild><a href="#/clients"><ArrowLeft /> Retour</a></Button>
        <Button variant="outline" asChild><a href={"mailto:" + c.email}><Mail /> Écrire</a></Button>
        <Button variant="destructive" onClick={del}><Trash2 /> Supprimer</Button>
        <Button onClick={save}>Enregistrer</Button>
      </>} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Type"><SelectField value={c.type} onChange={v => setC({ ...c, type: v as Customer["type"] })} options={TYPES} /></Field>
            {f("name", "Nom du contact")}{f("company", "Société")}{f("email", "E-mail", "email")}{f("phone", "Téléphone")}{f("siret", "SIRET / TVA")}{f("address", "Adresse")}
            <div className="grid grid-cols-[1fr_1.5fr] gap-3">{f("zip", "Code postal")}{f("city", "Ville")}</div>
            <Field label="Notes"><Textarea value={c.notes} onChange={e => setC({ ...c, notes: e.target.value })} /></Field>
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">{kpis.map(([t, v]) => <Card key={t}><CardHeader><CardDescription>{t}</CardDescription><CardTitle className="text-2xl tabular-nums">{v}</CardTitle></CardHeader></Card>)}</div>
          <Card>
            <CardHeader><CardTitle>Commandes</CardTitle></CardHeader>
            <CardContent><ul className="divide-y">
              {os.map(o => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><a className="text-sm font-medium hover:underline" href={"#/commandes/" + o.id}>{o.id} · {date(o.createdAt)}</a><span className="flex items-center gap-2 text-sm tabular-nums"><SiteBadge site={o.site} />{eur(o.totalTTC)}<StatusOf map={ORDER_ST} value={o.status} /></span></li>)}
              {!os.length && <li className="py-6 text-center text-sm text-muted-foreground">Aucune commande</li>}
            </ul></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Demandes de devis</CardTitle></CardHeader>
            <CardContent><ul className="divide-y">
              {rs.map(r => <li key={r.id} className="flex items-center justify-between gap-2 py-2.5"><a className="text-sm font-medium hover:underline" href={"#/demandes/" + r.id}>{r.id} · {date(r.createdAt)}</a><StatusOf map={REQ_ST} value={r.status} /></li>)}
              {!rs.length && <li className="py-6 text-center text-sm text-muted-foreground">Aucune demande</li>}
            </ul></CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
