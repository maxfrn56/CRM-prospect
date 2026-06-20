"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { emailTypeLabel, formatDate, replyClassLabel } from "@/lib/utils";

export interface ProspectEmailItem {
  id: string;
  type: string;
  subject: string;
  status: string;
  sentAt: string | null;
  bodyHtml: string;
  bodyText?: string | null;
}

function emailStatusClass(status: string) {
  switch (status) {
    case "SENT":
    case "DELIVERED":
    case "OPENED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "REPLIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "DRAFT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "FAILED":
    case "BOUNCED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

export function ProspectEmailList({ emails }: { emails: ProspectEmailItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    emails.find((e) => e.status !== "DRAFT")?.id ?? emails[0]?.id ?? null
  );

  if (emails.length === 0) {
    return (
      <p className="p-5 text-sm text-stone-500">
        Aucun email envoyé via l&apos;app
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-100">
      {emails.map((email) => {
        const open = expandedId === email.id;
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => setExpandedId(open ? null : email.id)}
              className="flex w-full items-start gap-2 px-5 py-4 text-left transition-colors hover:bg-stone-50"
              aria-expanded={open}
            >
              <span className="mt-0.5 shrink-0 text-stone-400">
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={emailStatusClass(email.status)}>
                    {emailTypeLabel(email.type)}
                  </Badge>
                  <span className="text-xs uppercase text-stone-400">
                    {email.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-stone-900">
                  {email.subject}
                </p>
                {email.sentAt && (
                  <p className="mt-0.5 text-xs text-stone-500">
                    Envoyé le {formatDate(email.sentAt)}
                  </p>
                )}
              </div>
            </button>
            {open && (
              <div className="border-t border-stone-100 bg-stone-50/80 px-5 py-4">
                {email.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none rounded-md border border-stone-200 bg-white p-4 text-stone-800 [&_a]:text-blue-700 [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
                    {email.bodyText ?? "Contenu indisponible"}
                  </pre>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ProspectReplyItem {
  id: string;
  classification: string;
  aiSummary: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  receivedAt: string;
  subject?: string | null;
}

export function ProspectReplyList({ replies }: { replies: ProspectReplyItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    replies[0]?.id ?? null
  );

  if (replies.length === 0) return null;

  return (
    <ul className="divide-y divide-stone-100">
      {replies.map((reply) => {
        const open = expandedId === reply.id;
        return (
          <li key={reply.id}>
            <button
              type="button"
              onClick={() => setExpandedId(open ? null : reply.id)}
              className="flex w-full items-start gap-2 px-5 py-4 text-left transition-colors hover:bg-stone-50"
              aria-expanded={open}
            >
              <span className="mt-0.5 shrink-0 text-stone-400">
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <Badge
                  className={
                    reply.classification === "HOT"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : reply.classification === "COLD"
                        ? "border-stone-200 bg-stone-100 text-stone-600"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  {replyClassLabel(reply.classification)}
                </Badge>
                {reply.aiSummary && (
                  <p className="mt-2 text-sm text-stone-700">{reply.aiSummary}</p>
                )}
                <p className="mt-1 text-xs text-stone-500">
                  {formatDate(reply.receivedAt)}
                </p>
              </div>
            </button>
            {open && (
              <div className="border-t border-stone-100 bg-stone-50/80 px-5 py-4">
                {reply.subject && (
                  <p className="mb-2 text-xs font-medium text-stone-600">
                    {reply.subject}
                  </p>
                )}
                {reply.bodyHtml ? (
                  <div
                    className="prose prose-sm max-w-none rounded-md border border-stone-200 bg-white p-4 text-stone-800"
                    dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-4 text-sm text-stone-700">
                    {reply.bodyText}
                  </pre>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
