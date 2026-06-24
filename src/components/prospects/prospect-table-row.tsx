"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import {
  scoreColor,
  statusLabel,
  contactChannelLabel,
  statusBadgeClass,
  prospectRowTintClass,
} from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Instagram,
  Facebook,
  Loader2,
  Mail,
} from "lucide-react";
import {
  MockupSection,
  type MockupJobSummary,
} from "@/components/prospects/mockup-section";

interface ProspectSummary {
  id: string;
  name: string;
  activity: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  auditScore: number;
  status: string;
  contactChannel: string | null;
}

interface AuditDetails {
  summary: string;
  issues: string[];
  opportunities: string[];
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  https: boolean;
  responsive: boolean;
  hasWebsite: boolean;
  visual?: {
    analyzed: boolean;
    rating: string;
    summary: string;
    needsWorkScore: number;
  } | null;
}

interface ProspectDetail extends ProspectSummary {
  auditDetails: string | null;
  enrichmentSource: string | null;
  campaign: { sector: string; city: string } | null;
  latestMockupJob?: MockupJobSummary | null;
}

interface ProspectTableRowProps {
  prospect: ProspectSummary;
  campaignSector?: string;
  onRefresh: () => void;
}

export function ProspectTableRow({
  prospect,
  campaignSector,
  onRefresh,
}: ProspectTableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");

  const isLawyerCampaign = /avocat|barreau/i.test(
    campaignSector ?? prospect.activity ?? ""
  );

  useEffect(() => {
    if (!expanded || detail) return;
    setLoadingDetail(true);
    fetch(`/api/prospects/${prospect.id}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setLoadingDetail(false));
  }, [expanded, detail, prospect.id]);

  async function runAction(action: string) {
    setActionLoading(action);
    setActionError("");
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error ?? "L'opération a échoué");
        return;
      }
      const refreshed = await fetch(`/api/prospects/${prospect.id}`).then((r) =>
        r.json()
      );
      setDetail(refreshed);
      onRefresh();
    } finally {
      setActionLoading("");
    }
  }

  const audit: AuditDetails | null = detail?.auditDetails
    ? JSON.parse(detail.auditDetails)
    : null;

  const email = detail?.email ?? prospect.email;

  return (
    <>
      <tr className={prospectRowTintClass(prospect.status, expanded)}>
        <td className="w-10 px-3 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
            aria-expanded={expanded}
            aria-label={expanded ? "Replier" : "Déplier"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left font-medium text-stone-900 hover:underline"
          >
            {prospect.name}
          </button>
          {prospect.activity && (
            <p className="text-xs text-stone-500">{prospect.activity}</p>
          )}
        </td>
        <td className="px-5 py-3 text-stone-600">{prospect.city ?? "—"}</td>
        <td className="px-5 py-3">
          {prospect.auditScore > 0 ? (
            <Badge className={scoreColor(prospect.auditScore)}>
              {prospect.auditScore}/100
            </Badge>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </td>
        <td className="px-5 py-3">
          <Badge className={statusBadgeClass(prospect.status)}>
            {statusLabel(prospect.status)}
          </Badge>
          {prospect.contactChannel && (
            <span className="ml-1.5 text-[10px] text-blue-600">
              {contactChannelLabel(prospect.contactChannel)}
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-xs text-stone-500">
          {prospect.email ?? prospect.phone ?? "—"}
        </td>
        <td className="px-5 py-3">
          <Link href={`/prospects/${prospect.id}`} title="Fiche complète">
            <ExternalLink className="h-4 w-4 text-stone-400 hover:text-stone-700" />
          </Link>
        </td>
      </tr>

      {expanded && (
        <tr className={prospectRowTintClass(prospect.status, true)}>
          <td colSpan={7} className="border-t border-stone-100 px-5 py-4">
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-stone-500">
                    Audit
                  </p>
                  {audit ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-stone-700">{audit.summary}</p>
                      {audit.visual?.analyzed && (
                        <p className="text-xs text-stone-600">
                          Visuel : {audit.visual.summary} (
                          {audit.visual.needsWorkScore}/100 refonte)
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <CheckPill label="Site" ok={audit.hasWebsite} />
                        <CheckPill label="HTTPS" ok={audit.https} />
                        <CheckPill label="Responsive" ok={audit.responsive} />
                      </div>
                      {audit.issues.length > 0 && (
                        <ul className="list-inside list-disc text-xs text-stone-600">
                          {audit.issues.slice(0, 4).map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      )}
                      {audit.instagramUrl && (
                        <a
                          href={audit.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-pink-600 hover:underline"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          Instagram
                        </a>
                      )}
                      {audit.facebookUrl && (
                        <a
                          href={audit.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#1877F2] hover:underline"
                        >
                          <Facebook className="h-3.5 w-3.5" />
                          Facebook
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-stone-500">
                      Audit non effectué — lancez l&apos;audit ci-contre.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-stone-500">
                    Actions rapides
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => runAction("audit")}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === "audit" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Auditer"
                      )}
                    </Button>
                    {email ? (
                      <Button
                        size="sm"
                        onClick={() => runAction("send-email")}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === "send-email" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Mail className="mr-1 h-3 w-3" />
                            Envoyer email
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runAction("find-email")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "find-email" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Chercher email"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => runAction("find-facebook")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "find-facebook" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Facebook className="mr-1 h-3 w-3" />
                              Via Facebook
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-stone-600">
                    {email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {email}
                        {detail?.enrichmentSource?.includes("barreau") && (
                          <span className="text-violet-600">· barreau</span>
                        )}
                        {detail?.enrichmentSource?.includes("facebook") && (
                          <span className="text-[#1877F2]">· facebook</span>
                        )}
                      </p>
                    )}
                    {prospect.website && (
                      <p className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        <a
                          href={
                            prospect.website.startsWith("http")
                              ? prospect.website
                              : `https://${prospect.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {prospect.website}
                        </a>
                      </p>
                    )}
                  </div>

                  {actionError && (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {actionError}
                    </p>
                  )}

                  {(prospect.status === "HOT" ||
                    prospect.status === "WARM" ||
                    prospect.status === "REPLIED" ||
                    detail?.latestMockupJob) && (
                    <MockupSection
                      compact
                      job={detail?.latestMockupJob}
                      prospectStatus={prospect.status}
                      loading={actionLoading}
                      onLaunch={() => runAction("launch-mockup")}
                      onSync={() => runAction("sync-mockup")}
                    />
                  )}

                  <Link
                    href={`/prospects/${prospect.id}`}
                    className="mt-3 inline-block text-xs text-stone-500 underline hover:text-stone-900"
                  >
                    Ouvrir la fiche complète →
                  </Link>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CheckPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-400"}`}
      />
      {label}
    </span>
  );
}
