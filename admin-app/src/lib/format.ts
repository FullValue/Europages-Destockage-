import type { Product, Settings } from "./types"

const grp = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
export const eur = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—"
  const [i, d] = Math.abs(n).toFixed(2).split(".")
  return (n < 0 ? "-" : "") + grp(i) + "," + d + " €"
}
export const num = (n: number | null | undefined) => (n == null ? "—" : (n < 0 ? "-" : "") + grp(String(Math.abs(Math.round(n)))))
export const date = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—")
export const dateTime = (d?: string) => (d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
export const imgUrl = (p: string) => (/^https?:\/\//.test(p) ? p : "/" + p.replace(/^\//, ""))
export const lowOf = (p: Product, s: Settings | null) => p.alertThreshold ?? s?.lowStockDefault ?? 10

export type Tone = "warn" | "info" | "ok" | "bad" | "mute" | "ds" | "mk"
export const ORDER_ST: Record<string, [string, Tone]> = {
  en_attente: ["En attente", "warn"], confirmee: ["Confirmée", "info"], preparation: ["En préparation", "info"],
  expediee: ["Expédiée", "mk"], livree: ["Livrée", "ok"], annulee: ["Annulée", "bad"],
}
export const PAY_ST: Record<string, [string, Tone]> = { en_attente: ["Paiement en attente", "warn"], payee: ["Payée", "ok"], remboursee: ["Remboursée", "mute"] }
export const REQ_ST: Record<string, [string, Tone]> = {
  nouvelle: ["Nouvelle", "warn"], en_cours: ["En cours", "info"], devis_envoye: ["Devis envoyé", "mk"], acceptee: ["Acceptée", "ok"], refusee: ["Refusée", "bad"],
}
export const DS_ST: Record<string, string> = { disponible: "Disponible", sur_demande: "Prix sur demande", vendu: "Vendu" }
export const PAYMENT: Record<string, string> = { carte: "Carte", virement: "Virement", retrait: "Retrait showroom", especes: "Espèces", cheque: "Chèque" }
export const opts = (m: Record<string, [string, Tone]>) => Object.entries(m).map(([value, [label]]) => ({ value, label }))
