import { useEffect, useState } from "react"
import { ArrowLeft, Copy, CreditCard, Printer, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ErrorBox, Field, Loading, PageHeader, run, SelectField, SiteBadge, StatusOf } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { dateTime, eur, num, opts, ORDER_ST, PAY_ST, PAYMENT } from "@/lib/format"
import type { Customer, Order } from "@/lib/types"

const FLOW = ["en_attente", "confirmee", "preparation", "expediee", "livree"]
const MOLLIE_ST: Record<string, string> = { open: "en attente du client", pending: "en cours de validation", authorized: "autorisé", paid: "payé", canceled: "annulé", expired: "expiré", failed: "refusé" }

export function OrderDetailPage({ id }: { id: string }) {
  const { refresh } = useApp()
  const confirm = useConfirm()
  const { data, error, reload } = useData(() => Promise.all([api<Order>("orders/" + id), api<Customer[]>("customers")]), [id])
  const [pay, setPay] = useState("")
  const [tracking, setTracking] = useState("")
  const [notes, setNotes] = useState("")
  useEffect(() => { if (data) { setPay(data[0].paymentStatus); setTracking(data[0].tracking); setNotes(data[0].notes) } }, [data])
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const [o, custs] = data
  const cu = custs.find(c => c.id === o.customerId)
  const ds = o.site === "destock", cancelled = o.status === "annulee"

  const setStatus = (s: string) => run(async () => {
    if (s === o.status) return
    if (s === "annulee" && !await confirm({ title: "Annuler la commande ?", description: "Le stock des articles sera restitué. Cette annulation est définitive.", action: "Annuler la commande", destructive: true })) return
    await api("orders/" + id, "PATCH", { status: s }); toast.success("Statut : " + ORDER_ST[s][0]); refresh(); reload()
  })
  const payLink = () => run(async () => { await api("orders/" + id + "/payment-link", "POST"); toast.success("Lien de paiement créé"); reload() })
  const payCheck = () => run(async () => { const r = await api<Order>("orders/" + id + "/payment-check", "POST"); toast.success(r.paymentStatus === "payee" ? "Paiement reçu" : "Paiement : " + (MOLLIE_ST[r.mollie?.status || ""] || "en attente")); refresh(); reload() })
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Lien copié"), () => toast.error("Copie impossible"))
  const save = () => run(async () => { await api("orders/" + id, "PATCH", { paymentStatus: pay, tracking, notes }); toast.success("Commande enregistrée"); reload() })
  const del = () => run(async () => {
    if (!await confirm({ title: "Supprimer cette commande ?", description: "Suppression définitive de la commande annulée.", action: "Supprimer", destructive: true })) return
    await api("orders/" + id, "DELETE"); toast.success("Commande supprimée"); go("commandes")
  })
  const Sum = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={"flex justify-between gap-6 text-sm " + (strong ? "font-semibold" : "text-muted-foreground")}><span>{label}</span><span className="text-foreground tabular-nums">{value}</span></div>
  )
  return (
    <>
      <PageHeader title={`Commande ${o.id}`} description={<><SiteBadge site={o.site} /> Passée le {dateTime(o.createdAt)} <StatusOf map={ORDER_ST} value={o.status} /><StatusOf map={PAY_ST} value={o.paymentStatus} /></>} actions={<>
        <Button variant="outline" asChild><a href="#/commandes"><ArrowLeft /> Retour</a></Button>
        <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimer le bon</Button>
        {cancelled && <Button variant="destructive" onClick={del}><Trash2 /> Supprimer</Button>}
      </>} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Articles</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Table>
                <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">Unités</TableHead><TableHead className="text-right">Prix {ds ? "HT" : "TTC"}</TableHead><TableHead className="text-right">Total {ds ? "HT" : "TTC"}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {o.items.map((i, k) => (
                    <TableRow key={k}>
                      <TableCell className="whitespace-normal"><a className="font-medium hover:underline" href={"#/produits/" + i.productId}>{i.name}</a><div className="text-xs text-muted-foreground">{i.sku}</div></TableCell>
                      <TableCell className="text-right tabular-nums">{i.qty}{ds ? ` lot${i.qty > 1 ? "s" : ""}` : ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(i.units)}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(ds ? i.unitPriceHT : i.unitPriceTTC)}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(ds ? i.lineHT : i.lineTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="ml-auto grid w-full max-w-xs gap-2">
                <Sum label="Livraison" value={o.shipping ? eur(o.shipping) : "Offerte / incluse"} />
                <Sum label="Total HT" value={eur(o.totalHT)} />
                <Sum label="TVA" value={eur(o.totalTTC - o.totalHT)} />
                <Separator />
                <Sum label="Total TTC" value={eur(o.totalTTC)} strong />
              </div>
            </CardContent>
          </Card>
          <Card className="print:hidden">
            <CardHeader><CardTitle>Traitement</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {FLOW.map(s => <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} disabled={cancelled} onClick={() => setStatus(s)}>{ORDER_ST[s][0]}</Button>)}
                {!cancelled && <Button size="sm" variant="destructive" onClick={() => setStatus("annulee")}>Annuler</Button>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Paiement (${PAYMENT[o.payment] || o.payment})`}><SelectField value={pay} onChange={setPay} options={opts(PAY_ST)} /></Field>
                <Field label="N° de suivi transporteur"><Input value={tracking} onChange={e => setTracking(e.target.value)} /></Field>
              </div>
              <Field label="Notes internes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
              <div><Button onClick={save}>Enregistrer</Button></div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4">
          {!cancelled && <Card className="print:hidden">
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-4" /> Paiement en ligne</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {o.paymentStatus === "payee"
                ? <p className="text-muted-foreground">Commande payée{o.mollie ? " via Mollie" : ""}.</p>
                : o.mollie
                ? <>
                    <p>{o.mollie.kind === "checkout" ? "Paiement carte du client" : "Lien de paiement"} : <b>{MOLLIE_ST[o.mollie.status] || o.mollie.status}</b>{o.mollie.mode === "test" ? " (test)" : ""}</p>
                    {o.mollie.checkoutUrl && ["open", "pending"].includes(o.mollie.status) && <div className="flex gap-2"><Input readOnly value={o.mollie.checkoutUrl} onFocus={e => e.target.select()} /><Button size="icon" variant="outline" onClick={() => copy(o.mollie!.checkoutUrl!)} aria-label="Copier le lien"><Copy /></Button></div>}
                    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={payCheck}><RefreshCw /> Vérifier</Button>{!["open", "pending"].includes(o.mollie.status) && <Button size="sm" onClick={payLink}>Nouveau lien de paiement</Button>}</div>
                  </>
                : <>
                    <p className="text-muted-foreground">Envoyez au client un lien Mollie pour payer {eur(o.totalTTC)} TTC par carte. La commande passe en « payée » dès le paiement.</p>
                    <div><Button size="sm" onClick={payLink}>Créer un lien de paiement</Button></div>
                  </>}
            </CardContent>
          </Card>}
          <Card>
            <CardHeader><CardTitle>Client</CardTitle>{cu && <CardAction className="print:hidden"><Button variant="link" size="sm" asChild><a href={"#/clients/" + cu.id}>Fiche</a></Button></CardAction>}</CardHeader>
            <CardContent><dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Nom</dt><dd>{cu?.company || cu?.name || o.customerName}{cu?.company ? <div className="text-xs text-muted-foreground">{cu.name}</div> : null}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd className="break-all"><a className="hover:underline" href={"mailto:" + o.email}>{o.email}</a></dd>
              <dt className="text-muted-foreground">Téléphone</dt><dd>{cu?.phone || "—"}</dd>
              <dt className="text-muted-foreground">Livraison</dt><dd>{o.shippingAddress || "—"}</dd>
              <dt className="text-muted-foreground">Paiement</dt><dd>{PAYMENT[o.payment] || o.payment}</dd>
              {o.tracking && <><dt className="text-muted-foreground">Suivi</dt><dd>{o.tracking}</dd></>}
              {o.requestId && <><dt className="text-muted-foreground">Devis</dt><dd><a className="hover:underline" href={"#/demandes/" + o.requestId}>{o.requestId}</a></dd></>}
            </dl></CardContent>
          </Card>
          <Card className="print:hidden">
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent><ul className="grid gap-2 text-sm">{o.history.map((h, k) => <li key={k} className="flex flex-wrap items-center justify-between gap-2">{ORDER_ST[h.status] ? <StatusOf map={ORDER_ST} value={h.status} /> : <span>{h.status}</span>}<span className="text-xs text-muted-foreground">{dateTime(h.at)} · {h.by}</span></li>)}</ul></CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
