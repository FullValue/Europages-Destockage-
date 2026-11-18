import { useEffect, useState } from "react"
import { Download, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ErrorBox, Field, Loading, PageHeader, run, SelectField } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import type { Settings } from "@/lib/types"

const EXPORTS = [["products", "Produits"], ["orders", "Commandes"], ["requests", "Demandes"], ["customers", "Clients"], ["movements", "Mouvements"], ["messages", "Messages"]]
const COMPANY: [keyof Settings["company"], string][] = [["name", "Raison sociale"], ["email", "E-mail de contact"], ["phone", "Téléphone"], ["address", "Adresse"], ["siret", "SIRET"]]

export function SettingsPage() {
  const { refresh } = useApp()
  const confirm = useConfirm()
  const { data, error } = useData(() => api<Settings>("settings"))
  const [s, setS] = useState<Settings | null>(null)
  const [pw, setPw] = useState("")
  useEffect(() => { if (data) setS(data) }, [data])
  if (error) return <ErrorBox message={error} />
  if (!s) return <Loading />
  const save = () => run(async () => {
    await api("settings", "PATCH", { shippingFee: s.shippingFee, freeShippingFrom: s.freeShippingFrom, vatRate: s.vatRate, lowStockDefault: s.lowStockDefault, company: s.company })
    toast.success("Paramètres enregistrés"); refresh()
  })
  const changePw = () => run(async () => { await api("settings", "PATCH", { newPassword: pw }); setPw(""); toast.success("Mot de passe modifié") })
  const clearDemo = () => run(async () => {
    if (!await confirm({ title: "Supprimer les données de démo ?", description: "Les commandes, demandes, clients et messages marqués « démo » seront supprimés. Le stock n'est pas modifié.", action: "Supprimer", destructive: true })) return
    await api("demo/clear", "POST"); toast.success("Données de démo supprimées"); refresh()
  })
  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Boutique et société</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Frais de livraison TTC"><Input type="number" step="0.01" value={s.shippingFee} onChange={e => setS({ ...s, shippingFee: +e.target.value })} /></Field>
              <Field label="Livraison offerte dès (TTC)"><Input type="number" step="0.01" value={s.freeShippingFrom} onChange={e => setS({ ...s, freeShippingFrom: +e.target.value })} /></Field>
              <Field label="Taux de TVA"><SelectField value={String(s.vatRate)} onChange={v => setS({ ...s, vatRate: +v })} options={[{ value: "0.2", label: "20 %" }, { value: "0.1", label: "10 %" }, { value: "0.055", label: "5,5 %" }]} /></Field>
              <Field label="Seuil d'alerte stock par défaut"><Input type="number" value={s.lowStockDefault} onChange={e => setS({ ...s, lowStockDefault: +e.target.value })} /></Field>
            </div>
            <Separator />
            {COMPANY.map(([k, label]) => <Field key={k} label={label}><Input value={s.company?.[k] || ""} onChange={e => setS({ ...s, company: { ...s.company, [k]: e.target.value } })} /></Field>)}
            <div><Button onClick={save}>Enregistrer</Button></div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader><CardTitle>Mot de passe administrateur</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Nouveau mot de passe (8 caractères minimum)"><Input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
              <div><Button variant="secondary" disabled={pw.length < 8} onClick={changePw}>Changer le mot de passe</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Exports CSV</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">{EXPORTS.map(([k, l]) => <Button key={k} size="sm" variant="outline" asChild><a href={`/api/admin/export/${k}.csv`}><Download /> {l}</a></Button>)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Données de démonstration</CardTitle><CardDescription>Créées pour illustrer le back-office. À supprimer avant d'ouvrir les sites au public.</CardDescription></CardHeader>
            <CardContent><Button variant="destructive" onClick={clearDemo}><Trash2 /> Supprimer les données de démo</Button></CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
