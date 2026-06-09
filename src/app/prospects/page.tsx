"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import {
  CampaignSidebar,
  type Campaign,
} from "@/components/prospects/campaign-sidebar";
import { scoreColor, statusLabel } from "@/lib/utils";
import { ArrowUpDown, ExternalLink, Loader2 } from "lucide-react";

interface Prospect {
  id: string;
  name: string;
  activity: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  auditScore: number;
  status: string;
  campaign: { name: string; sector: string; city: string } | null;
  _count: { emails: number; replies: number };
}

function ProspectsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignId = searchParams.get("campaign");
  const isImporting = searchParams.get("importing") === "1";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [importStatus, setImportStatus] = useState<string | null>(
    isImporting ? "Import en cours…" : null
  );

  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns)
      .finally(() => setCampaignsLoading(false));
  }, []);

  // Auto-sélectionner la dernière campagne
  useEffect(() => {
    if (campaignsLoading || campaignId || campaigns.length === 0) return;
    router.replace(`/prospects?campaign=${campaigns[0].id}`);
  }, [campaigns, campaignsLoading, campaignId, router]);

  const loadProspects = useCallback(() => {
    if (!campaignId) return Promise.resolve();

    const params = new URLSearchParams({ campaignId });
    if (filter !== "all") params.set("status", filter);

    return fetch(`/api/prospects?${params}`)
      .then((r) => r.json())
      .then(setProspects);
  }, [campaignId, filter]);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    loadProspects().finally(() => setLoading(false));
  }, [campaignId, loadProspects]);

  useEffect(() => {
    if (!isImporting || !campaignId) return;

    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        const data = await res.json();
        await loadProspects();
        fetch("/api/campaigns")
          .then((r) => r.json())
          .then(setCampaigns);

        if (data.prospectCount > 0) {
          setImportStatus(`${data.prospectCount} prospect(s) importé(s)`);
          clearInterval(interval);
          setTimeout(() => setImportStatus(null), 4000);
        } else if (attempts >= maxAttempts) {
          setImportStatus(
            "Import terminé ou en cours — actualisez si la liste est vide"
          );
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isImporting, campaignId, loadProspects]);

  async function auditAll() {
    if (!campaignId) return;
    setAuditing(true);
    await fetch(`/api/campaigns/${campaignId}/audit`, { method: "POST" });
    await loadProspects();
    setAuditing(false);
  }

  return (
    <div className="flex min-h-full">
      <CampaignSidebar
        campaigns={campaigns}
        selectedId={campaignId}
        loading={campaignsLoading}
      />

      <div className="flex-1 overflow-auto">
        <PageHeader
          title={selectedCampaign?.name ?? "Prospects"}
          description={
            selectedCampaign
              ? `${selectedCampaign.sector} · ${selectedCampaign.city} — classés par pertinence`
              : "Sélectionnez une campagne"
          }
        >
          {campaignId && (
            <Button
              variant="secondary"
              onClick={auditAll}
              disabled={auditing || loading}
            >
              {auditing ? "Audit en cours…" : "Auditer tous"}
            </Button>
          )}
        </PageHeader>

        <div className="p-8">
          {importStatus && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              {importStatus}
            </div>
          )}

          {!campaignId ? (
            <EmptyState message="Sélectionnez une campagne dans la liste." />
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                {[
                  { key: "all", label: "Tous" },
                  { key: "AUDITED", label: "Audités" },
                  { key: "CONTACTED", label: "Contactés" },
                  { key: "HOT", label: "Chauds" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === key
                        ? "bg-stone-900 text-white"
                        : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <Card>
                {loading ? (
                  <div className="p-8 text-sm text-stone-500">Chargement…</div>
                ) : prospects.length === 0 ? (
                  <EmptyState
                    message={
                      isImporting
                        ? "Import en cours, les prospects arrivent…"
                        : "Aucun prospect dans cette campagne."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                          <th className="px-5 py-3 font-medium">Entreprise</th>
                          <th className="px-5 py-3 font-medium">Ville</th>
                          <th className="px-5 py-3 font-medium">
                            <span className="inline-flex items-center gap-1">
                              Score <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </th>
                          <th className="px-5 py-3 font-medium">Statut</th>
                          <th className="px-5 py-3 font-medium">Contact</th>
                          <th className="px-5 py-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {prospects.map((p) => (
                          <tr key={p.id} className="hover:bg-stone-50">
                            <td className="px-5 py-3">
                              <Link
                                href={`/prospects/${p.id}`}
                                className="font-medium text-stone-900 hover:underline"
                              >
                                {p.name}
                              </Link>
                              {p.activity && (
                                <p className="text-xs text-stone-500">
                                  {p.activity}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-stone-600">
                              {p.city ?? "—"}
                            </td>
                            <td className="px-5 py-3">
                              {p.auditScore > 0 ? (
                                <Badge className={scoreColor(p.auditScore)}>
                                  {p.auditScore}/100
                                </Badge>
                              ) : (
                                <span className="text-stone-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <Badge className="border-stone-200 bg-stone-50 text-stone-600">
                                {statusLabel(p.status)}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-xs text-stone-500">
                              {p.email ?? p.phone ?? "—"}
                            </td>
                            <td className="px-5 py-3">
                              <Link href={`/prospects/${p.id}`}>
                                <ExternalLink className="h-4 w-4 text-stone-400" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-stone-500">Chargement…</div>}
    >
      <ProspectsContent />
    </Suspense>
  );
}
