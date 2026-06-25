"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  Settings,
  Mail,
  Send,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/search", label: "Recherche web", icon: Search },
  { href: "/prospects", label: "Prospects web", icon: Users },
  { href: "/commercial/search", label: "Commerciaux", icon: Briefcase },
  { href: "/commercial/prospects", label: "Prospects commerciaux", icon: Users },
  { href: "/outreach", label: "Suivi envois", icon: Send },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-stone-900 text-white">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">Prospect CRM</p>
            <p className="text-xs text-stone-500">Prospection web</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-stone-100 font-medium text-stone-900"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-200 p-4">
        <p className="text-xs text-stone-400">Relances auto J4 · J7 · J12</p>
      </div>
    </aside>
  );
}
