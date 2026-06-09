"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { FolderOpen, Plus } from "lucide-react";

export interface Campaign {
  id: string;
  name: string;
  sector: string;
  city: string;
  createdAt: string;
  _count: { prospects: number };
}

interface CampaignSidebarProps {
  campaigns: Campaign[];
  selectedId: string | null;
  loading?: boolean;
}

export function CampaignSidebar({
  campaigns,
  selectedId,
  loading,
}: CampaignSidebarProps) {
  const router = useRouter();

  function selectCampaign(id: string) {
    router.push(`/prospects?campaign=${id}`);
  }

  return (
    <aside className="w-72 shrink-0 border-r border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Campagnes</h2>
        <Link
          href="/search"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle
        </Link>
      </div>

      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-2">
        {loading ? (
          <p className="px-3 py-4 text-xs text-stone-500">Chargement…</p>
        ) : campaigns.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-2 text-xs text-stone-500">Aucune campagne</p>
            <Link
              href="/search"
              className="mt-2 inline-block text-xs text-stone-700 underline"
            >
              Lancer une recherche
            </Link>
          </div>
        ) : (
          <ul className="space-y-1">
            {campaigns.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCampaign(c.id)}
                    className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-stone-900 text-white"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        active ? "text-stone-300" : "text-stone-500"
                      }`}
                    >
                      {c.sector} · {c.city}
                    </p>
                    <p
                      className={`mt-1 text-[11px] ${
                        active ? "text-stone-400" : "text-stone-400"
                      }`}
                    >
                      {c._count.prospects} prospect
                      {c._count.prospects !== 1 ? "s" : ""} ·{" "}
                      {formatDate(c.createdAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
