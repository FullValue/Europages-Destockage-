import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ExternalLink, ImagePlus, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ErrorBox, Field, Loading, PageHeader, run, SelectField, StockBadge } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { go } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { date, dateTime, DS_ST, eur, imgUrl, num } from "@/lib/format"
import type { Movement, Product } from "@/lib/types"

const BLANK: Omit<Product, "id" | "createdAt"> = {
  name: "", sku: "", cat: "", sub: "", cond: "Neuf", unitLabel: "pièce", desc: "", images: [], stock: 0, cost: null, publicValue: null, alertThreshold: null,
  location: "Showroom Argenteuil (95)", destock: { active: false, status: "disponible" }, market: { active: false },
}
type Form = Omit<Product, "id" | "createdAt"> & { id?: string; createdAt?: string }
const toNum = (v: string) => (v === "" ? null : +v)
/** Réduit la photo (1600 px max, JPEG) : l'envoi reste sous la limite de 4,5 Mo des fonctions Vercel. */
async function toJpeg(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k)
  const g = canvas.getContext("2d")!
  g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.85)
}
const REASONS = ["Réception fournisseur", "Inventaire", "Casse / perte", "Retour client", "Vente hors site"].map(value => ({ value, label: value }))

export function ProductEditPage({ id }: { id: string }) {
  const isNew = id === "nouveau"
  const { settings, refresh } = useApp()
  const confirm = useConfirm()
  const { data, error, reload } = useData(() => isNew
    ? Promise.resolve({ p: BLANK as Form, mv: [] as Movement[] })
    : Promise.all([api<Product>("products/" + id), api<Movement[]>("movements")]).then(([p, m]) => ({ p: p as Form, mv: m.filter(x => x.productId === id).slice(0, 15) })), [id])
  const [f, setF] = useState<Form | null>(null)
  const [initialStock, setInitialStock] = useState("0")
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState(REASONS[0].value)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (data) setF(data.p) }, [data])
  if (error) return <ErrorBox message={error} />
  if (!data || !f) return <Loading />

  const cats = Object.entries(settings?.categories || {}).map(([value, c]) => ({ value, label: c.name + (c.destock === false ? " (Market uniquement)" : c.market === false ? " (Destock uniquement)" : "") }))
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })
  const ds = (patch: Partial<Product["destock"]>) => setF({ ...f, destock: { ...f.destock, ...patch } })
  const mk = (patch: Partial<Product["market"]>) => setF({ ...f, market: { ...f.market, ...patch } })
  const d = f.destock, m = f.market
  const unitDs = d.lotQty && d.lotPrice ? d.lotPrice / d.lotQty : null
  const margin = f.cost != null && m.price ? m.price / (1 + (settings?.vatRate ?? 0.2)) - f.cost : null

  const save = () => run(async () => {
    if (!f.name.trim() || !f.sku.trim()) throw new Error("Le nom et le SKU sont obligatoires")
    if (m.active && !(Number(m.price) > 0)) throw new Error("Indiquez un prix TTC pour mettre le produit en ligne sur Market")
    if (d.active && d.status === "disponible" && !(Number(d.lotPrice) > 0)) throw new Error("Indiquez un prix de lot, ou le statut « Prix sur demande », pour Destock")
    const body = { name: f.name.trim(), sku: f.sku.trim(), cat: f.cat || cats[0]?.value, sub: f.sub, cond: f.cond, unitLabel: f.unitLabel || "pièce", location: f.location, desc: f.desc, cost: f.cost, publicValue: f.publicValue, alertThreshold: f.alertThreshold, images: f.images, destock: { ...d, ref: d.ref || f.sku.trim() }, market: m }
    if (isNew) { const r = await api<Product>("products", "POST", { ...body, initialStock: +initialStock || 0 }); toast.success("Produit créé"); refresh(); go("produits/" + r.id) }
    else { await api("products/" + id, "PATCH", body); toast.success("Produit enregistré"); refresh(); reload() }
  })
  const applyMove = () => run(async () => {
    const n = parseInt(delta); if (!n) throw new Error("Saisissez une quantité, par exemple 50 ou -10")
    await api(`products/${id}/stock`, "POST", { delta: n, reason }); setDelta(""); toast.success("Stock mis à jour"); refresh(); reload()
  })
  const del = () => run(async () => {
    if (!await confirm({ title: "Supprimer ce produit ?", description: "Il disparaîtra des deux sites. Cette action est définitive.", action: "Supprimer", destructive: true })) return
    await api("products/" + id, "DELETE"); toast.success("Produit supprimé"); refresh(); go("produits")
  })
  const upload = (files: FileList | null) => run(async () => {
    const added: string[] = []
    for (const file of Array.from(files || [])) {
      if (file.size > 25e6) { toast.error(`${file.name} : 25 Mo maximum`); continue }
      added.push((await api<{ path: string }>("upload", "POST", { data: await toJpeg(file) })).path)
    }
    if (added.length) { setF(cur => cur && { ...cur, images: [...cur.images, ...added] }); toast.success("Photo ajoutée, pensez à enregistrer") }
    if (fileRef.current) fileRef.current.value = ""
  })

  return (
    <>
      <PageHeader title={isNew ? "Nouveau produit" : f.name} description={isNew ? undefined : `${f.sku} · créé le ${date(f.createdAt)}`} actions={<>
        <Button variant="outline" asChild><a href="#/produits"><ArrowLeft /> Retour</a></Button>
        {!isNew && data.p.destock.active && <Button variant="outline" asChild><a target="_blank" rel="noreferrer" href={"/destock/lot.html?ref=" + encodeURIComponent(data.p.destock.ref || f.sku)}>Destock <ExternalLink /></a></Button>}
        {!isNew && data.p.market.active && <Button variant="outline" asChild><a target="_blank" rel="noreferrer" href={"/market/produit.html?id=" + id}>Market <ExternalLink /></a></Button>}
        {!isNew && <Button variant="destructive" onClick={del}><Trash2 /> Supprimer</Button>}
        <Button onClick={save}>Enregistrer</Button>
      </>} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Nom interne *"><Input value={f.name} onChange={e => set("name", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="SKU *"><Input value={f.sku} onChange={e => set("sku", e.target.value)} /></Field>
                <Field label="Catégorie"><SelectField value={f.cat || cats[0]?.value || ""} onChange={v => set("cat", v)} options={cats} /></Field>
                <Field label="Sous-catégorie"><Input value={f.sub} onChange={e => set("sub", e.target.value)} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="État"><Input value={f.cond} onChange={e => set("cond", e.target.value)} /></Field>
                <Field label="Unité"><Input value={f.unitLabel} onChange={e => set("unitLabel", e.target.value)} /></Field>
                <Field label="Emplacement"><Input value={f.location || ""} onChange={e => set("location", e.target.value)} /></Field>
              </div>
              <Field label="Description"><Textarea rows={5} value={f.desc} onChange={e => set("desc", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Prix d'achat unitaire HT"><Input type="number" step="0.01" value={f.cost ?? ""} onChange={e => set("cost", toNum(e.target.value))} /></Field>
                <Field label="Valeur publique unitaire"><Input type="number" step="0.01" value={f.publicValue ?? ""} onChange={e => set("publicValue", toNum(e.target.value))} /></Field>
                <Field label="Seuil d'alerte stock"><Input type="number" placeholder={`Par défaut : ${settings?.lowStockDefault}`} value={f.alertThreshold ?? ""} onChange={e => set("alertThreshold", toNum(e.target.value))} /></Field>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Photos</CardTitle><CardDescription>La première est l'image principale</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {f.images.map((s, k) => (
                <div key={s + k} className={"group relative size-24 overflow-hidden rounded-lg border bg-white " + (k ? "" : "ring-2 ring-primary")}>
                  <img src={imgUrl(s)} alt="" className="size-full object-contain" />
                  {k > 0 && <Button type="button" size="icon-xs" variant="secondary" className="absolute top-1 left-1" aria-label="Définir comme image principale" onClick={() => { const a = [...f.images]; const [it] = a.splice(k, 1); a.unshift(it); set("images", a) }}><Star /></Button>}
                  <Button type="button" size="icon-xs" variant="secondary" className="absolute top-1 right-1" aria-label="Retirer" onClick={() => set("images", f.images.filter((_, i) => i !== k))}><X /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="size-24 flex-col text-xs" onClick={() => fileRef.current?.click()}><ImagePlus /> Ajouter</Button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => upload(e.target.files)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Compack Destock</CardTitle><CardDescription>Vente en gros, par lot, prix HT</CardDescription>
              <CardAction><div className="flex items-center gap-2"><Switch id="dsa" checked={!!d.active} onCheckedChange={v => ds({ active: v })} /><Label htmlFor="dsa">En ligne</Label></div></CardAction></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Référence du lot"><Input placeholder={f.sku} value={d.ref || ""} onChange={e => ds({ ref: e.target.value })} /></Field>
                <Field label="Statut"><SelectField value={d.status || "disponible"} onChange={v => ds({ status: v })} options={Object.entries(DS_ST).map(([value, label]) => ({ value, label }))} /></Field>
                <Field label="Badge"><SelectField value={d.tag || "none"} onChange={v => ds({ tag: v === "none" ? "" : v })} options={[{ value: "none", label: "Aucun" }, { value: "Nouveau", label: "Nouveau" }, { value: "Top prix", label: "Top prix" }]} /></Field>
              </div>
              <Field label="Titre de l'annonce"><Input placeholder={f.name} value={d.title || ""} onChange={e => ds({ title: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Unités par lot"><Input type="number" value={d.lotQty ?? ""} onChange={e => ds({ lotQty: toNum(e.target.value) })} /></Field>
                <Field label="Prix du lot HT"><Input type="number" step="0.01" value={d.lotPrice ?? ""} onChange={e => ds({ lotPrice: toNum(e.target.value) })} /></Field>
                <Field label="Prix unitaire calculé"><Input disabled value={unitDs ? eur(unitDs) : "—"} /></Field>
              </div>
              <Field label="Note (conditionnement, quantité…)"><Input value={d.note || ""} onChange={e => ds({ note: e.target.value })} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Compack Market</CardTitle><CardDescription>Vente au détail, à l'unité, prix TTC</CardDescription>
              <CardAction><div className="flex items-center gap-2"><Switch id="mka" checked={!!m.active} onCheckedChange={v => mk({ active: v })} /><Label htmlFor="mka">En ligne</Label></div></CardAction></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Titre boutique"><Input placeholder={f.name} value={m.title || ""} onChange={e => mk({ title: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Prix de vente TTC"><Input type="number" step="0.01" value={m.price ?? ""} onChange={e => mk({ price: toNum(e.target.value) })} /></Field>
                <Field label="Prix barré TTC"><Input type="number" step="0.01" value={m.compareAt ?? ""} onChange={e => mk({ compareAt: toNum(e.target.value) })} /></Field>
                <Field label="Marge unitaire HT"><Input disabled value={margin != null ? eur(margin) : "—"} /></Field>
              </div>
              <div className="flex items-center gap-2"><Switch id="mkf" checked={!!m.featured} onCheckedChange={v => mk({ featured: v })} /><Label htmlFor="mkf">Mettre en avant sur l'accueil</Label></div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader><CardTitle>Stock</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {isNew ? <Field label="Stock initial"><Input type="number" min="0" value={initialStock} onChange={e => setInitialStock(e.target.value)} /></Field> : <>
                <div><div className="text-3xl font-semibold tabular-nums">{num(f.stock)} <span className="text-sm font-normal text-muted-foreground">{f.unitLabel}{f.stock > 1 ? "s" : ""}</span></div>
                  <div className="mt-2 flex flex-wrap gap-2"><StockBadge p={f as Product} />{!!d.lotQty && <span className="text-sm text-muted-foreground">soit {Math.floor(f.stock / d.lotQty)} lot(s) complet(s)</span>}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantité (±)"><Input type="number" placeholder="50 ou -10" value={delta} onChange={e => setDelta(e.target.value)} /></Field>
                  <Field label="Motif"><SelectField value={reason} onChange={setReason} options={REASONS} /></Field>
                </div>
                <Button variant="secondary" onClick={applyMove}>Appliquer le mouvement</Button>
              </>}
            </CardContent>
          </Card>
          {!isNew && <Card>
            <CardHeader><CardTitle>Derniers mouvements</CardTitle><CardAction><Button variant="link" size="sm" asChild><a href="#/stock">Tout voir</a></Button></CardAction></CardHeader>
            <CardContent><ul className="grid gap-3 text-sm">
              {data.mv.map(x => <li key={x.id} className="flex justify-between gap-3"><span className="min-w-0"><span className="block truncate">{x.reason}</span><span className="text-xs text-muted-foreground">{dateTime(x.at)}{x.ref ? " · " + x.ref : ""}</span></span><span className={"shrink-0 font-medium tabular-nums " + (x.delta > 0 ? "text-emerald-600" : "text-red-600")}>{x.delta > 0 ? "+" : ""}{num(x.delta)}</span></li>)}
              {!data.mv.length && <li className="text-muted-foreground">Aucun mouvement</li>}
            </ul></CardContent>
          </Card>}
        </div>
      </div>
    </>
  )
}
