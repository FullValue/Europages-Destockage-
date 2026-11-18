import { Boxes, ExternalLink, FileText, History, LayoutDashboard, LogOut, Mail, Settings, ShoppingCart, Users } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar"
import { api } from "@/lib/api"
import { useApp } from "@/lib/app-context"

export function AppSidebar({ current }: { current: string }) {
  const { stats } = useApp()
  const { setOpenMobile } = useSidebar()
  const groups = [
    { label: "", items: [{ r: "", label: "Tableau de bord", icon: LayoutDashboard }] },
    { label: "Ventes", items: [
      { r: "commandes", label: "Commandes", icon: ShoppingCart, n: stats?.ordersToProcess },
      { r: "demandes", label: "Demandes de devis", icon: FileText, n: stats?.newRequests },
      { r: "clients", label: "Clients", icon: Users },
    ] },
    { label: "Catalogue", items: [
      { r: "produits", label: "Produits & stock", icon: Boxes, n: stats?.lowStock },
      { r: "stock", label: "Mouvements", icon: History },
    ] },
    { label: "Relation", items: [{ r: "messages", label: "Messages", icon: Mail, n: stats?.newMessages }] },
  ]
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu><SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <a href="#/">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">C</div>
              <div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-semibold">Compack</span><span className="truncate text-xs text-muted-foreground">Destock · Market</span></div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem></SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map(g => (
          <SidebarGroup key={g.label || "main"}>
            {g.label && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent><SidebarMenu>
              {g.items.map(i => (
                <SidebarMenuItem key={i.r}>
                  <SidebarMenuButton asChild isActive={current === i.r} tooltip={i.label}>
                    <a href={"#/" + i.r} onClick={() => setOpenMobile(false)}><i.icon /><span>{i.label}</span></a>
                  </SidebarMenuButton>
                  {!!("n" in i && i.n) && <SidebarMenuBadge>{i.n}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton asChild tooltip="Site Destock"><a href="/destock/" target="_blank" rel="noreferrer"><ExternalLink /><span>Site Destock</span></a></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton asChild tooltip="Site Market"><a href="/market/" target="_blank" rel="noreferrer"><ExternalLink /><span>Site Market</span></a></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton asChild isActive={current === "parametres"} tooltip="Paramètres"><a href="#/parametres" onClick={() => setOpenMobile(false)}><Settings /><span>Paramètres</span></a></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton tooltip="Déconnexion" onClick={async () => { await api("logout", "POST"); location.reload() }}><LogOut /><span>Déconnexion</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
