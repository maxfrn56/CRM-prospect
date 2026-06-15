"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Badge, StatCard, EmptyState } from "@/components/ui";
import {
  contactChannelLabel,
  emailTypeLabel,
  formatDate,
  OUTREACH_STEPS,
  replyClassLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/utils";
import { Check, Circle, MessageSquare, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

interface OutreachEmail {
  id: string;
  type: string;
  status: string;
  subject: string;
  sentAt: string | null;
  followupDay: number | null;
}

interface OutreachReply {
  id: string;
  classification: string;
  aiSummary: string | null;
  receivedAt: string;
}

interface OutreachProspect {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  status: string;
  replyClass: string | null;
  contactChannel: string | null;
  contactedAt: string | null;
  campaign: { name: string } | null;
  emails: OutreachEmail[];
  replies: OutreachReply[];
}

interface OutreachData {
  prospects: OutreachProspect[];
  stats: {
    total: number;
    contacted: number;
    replied: number;
    hot: number;
    cold: number;
  };
}

function EmailTimeline({ emails }: { emails: OutreachEmail[] }) {
  const sentByType = new Map(
    emails
      .filter(
        (e) =>
          e.status === "SENT" ||
          e.status === "DELIVERED" ||
          e.status === "OPENED" ||
          e.status === "REPLIED"
      )
      .map((e) => [e.type, e])
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OUTREACH_STEPS.map((step) => {
        const sent = sentByType.get(step);
        const done = Boolean(sent?.sentAt);

        return (
          <div
            key={step}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              done
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-stone-200 bg-stone-50 text-stone-400"
            }`}
            title={
              done && sent?.sentAt
                ? `${emailTypeLabel(step)} — ${formatDate(sent.sentAt)}`
                : emailTypeLabel(step)
            }
          >
            {done ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <Circle className="h-3 w-3 shrink-0" />
            )}
            {step === "INITIAL"
              ? "Initial"
              : step.replace("FOLLOWUP_J", "J+")}
          </div>
        );
      })}
    </div>
  );
}

export default function OutreachPage() {
  const [data, setData] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [followupInfo, setFollowupInfo] = useState<{
    enabled: boolean;
    due: number;
    hint: string;
    cronUrl: string | null;
    items: {
      prospectName: string;
      daysSince: number;
      nextFollowup: string | null;
      action: string;
      reason?: string;
    }[];
  } | null>(null);
  const [followupRunning, setFollowupRunning] = useState(false);
  const [followupMessage, setFollowupMessage] = useState("");

  function loadFollowups() {
    fetch("/api/followups")
      .then((r) => r.json())
      .then(setFollowupInfo)
      .catch(() => null);
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/outreach?filter=${filter}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
    loadFollowups();
  }, [filter]);

  async function runFollowups() {
    setFollowupRunning(true);
    setFollowupMessage("");
    try {
      const res = await fetch("/api/followups", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        setFollowupMessage(result.error ?? "Erreur");
        return;
      }
      setFollowupMessage(
        result.processed > 0
          ? `${result.processed} relance(s) envoyée(s).`
          : "Aucune relance à envoyer pour le moment."
      );
      loadFollowups();
      fetch(`/api/outreach?filter=${filter}`)
        .then((r) => r.json())
        .then(setData);
    } finally {
      setFollowupRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Suivi des envois"
        description="Prospects contactés, relances et réponses"
      />

      <div className="space-y-6 p-8">
        {data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Contactés" value={data.stats.total} />
            <StatCard label="En attente" value={data.stats.contacted} />
            <StatCard label="Réponses" value={data.stats.replied} />
            <StatCard label="Chauds" value={data.stats.hot} />
            <StatCard label="Froids" value={data.stats.cold} />
          </div>
        )}

        {followupInfo && (
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  Relances automatiques (J+4, J+7, J+12)
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {followupInfo.enabled
                    ? followupInfo.hint
                    : "Relances désactivées — activez-les dans Paramètres."}
                </p>
                {followupInfo.due > 0 && (
                  <p className="mt-2 text-sm font-medium text-amber-800">
                    {followupInfo.due} relance(s) en attente
                  </p>
                )}
                {followupInfo.cronUrl && (
                  <p className="mt-2 break-all text-[11px] text-stone-400">
                    Cron Railway : POST {followupInfo.cronUrl} (Bearer CRON_SECRET)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={loadFollowups}
                  disabled={followupRunning}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Actualiser
                </Button>
                <Button
                  size="sm"
                  onClick={runFollowups}
                  disabled={followupRunning || !followupInfo.enabled}
                >
                  {followupRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Lancer les relances"
                  )}
                </Button>
              </div>
            </div>
            {followupMessage && (
              <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                {followupMessage}
              </p>
            )}
            {followupInfo.items.filter((i) => i.action === "due").length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-stone-600">
                {followupInfo.items
                  .filter((i) => i.action === "due")
                  .slice(0, 8)
                  .map((item) => (
                    <li key={`${item.prospectName}-${item.nextFollowup}`}>
                      {item.prospectName} — J+{item.daysSince} →{" "}
                      {item.nextFollowup
                        ? emailTypeLabel(item.nextFollowup)
                        : "—"}
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Tous" },
            { key: "CONTACTED", label: "En attente" },
            { key: "replied", label: "Répondu" },
            { key: "HOT", label: "Chauds" },
            { key: "COLD", label: "Froids" },
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
          ) : !data || data.prospects.length === 0 ? (
            <EmptyState message="Aucun prospect contacté pour l'instant." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                    <th className="px-5 py-3 font-medium">Entreprise</th>
                    <th className="px-5 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 font-medium">Séquence emails</th>
                    <th className="px-5 py-3 font-medium">Dernier envoi</th>
                    <th className="px-5 py-3 font-medium">Réponse</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.prospects.map((p) => {
                    const sentEmails = p.emails.filter(
                      (e) => e.status === "SENT" || e.status === "REPLIED"
                    );
                    const lastSent = sentEmails.at(-1);
                    const lastReply = p.replies[0];

                    return (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="px-5 py-4">
                          <Link
                            href={`/prospects/${p.id}`}
                            className="font-medium text-stone-900 hover:underline"
                          >
                            {p.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {p.email ?? "—"}
                            {p.city && ` · ${p.city}`}
                          </p>
                          {p.campaign && (
                            <p className="mt-0.5 text-[11px] text-stone-400">
                              {p.campaign.name}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={statusBadgeClass(p.status)}>
                            {statusLabel(p.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <EmailTimeline emails={p.emails} />
                          {lastSent ? (
                            <p className="mt-1.5 max-w-xs truncate text-[11px] text-stone-400">
                              {emailTypeLabel(lastSent.type)} : {lastSent.subject}
                            </p>
                          ) : p.contactChannel ? (
                            <p className="mt-1.5 text-[11px] text-blue-600">
                              Contact manuel · {contactChannelLabel(p.contactChannel)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-xs text-stone-600">
                          {lastSent?.sentAt
                            ? formatDate(lastSent.sentAt)
                            : p.contactedAt
                              ? formatDate(p.contactedAt)
                              : "—"}
                        </td>
                        <td className="px-5 py-4">
                          {lastReply ? (
                            <div>
                              <Badge
                                className={
                                  lastReply.classification === "HOT"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : lastReply.classification === "COLD"
                                      ? "border-stone-200 bg-stone-100 text-stone-600"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                }
                              >
                                <MessageSquare className="mr-1 h-3 w-3" />
                                {replyClassLabel(lastReply.classification)}
                              </Badge>
                              {lastReply.aiSummary && (
                                <p className="mt-1 max-w-[180px] truncate text-[11px] text-stone-500">
                                  {lastReply.aiSummary}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-stone-400">
                              Pas de réponse
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/prospects/${p.id}`}>
                            <ExternalLink className="h-4 w-4 text-stone-400 hover:text-stone-700" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
