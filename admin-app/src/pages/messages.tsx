import { useState } from "react"
import { Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorBox, Loading, PageHeader, run, SiteBadge, Status } from "@/components/common"
import { useConfirm } from "@/components/confirm"
import { useData } from "@/hooks/use-data"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { dateTime } from "@/lib/format"
import type { Message } from "@/lib/types"

const LABEL: Record<string, string> = { cat: "Catégorie", qte: "Quantité", prix: "Prix cible" }

export function MessagesPage() {
  const { refresh } = useApp()
  const confirm = useConfirm()
  const { data: list, error, reload } = useData(() => api<Message[]>("messages"))
  const [f, setF] = useState("all")
  if (error) return <ErrorBox message={error} />
  if (!list) return <Loading />
  const rows = list.filter(m => f === "all" || (f === "sell" ? m.type === "sell" : m.status === "nouveau"))
  const done = (id: string) => run(async () => { await api("messages/" + id, "PATCH", { status: "traite" }); reload(); refresh() })
  const del = (id: string) => run(async () => {
    if (!await confirm({ title: "Supprimer ce message ?", action: "Supprimer", destructive: true })) return
    await api("messages/" + id, "DELETE"); reload(); refresh()
  })
  return (
    <>
      <PageHeader title="Messages" description="Formulaires de contact et propositions de stock des deux sites" />
      <Tabs value={f} onValueChange={setF} className="mb-4"><TabsList><TabsTrigger value="all">Tous</TabsTrigger><TabsTrigger value="new">Non traités</TabsTrigger><TabsTrigger value="sell">Propositions de stock</TabsTrigger></TabsList></Tabs>
      <div className="grid gap-4">
        {rows.map(m => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">{m.subject} <SiteBadge site={m.site} />{m.type === "sell" && <Status tone="info">Proposition de stock</Status>}</CardTitle>
              <CardDescription>{m.name}{m.company ? " · " + m.company : ""} · <a className="hover:underline" href={"mailto:" + m.email}>{m.email}</a>{m.phone ? " · " + m.phone : ""}</CardDescription>
              <CardAction className="text-xs text-muted-foreground">{dateTime(m.createdAt)}</CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {!!Object.keys(m.fields || {}).length && <div className="flex flex-wrap gap-2">{Object.entries(m.fields).map(([k, v]) => <Badge key={k} variant="secondary">{LABEL[k] || k} : {v}</Badge>)}</div>}
              <p className="whitespace-pre-wrap">{m.body}</p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild><a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}><Mail /> Répondre</a></Button>
              {m.status === "nouveau" ? <Button size="sm" onClick={() => done(m.id)}>Marquer traité</Button> : <Status tone="ok">Traité</Status>}
              <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 /> Supprimer</Button>
            </CardFooter>
          </Card>
        ))}
        {!rows.length && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucun message</CardContent></Card>}
      </div>
    </>
  )
}
