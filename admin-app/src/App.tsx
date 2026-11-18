import { useCallback, useEffect, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { ConfirmProvider } from "@/components/confirm"
import { useHashRoute } from "@/hooks/use-hash-route"
import { api } from "@/lib/api"
import { AppCtx } from "@/lib/app-context"
import type { Settings, Stats } from "@/lib/types"
import { LoginPage } from "@/pages/login"
import { DashboardPage } from "@/pages/dashboard"
import { ProductsPage } from "@/pages/products"
import { ProductEditPage } from "@/pages/product-edit"
import { MovementsPage } from "@/pages/movements"
import { RequestsPage, RequestDetailPage } from "@/pages/requests"
import { OrdersPage } from "@/pages/orders"
import { OrderDetailPage } from "@/pages/order-detail"
import { OrderNewPage } from "@/pages/order-new"
import { CustomersPage, CustomerDetailPage } from "@/pages/customers"
import { MessagesPage } from "@/pages/messages"
import { SettingsPage } from "@/pages/settings"

const TITLES: Record<string, string> = {
  "": "Tableau de bord", commandes: "Commandes", demandes: "Demandes de devis", clients: "Clients",
  produits: "Produits & stock", stock: "Mouvements", messages: "Messages", parametres: "Paramètres",
}

export default function App() {
  const [auth, setAuth] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const { parts, query } = useHashRoute()

  const refresh = useCallback(() => {
    api<Settings>("settings").then(setSettings).catch(() => {})
    api<Stats>("stats").then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    const out = () => setAuth(false)
    window.addEventListener("compack:unauth", out)
    api("me").then(() => { setAuth(true); refresh() }).catch(() => setAuth(false))
    return () => window.removeEventListener("compack:unauth", out)
  }, [refresh])

  if (auth === null) return null
  if (!auth) return <><LoginPage onLogin={() => { setAuth(true); refresh() }} /><Toaster /></>

  const [r = "", id] = parts
  const page = () => {
    switch (r) {
      case "commandes": return id === "nouvelle" ? <OrderNewPage /> : id ? <OrderDetailPage key={id} id={id} /> : <OrdersPage />
      case "demandes": return id ? <RequestDetailPage key={id} id={id} /> : <RequestsPage />
      case "clients": return id ? <CustomerDetailPage key={id} id={id} /> : <CustomersPage />
      case "produits": return id ? <ProductEditPage key={id} id={id} /> : <ProductsPage key={query.get("f") || "all"} initialFilter={query.get("f") || "all"} />
      case "stock": return <MovementsPage />
      case "messages": return <MessagesPage />
      case "parametres": return <SettingsPage />
      default: return <DashboardPage />
    }
  }

  return (
    <AppCtx.Provider value={{ settings, stats, refresh }}>
      <TooltipProvider>
        <ConfirmProvider>
          <SidebarProvider>
            <AppSidebar current={r} />
            <SidebarInset className="min-w-0">
              <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur print:hidden">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                <span className="text-sm font-medium">{TITLES[r] ?? "Compack"}</span>
              </header>
              <main className="mx-auto w-full max-w-7xl p-4 md:p-6">{page()}</main>
            </SidebarInset>
          </SidebarProvider>
        </ConfirmProvider>
      </TooltipProvider>
      <Toaster richColors position="bottom-right" />
    </AppCtx.Provider>
  )
}
