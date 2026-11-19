import { useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, ErrorBox, Field, Loading, PageHeader, run, SelectField } from "@/components/common"
import { useData } from "@/hooks/use-data"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { num } from "@/lib/format"
import type { Category } from "@/lib/types"

type Draft = { key?: string; name: string; icon: string; destock: boolean; market: boolean }
const EMPTY: Draft = { name: "", icon: "📦", destock: true, market: true }

export function CategoriesPage() {
  const { refresh } = useApp()
  const { data: list, error, reload, setData } = useData(() => api<Category[]>("categories"))
  const [edit, setEdit] = useState<Draft | null>(null)
  const [del, setDel] = useState<{ cat: Category; moveTo: string } | null>(null)
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />

  const done = async (msg: string) => { toast.success(msg); await reload(); refresh() }
  const save = () => run(async () => {
    if (!edit) return
    const body = { name: edit.name.trim(), icon: edit.icon.trim(), destock: edit.destock, market: edit.market }
    if (edit.key) await api("categories/" + edit.key, "PATCH", body)
    else await api("categories", "POST", body)
    setEdit(null); await done(edit.key ? "Catégorie modifiée" : "Catégorie ajoutée")
  })
  const toggle = (c: Category, site: "destock" | "market", v: boolean) => run(async () => {
    setData(list.map(x => x.key === c.key ? { ...x, [site]: v } : x))
    try { await api("categories/" + c.key, "PATCH", { [site]: v }) } finally { await reload() }
    refresh()
  })
  const move = (i: number, d: -1 | 1) => run(async () => {
    const keys = list.map(c => c.key); [keys[i], keys[i + d]] = [keys[i + d], keys[i]]
    setData(await api<Category[]>("categories/order", "POST", { keys })); refresh()
  })
  const remove = () => run(async () => {
    if (!del) return
    const q = del.cat.products ? "?moveTo=" + encodeURIComponent(del.moveTo) : ""
    await api("categories/" + del.cat.key + q, "DELETE")
    setDel(null); await done("Catégorie supprimée")
  })

  return (
    <>
      <PageHeader title="Catégories" description="Rayons des deux sites. Choisissez pour chaque catégorie si elle s'affiche sur Destock, sur Market, ou sur les deux."
        actions={<Button onClick={() => setEdit({ ...EMPTY })}><Plus /> Nouvelle catégorie</Button>} />
      <Card className="py-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="pl-4">Catégorie</TableHead><TableHead className="text-right">Produits</TableHead>
            <TableHead>Destock (gros)</TableHead><TableHead>Market (détail)</TableHead><TableHead className="pr-4 text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map((c, i) => (
              <TableRow key={c.key}>
                <TableCell className="pl-4"><div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-muted text-lg" aria-hidden>{c.icon}</span>
                  <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.key}</div></div>
                </div></TableCell>
                <TableCell className="text-right tabular-nums">{num(c.products)}</TableCell>
                <TableCell><Switch checked={c.destock} onCheckedChange={v => toggle(c, "destock", v)} aria-label={`Afficher ${c.name} sur Destock`} /></TableCell>
                <TableCell><Switch checked={c.market} onCheckedChange={v => toggle(c, "market", v)} aria-label={`Afficher ${c.name} sur Market`} /></TableCell>
                <TableCell className="pr-4"><div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Descendre"><ArrowDown /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEdit({ key: c.key, name: c.name, icon: c.icon, destock: c.destock, market: c.market })} aria-label="Modifier"><Pencil /></Button>
                  <Button size="icon" variant="ghost" disabled={list.length <= 1} onClick={() => setDel({ cat: c, moveTo: list.find(x => x.key !== c.key)?.key || "" })} aria-label="Supprimer"><Trash2 /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {!list.length && <EmptyRow cols={5}>Aucune catégorie</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-sm text-muted-foreground">L'ordre ici est celui des menus sur les sites. Une catégorie masquée sur un site masque aussi ses produits sur ce site.</p>

      <Dialog open={!!edit} onOpenChange={o => { if (!o) setEdit(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.key ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle></DialogHeader>
          {edit && <form className="grid gap-4" onSubmit={e => { e.preventDefault(); save() }}>
            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <Field label="Icône"><Input value={edit.icon} maxLength={8} className="text-center text-lg" onChange={e => setEdit({ ...edit, icon: e.target.value })} /></Field>
              <Field label="Nom"><Input value={edit.name} autoFocus placeholder="Ex. Beauté & parfums" onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 rounded-lg border p-3">
              <Label className="flex items-center justify-between gap-3 font-normal">Afficher sur Destock (gros)<Switch checked={edit.destock} onCheckedChange={v => setEdit({ ...edit, destock: v })} /></Label>
              <Label className="flex items-center justify-between gap-3 font-normal">Afficher sur Market (détail)<Switch checked={edit.market} onCheckedChange={v => setEdit({ ...edit, market: v })} /></Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>Annuler</Button>
              <Button type="submit" disabled={!edit.name.trim()}>Enregistrer</Button>
            </DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={o => { if (!o) setDel(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {del?.cat.name} » ?</DialogTitle>
            <DialogDescription>{del?.cat.products ? `${num(del.cat.products)} produit(s) sont dans cette catégorie. Ils seront déplacés dans la catégorie choisie.` : "Aucun produit n'est dans cette catégorie."}</DialogDescription>
          </DialogHeader>
          {del && !!del.cat.products && <Field label="Déplacer les produits vers">
            <SelectField value={del.moveTo} onChange={v => setDel({ ...del, moveTo: v })} options={list.filter(x => x.key !== del.cat.key).map(x => ({ value: x.key, label: `${x.icon} ${x.name}` }))} />
          </Field>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Annuler</Button>
            <Button variant="destructive" onClick={remove}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
