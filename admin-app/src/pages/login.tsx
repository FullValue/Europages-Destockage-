import { useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("")
    try { await api("login", "POST", { password }); onLogin() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle className="text-xl">Compack</CardTitle><CardDescription>Back-office Destock et Market</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="grid gap-2"><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" autoComplete="current-password" autoFocus required value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
