"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatCard, Card, Badge, EmptyState } from "@/components/ui";
import { scoreColor, statusLabel, replyClassLabel, formatDate } from "@/lib/utils";
import Link from "next/link";

interface DashboardData {
  stats: {
    totalProspects: number;
    audited: number;
    contacted: number;
    hot: number;
    cold: number;
    campaigns: number;
  };
  topProspects: {
    id: string;
    name: string;
    auditScore: number;
    city: string | null;
    status: string;
  }[];
  recentReplies: {
    id: string;
    classification: string;
    aiSummary: string | null;
    receivedAt: string;
    prospect: { name: string };
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Tableau de bord" description="Vue d'ensemble" />
        <div className="p-8 text-sm text-stone-500">Chargement…</div>
      </>
    );
  }

  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Suivi de vos campagnes de prospection"
      />

      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Prospects" value={data.stats.totalProspects} />
          <StatCard label="Audités" value={data.stats.audited} />
          <StatCard
            label="Prospects chauds"
            value={data.stats.hot}
            sub="Réponses positives"
          />
          <StatCard label="Campagnes" value={data.stats.campaigns} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-900">
                Top pertinence
              </h2>
              <p className="text-xs text-stone-500">
                Prospects classés par score d&apos;audit
              </p>
            </div>
            {data.topProspects.length === 0 ? (
              <EmptyState message="Lancez une recherche pour commencer" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.topProspects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/prospects/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-stone-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-900">
                          {p.name}
                        </p>
                        <p className="text-xs text-stone-500">{p.city}</p>
                      </div>
                      <Badge className={scoreColor(p.auditScore)}>
                        {p.auditScore}/100
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-900">
                Réponses récentes
              </h2>
            </div>
            {data.recentReplies.length === 0 ? (
              <EmptyState message="Aucune réponse reçue pour l'instant" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.recentReplies.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-stone-900">
                        {r.prospect.name}
                      </p>
                      <Badge
                        className={
                          r.classification === "HOT"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : r.classification === "COLD"
                              ? "border-stone-200 bg-stone-50 text-stone-600"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      >
                        {replyClassLabel(r.classification)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {r.aiSummary ?? "—"} · {formatDate(r.receivedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
