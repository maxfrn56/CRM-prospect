"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";

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
  onDelete?: (id: string) => Promise<void>;
}

export function CampaignSidebar({
  campaigns,
  selectedId,
  loading,
  onDelete,
}: CampaignSidebarProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function selectCampaign(id: string) {
    router.push(`/prospects?campaign=${id}`);
  }

  async function handleDelete(c: Campaign) {
    const count = c._count.prospects;
    const message =
      count > 0
        ? `Supprimer « ${c.name} » ?\n\nLes ${count} prospect${count > 1 ? "s" : ""} de cette campagne seront également supprimés. Cette action est irréversible.`
        : `Supprimer « ${c.name} » ? Cette action est irréversible.`;

    if (!window.confirm(message)) return;

    setDeletingId(c.id);
    try {
      await onDelete?.(c.id);
    } finally {
      setDeletingId(null);
    }
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
              const isDeleting = deletingId === c.id;

              return (
                <li key={c.id} className="group flex items-start gap-0.5">
                  <button
                    type="button"
                    onClick={() => selectCampaign(c.id)}
                    disabled={isDeleting}
                    className={`min-w-0 flex-1 rounded-md px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
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
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={isDeleting}
                      title="Supprimer la campagne"
                      className={`mt-2 shrink-0 rounded-md p-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50 ${
                        active
                          ? "text-stone-400 hover:bg-stone-800 hover:text-red-300"
                          : "text-stone-400 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
