// Routing Middleware Vercel : un domaine par site.
//   compack-destock.com → Compack Destock (dossier public/destock)
//   compack-market.com  → Compack Market  (dossier public/market)
//   europages-destockage.vercel.app → accueil, /destock/, /market/ et /admin/ (inchangé)
// Sur les domaines publics, l'admin renvoie vers l'adresse Vercel, et les liens entre sites
// renvoient vers le bon domaine. L'API (/api) et les photos des lots (/assets/lots, /assets/uploads)
// sont communes et ne passent pas par ici.
import { next, rewrite } from "@vercel/functions"

const SITES = { "compack-destock.com": "destock", "compack-market.com": "market" }
const DOMAIN = { destock: "compack-destock.com", market: "compack-market.com" }
const ADMIN = "https://europages-destockage.vercel.app/admin/"

export const config = { matcher: "/((?!api/|assets/lots/|assets/uploads/).*)" }

const under = (path, dir) => path === "/" + dir || path.startsWith("/" + dir + "/")

export default function middleware(request) {
  const url = new URL(request.url)
  const host = (request.headers.get("host") || url.hostname).toLowerCase().split(":")[0]

  // www.compack-xxx.com → compack-xxx.com
  if (host.startsWith("www.") && SITES[host.slice(4)]) return Response.redirect(`https://${host.slice(4)}${url.pathname}${url.search}`, 308)

  const site = SITES[host]
  if (!site) return next()

  const path = url.pathname
  const other = site === "market" ? "destock" : "market"
  if (under(path, "admin")) return Response.redirect(ADMIN, 302)
  if (under(path, other)) return Response.redirect(`https://${DOMAIN[other]}${path.slice(other.length + 1) || "/"}${url.search}`, 302)
  // Adresses propres : compack-market.com/market/panier.html → compack-market.com/panier.html
  if (under(path, site)) return Response.redirect(`https://${host}${path.slice(site.length + 1) || "/"}${url.search}`, 308)

  return rewrite(new URL(`/${site}${path}`, url))
}
