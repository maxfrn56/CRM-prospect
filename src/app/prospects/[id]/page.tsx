"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import {
  scoreColor,
  statusLabel,
  replyClassLabel,
  formatDate,
} from "@/lib/utils";
import { ArrowLeft, Globe, Mail, Phone, Loader2 } from "lucide-react";

interface AuditDetails {
  score: number;
  hasWebsite: boolean;
  websiteUrl: string | null;
  https: boolean;
  responsive: boolean;
  loadTimeMs: number | null;
  outdatedDesign: boolean;
  issues: string[];
  opportunities: string[];
  summary: string;
}

interface ProspectDetail {
  id: string;
  name: string;
  activity: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  auditScore: number;
  auditDetails: string | null;
  status: string;
  replyClass: string | null;
  siren: string | null;
  siret: string | null;
  nafCode: string | null;
  directorName: string | null;
  legalName: string | null;
  enrichmentSource: string | null;
  googleMapsUrl: string | null;
  emails: {
    id: string;
    type: string;
    subject: string;
    status: string;
    sentAt: string | null;
    bodyHtml: string;
  }[];
  replies: {
    id: string;
    classification: string;
    aiSummary: string | null;
    bodyText: string;
    receivedAt: string;
  }[];
}

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const load = useCallback(() => {
    fetch(`/api/prospects/${id}`)
      .then((r) => r.json())
      .then(setProspect)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: string) {
    setActionLoading(action);
    try {
      await fetch(`/api/prospects/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      load();
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-stone-500">Chargement…</div>;
  }

  if (!prospect) {
    return <div className="p-8 text-sm text-red-600">Prospect introuvable</div>;
  }

  const audit: AuditDetails | null = prospect.auditDetails
    ? JSON.parse(prospect.auditDetails)
    : null;

  return (
    <>
      <PageHeader title={prospect.name} description={prospect.activity ?? undefined}>
        <Link
          href="/prospects"
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </PageHeader>

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-stone-500">
                Score pertinence
              </p>
              {prospect.auditScore > 0 && (
                <Badge className={scoreColor(prospect.auditScore)}>
                  {prospect.auditScore}/100
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-stone-600">
              {audit?.summary ?? "Audit non effectué"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => runAction("audit")}
                disabled={!!actionLoading}
              >
                {actionLoading === "audit" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Auditer le site"
                )}
              </Button>
              {prospect.email && (
                <Button
                  size="sm"
                  onClick={() => runAction("send-email")}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "send-email" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Envoyer email"
                  )}
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-900">Coordonnées</h3>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              {prospect.address && <li>{prospect.address}</li>}
              {prospect.city && <li>{prospect.city}</li>}
              {prospect.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {prospect.phone}
                </li>
              )}
              {prospect.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {prospect.email}
                  {prospect.enrichmentSource?.includes("email-finder") && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                      trouvé sur le site
                    </span>
                  )}
                </li>
              ) : (
                <li className="text-xs text-stone-400">
                  Email non trouvé — lancez l&apos;audit pour chercher sur le site
                </li>
              )}
              {prospect.website && (
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <a
                    href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-900 underline"
                  >
                    {prospect.website}
                  </a>
                </li>
              )}
            </ul>
            {(prospect.siren || prospect.directorName) && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <p className="text-xs font-medium uppercase text-stone-500">
                  Données légales (SIRENE)
                </p>
                <ul className="mt-2 space-y-1 text-xs text-stone-600">
                  {prospect.legalName && (
                    <li>Raison sociale : {prospect.legalName}</li>
                  )}
                  {prospect.siren && <li>SIREN : {prospect.siren}</li>}
                  {prospect.siret && <li>SIRET : {prospect.siret}</li>}
                  {prospect.nafCode && <li>NAF : {prospect.nafCode}</li>}
                  {prospect.directorName && (
                    <li>Dirigeant : {prospect.directorName}</li>
                  )}
                  {prospect.enrichmentSource && (
                    <li>Source : {prospect.enrichmentSource}</li>
                  )}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <Badge className="border-stone-200 bg-stone-50 text-stone-600">
                {statusLabel(prospect.status)}
              </Badge>
              {prospect.replyClass && (
                <Badge className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                  {replyClassLabel(prospect.replyClass)}
                </Badge>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {audit && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-stone-900">
                Résultat de l&apos;audit
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CheckItem label="Site web" ok={audit.hasWebsite} />
                <CheckItem label="HTTPS" ok={audit.https} />
                <CheckItem label="Responsive" ok={audit.responsive} />
                <CheckItem
                  label="Design daté"
                  ok={!audit.outdatedDesign}
                  invert
                />
                {audit.loadTimeMs && (
                  <p className="text-xs text-stone-500 sm:col-span-2">
                    Temps de chargement : {(audit.loadTimeMs / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
              {audit.issues.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-stone-500">
                    Problèmes détectés
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-stone-700">
                    {audit.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              {audit.opportunities.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-stone-500">
                    Opportunités commerciales
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-stone-700">
                    {audit.opportunities.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-stone-900">Emails</h3>
            </div>
            {prospect.emails.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">Aucun email envoyé</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {prospect.emails.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-stone-900">
                        {e.subject}
                      </p>
                      <Badge className="border-stone-200 bg-stone-50 text-stone-600">
                        {e.type.replace("FOLLOWUP_", "Relance J")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {e.status} · {formatDate(e.sentAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {prospect.replies.length > 0 && (
            <Card>
              <div className="border-b border-stone-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-stone-900">
                  Réponses reçues
                </h3>
              </div>
              <ul className="divide-y divide-stone-100">
                {prospect.replies.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          r.classification === "HOT"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }
                      >
                        {replyClassLabel(r.classification)}
                      </Badge>
                      <span className="text-xs text-stone-400">
                        {formatDate(r.receivedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">{r.aiSummary}</p>
                    <p className="mt-2 text-xs text-stone-500 line-clamp-3">
                      {r.bodyText}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function CheckItem({
  label,
  ok,
  invert,
}: {
  label: string;
  ok: boolean;
  invert?: boolean;
}) {
  const good = invert ? !ok : ok;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${good ? "bg-emerald-500" : "bg-red-400"}`}
      />
      <span className="text-stone-700">{label}</span>
    </div>
  );
}
