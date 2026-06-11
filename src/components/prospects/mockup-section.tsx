"use client";

import { Badge, Button } from "@/components/ui";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";

export interface MockupJobSummary {
  id: string;
  status: string;
  triggeredBy: string;
  cursorAgentUrl: string | null;
  prUrl: string | null;
  branchName: string | null;
  error: string | null;
  createdAt: string;
}

interface MockupSectionProps {
  job: MockupJobSummary | null | undefined;
  prospectStatus: string;
  onLaunch: () => void;
  onSync: () => void;
  loading?: string;
  compact?: boolean;
}

function mockupStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "RUNNING":
      return "En cours";
    case "COMPLETED":
      return "Terminée";
    case "FAILED":
      return "Échec";
    default:
      return status;
  }
}

function mockupStatusClass(status: string) {
  switch (status) {
    case "RUNNING":
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

export function MockupSection({
  job,
  prospectStatus,
  onLaunch,
  onSync,
  loading,
  compact,
}: MockupSectionProps) {
  const canLaunch =
    ["HOT", "WARM", "REPLIED"].includes(prospectStatus) &&
    (!job || !["PENDING", "RUNNING"].includes(job.status));

  return (
    <div className={compact ? "" : "mt-4 border-t border-stone-100 pt-4"}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-stone-900">
            Maquette Cursor
          </h3>
        </div>
      )}

      {job ? (
        <div className={`${compact ? "" : "mt-3"} space-y-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={mockupStatusClass(job.status)}>
              {mockupStatusLabel(job.status)}
            </Badge>
            {job.triggeredBy === "AUTO" && (
              <span className="text-[10px] text-stone-500">auto</span>
            )}
          </div>

          {job.branchName && (
            <p className="text-xs text-stone-600">
              Branche : <code>{job.branchName}</code>
            </p>
          )}

          {job.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {job.error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {job.cursorAgentUrl && (
              <a
                href={job.cursorAgentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-700 underline"
              >
                Agent Cursor
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {job.prUrl && (
              <a
                href={job.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-700 underline"
              >
                Pull Request
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {["PENDING", "RUNNING"].includes(job.status) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onSync}
              disabled={loading === "sync-mockup"}
            >
              {loading === "sync-mockup" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Actualiser le statut"
              )}
            </Button>
          )}
        </div>
      ) : (
        <p className={`${compact ? "mt-2" : "mt-3"} text-xs text-stone-500`}>
          Aucune maquette lancée pour ce prospect.
        </p>
      )}

      {canLaunch && (
        <Button
          size="sm"
          variant="secondary"
          className={job ? "mt-2" : compact ? "mt-2" : "mt-3"}
          onClick={onLaunch}
          disabled={loading === "launch-mockup"}
        >
          {loading === "launch-mockup" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              Lancer maquette Cursor
            </>
          )}
        </Button>
      )}
    </div>
  );
}
