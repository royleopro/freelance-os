"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Clock,
  Target,
  Landmark,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projets", href: "/projets", icon: FolderKanban },
  { title: "Devis", href: "/devis", icon: FileText },
  { title: "Heures", href: "/heures", icon: Clock },
  { title: "Objectifs", href: "/objectifs", icon: Target },
  { title: "Tresorerie", href: "/abonnements", icon: Landmark },
  { title: "Paramètres", href: "/parametres", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent text-[#0A0A0A] text-sm font-bold">
            F
          </div>
          <span className="font-heading font-semibold text-sm tracking-tight">Freelance OS</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      className={
                        isActive
                          ? "bg-[rgba(10,207,131,0.1)] text-brand-accent font-medium"
                          : "text-brand-muted hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[rgba(255,255,255,0.06)] p-4">
        <p className="text-xs text-brand-muted">v0.1.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
