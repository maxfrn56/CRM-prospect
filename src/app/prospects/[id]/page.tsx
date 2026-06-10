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
  contactChannelLabel,
  PROSPECT_STATUSES,
  CONTACT_CHANNELS,
  statusBadgeClass,
} from "@/lib/utils";
import { ArrowLeft, Globe, Mail, Phone, Loader2, CheckCircle2, Instagram } from "lucide-react";

interface AuditDetails {
  score: number;
  hasWebsite: boolean;
  websiteUrl: string | null;
  https: boolean;
  responsive: boolean;
  loadTimeMs: number | null;
  outdatedDesign: boolean;
  instagramUrl?: string | null;
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
  contactChannel: string | null;
  contactNotes: string | null;
  contactedAt: string | null;
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
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmSaved, setCrmSaved] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [crmForm, setCrmForm] = useState({
    status: "NEW",
    contactChannel: "",
    contactNotes: "",
  });

  const load = useCallback(() => {
    fetch(`/api/prospects/${id}`)
      .then((r) => r.json())
      .then((data: ProspectDetail) => {
        setProspect(data);
        setEmailInput(data.email ?? "");
        setEmailError("");
        setCrmForm({
          status: data.status,
          contactChannel: data.contactChannel ?? "",
          contactNotes: data.contactNotes ?? "",
        });
      })
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

  async function saveCrm(e?: React.FormEvent) {
    e?.preventDefault();
    setCrmSaving(true);
    setCrmSaved(false);
    try {
      await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: crmForm.status,
          contactChannel: crmForm.contactChannel || null,
          contactNotes: crmForm.contactNotes || null,
        }),
      });
      load();
      setCrmSaved(true);
      setTimeout(() => setCrmSaved(false), 2000);
    } finally {
      setCrmSaving(false);
    }
  }

  async function saveEmail(e?: React.FormEvent) {
    e?.preventDefault();
    setEmailSaving(true);
    setEmailSaved(false);
    setEmailError("");
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error ?? "Impossible d'enregistrer l'email");
        return;
      }
      load();
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } finally {
      setEmailSaving(false);
    }
  }

  async function quickContact(channel: string) {
    setCrmSaving(true);
    try {
      await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CONTACTED",
          contactChannel: channel,
          contactNotes: crmForm.contactNotes || null,
        }),
      });
      load();
    } finally {
      setCrmSaving(false);
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
            <h3 className="text-sm font-semibold text-stone-900">
              Suivi manuel
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Contacté par Instagram, téléphone ou autre canal hors email
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => quickContact("INSTAGRAM")}
                disabled={crmSaving}
                className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50"
              >
                ✓ Contacté Instagram
              </button>
              <button
                type="button"
                onClick={() => quickContact("PHONE")}
                disabled={crmSaving}
                className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50"
              >
                ✓ Contacté téléphone
              </button>
            </div>

            <form onSubmit={saveCrm} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  Statut
                </label>
                <select
                  value={crmForm.status}
                  onChange={(e) =>
                    setCrmForm({ ...crmForm, status: e.target.value })
                  }
                  className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
                >
                  {PROSPECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  Canal de contact
                </label>
                <select
                  value={crmForm.contactChannel}
                  onChange={(e) =>
                    setCrmForm({ ...crmForm, contactChannel: e.target.value })
                  }
                  className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">— Non précisé —</option>
                  {CONTACT_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {contactChannelLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  Notes
                </label>
                <textarea
                  value={crmForm.contactNotes}
                  onChange={(e) =>
                    setCrmForm({ ...crmForm, contactNotes: e.target.value })
                  }
                  rows={3}
                  placeholder="Ex: DM Instagram envoyé, site down confirmé…"
                  className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
                />
              </div>
              {prospect.contactedAt && (
                <p className="text-xs text-stone-500">
                  Contacté le {formatDate(prospect.contactedAt)}
                  {prospect.contactChannel &&
                    ` via ${contactChannelLabel(prospect.contactChannel)}`}
                </p>
              )}
              <Button type="submit" size="sm" disabled={crmSaving} className="w-full">
                {crmSaved ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Enregistré
                  </>
                ) : crmSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Enregistrer le suivi"
                )}
              </Button>
            </form>
          </Card>

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
            <div className="mt-3">
              <Badge className={statusBadgeClass(prospect.status)}>
                {statusLabel(prospect.status)}
              </Badge>
              {prospect.contactChannel && (
                <Badge className="ml-2 border-blue-200 bg-blue-50 text-blue-700">
                  {contactChannelLabel(prospect.contactChannel)}
                </Badge>
              )}
            </div>
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
              {prospect.website && (
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <a
                    href={
                      prospect.website.startsWith("http")
                        ? prospect.website
                        : `https://${prospect.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-900 underline"
                  >
                    {prospect.website}
                  </a>
                </li>
              )}
            </ul>

            <form onSubmit={saveEmail} className="mt-4 border-t border-stone-100 pt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-stone-600">
                <Mail className="h-3.5 w-3.5" />
                Email
                {prospect.enrichmentSource?.includes("email-finder") && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-normal text-emerald-700">
                    trouvé sur le site
                  </span>
                )}
                {prospect.enrichmentSource?.includes("manual") && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-normal text-blue-700">
                    saisi manuellement
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="contact@entreprise.fr"
                  className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
                />
                <Button type="submit" size="sm" disabled={emailSaving}>
                  {emailSaved ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : emailSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs text-red-600">{emailError}</p>
              )}
              {!prospect.email && (
                <p className="mt-1.5 text-xs text-stone-500">
                  Ajoutez un email pour lancer l&apos;envoi et les relances
                  automatiques.
                </p>
              )}
            </form>

            {prospect.contactNotes && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <p className="text-xs font-medium uppercase text-stone-500">
                  Notes CRM
                </p>
                <p className="mt-1 text-sm text-stone-700 whitespace-pre-wrap">
                  {prospect.contactNotes}
                </p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {audit && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-stone-900">
                  Résultat de l&apos;audit
                </h3>
                {audit.instagramUrl && (
                  <a
                    href={audit.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Voir le profil Instagram"
                    className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </a>
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CheckItem label="Site web" ok={audit.hasWebsite} />
                <CheckItem label="HTTPS" ok={audit.https} />
                <CheckItem label="Responsive" ok={audit.responsive} />
                <CheckItem
                  label="Design daté"
                  ok={!audit.outdatedDesign}
                  invert
                />
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
            </Card>
          )}

          <Card>
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-stone-900">Emails</h3>
            </div>
            {prospect.emails.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">
                Aucun email envoyé via l&apos;app
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {prospect.emails.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <p className="text-sm font-medium text-stone-900">
                      {e.subject}
                    </p>
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
                    <Badge
                      className={
                        r.classification === "HOT"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-stone-200 bg-stone-50 text-stone-600"
                      }
                    >
                      {replyClassLabel(r.classification)}
                    </Badge>
                    <p className="mt-2 text-sm text-stone-700">{r.aiSummary}</p>
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
