"use client";

import { useEffect, useState } from "react";
import { Button, Card, Badge } from "@/components/ui";
import { Loader2, Send, RefreshCw, Save, Eye, EyeOff } from "lucide-react";
import { htmlToPlainText, plainTextToHtml } from "@/lib/email/plain-text";
import type { ProspectEmailItem } from "@/components/prospects/email-message-list";

interface EmailComposerProps {
  prospectId: string;
  recipientEmail: string;
  draft: ProspectEmailItem | null;
  hasInitialSent: boolean;
  onUpdated: () => void;
}

export function EmailComposer({
  prospectId,
  recipientEmail,
  draft,
  hasInitialSent,
  onUpdated,
}: EmailComposerProps) {
  const [emailId, setEmailId] = useState<string | null>(draft?.id ?? null);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [bodyText, setBodyText] = useState(
    draft?.bodyText ?? (draft?.bodyHtml ? htmlToPlainText(draft.bodyHtml) : "")
  );
  const [previewHtml, setPreviewHtml] = useState(draft?.bodyHtml ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (draft) {
      setEmailId(draft.id);
      setSubject(draft.subject);
      setBodyText(
        draft.bodyText ?? (draft.bodyHtml ? htmlToPlainText(draft.bodyHtml) : "")
      );
      setPreviewHtml(draft.bodyHtml);
      setDirty(false);
    }
  }, [draft]);

  async function apiAction(
    action: string,
    extra?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`/api/prospects/${prospectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : "Opération échouée"
      );
    }
    return data;
  }

  async function handleGenerate(regenerate = false) {
    setLoading(regenerate ? "regenerate" : "generate");
    setError("");
    setSuccess("");
    try {
      const data = await apiAction(
        regenerate ? "regenerate-email" : "generate-email"
      );
      const email = data.email as ProspectEmailItem;
      setEmailId(email.id);
      setSubject(email.subject);
      setBodyText(
        email.bodyText ??
          (email.bodyHtml ? htmlToPlainText(email.bodyHtml) : "")
      );
      setPreviewHtml(email.bodyHtml);
      setDirty(false);
      setSuccess(regenerate ? "Email regénéré" : "Email généré");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading("");
    }
  }

  async function handleSave() {
    if (!emailId) return;
    setLoading("save");
    setError("");
    setSuccess("");
    try {
      const data = await apiAction("save-email-draft", {
        emailId,
        subject,
        bodyText,
      });
      const email = data.email as ProspectEmailItem;
      setPreviewHtml(email.bodyHtml);
      setDirty(false);
      setSuccess("Brouillon enregistré");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading("");
    }
  }

  async function handleSend() {
    if (!emailId) return;
    setLoading("send");
    setError("");
    setSuccess("");
    try {
      if (dirty) {
        await apiAction("save-email-draft", { emailId, subject, bodyText });
      }
      await apiAction("send-email", { emailId });
      setSuccess("Email envoyé");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading("");
    }
  }

  if (hasInitialSent) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Email à envoyer
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Destinataire : {recipientEmail}
            </p>
          </div>
          {emailId && (
            <Badge className="border-amber-200 bg-amber-50 text-amber-700">
              Brouillon
            </Badge>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {!emailId ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/50 p-6 text-center">
            <p className="text-sm text-stone-600">
              Générez un email personnalisé par l&apos;IA, puis modifiez-le avant
              l&apos;envoi.
            </p>
            <Button
              className="mt-4"
              onClick={() => handleGenerate(false)}
              disabled={!!loading}
            >
              {loading === "generate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Générer l&apos;email
            </Button>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">
                Objet
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDirty(true);
                }}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-stone-600">
                  Message
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Masquer l&apos;aperçu
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Aperçu
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  setDirty(true);
                }}
                rows={14}
                className="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm leading-relaxed"
              />
              {showPreview && (
                <div
                  className="mt-3 prose prose-sm max-w-none rounded-md border border-stone-200 bg-white p-4 text-stone-800 [&_a]:text-blue-700 [&_p]:my-2"
                  dangerouslySetInnerHTML={{
                    __html: dirty
                      ? plainTextToHtml(bodyText)
                      : previewHtml || "<p></p>",
                  }}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleGenerate(true)}
                disabled={!!loading}
              >
                {loading === "regenerate" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Regénérer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSave}
                disabled={!!loading || !dirty}
              >
                {loading === "save" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Enregistrer
              </Button>
              <Button size="sm" onClick={handleSend} disabled={!!loading}>
                {loading === "send" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Envoyer
              </Button>
            </div>
          </>
        )}

        {success && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {success}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
