const CURSOR_API_BASE = "https://api.cursor.com/v1";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function getApiKey(): string {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY manquant — ajoutez-le dans Railway");
  }
  return apiKey;
}

export function normalizeGithubRepoUrl(raw: string): string {
  let url = raw.trim();
  if (!url) {
    throw new Error("URL du repo GitHub vide");
  }

  if (url.startsWith("git@github.com:")) {
    url = `https://github.com/${url.slice("git@github.com:".length)}`;
  }

  url = url.replace(/\.git$/, "");

  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") {
    throw new Error(
      `Repo GitHub invalide : « ${raw} ». Format attendu : https://github.com/utilisateur/repo`
    );
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Repo GitHub invalide : « ${raw} ». Format attendu : https://github.com/utilisateur/repo`
    );
  }

  return `https://github.com/${parts[0]}/${parts[1]}`;
}

function parseCursorError(data: unknown, status: number): string {
  if (typeof data !== "object" || data === null) {
    return `Erreur Cursor API (${status})`;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.message === "string" && obj.message.trim()) {
    return obj.message;
  }

  if (typeof obj.error === "string" && obj.error.trim()) {
    return obj.error;
  }

  if (typeof obj.detail === "string" && obj.detail.trim()) {
    return obj.detail;
  }

  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    return obj.errors
      .map((entry) =>
        typeof entry === "string" ? entry : JSON.stringify(entry)
      )
      .join(" · ");
  }

  const compact = JSON.stringify(data);
  if (compact && compact !== "{}") {
    return `Erreur Cursor API (${status}) : ${compact.slice(0, 400)}`;
  }

  return `Erreur Cursor API (${status})`;
}

export interface CursorCreateAgentInput {
  prompt: string;
  name?: string;
  repoUrl: string;
  repoRef?: string;
  autoCreatePR?: boolean;
}

export interface CursorAgentResponse {
  agent: {
    id: string;
    name?: string;
    url?: string;
    latestRunId?: string;
  };
  run?: {
    id: string;
    status: string;
  };
}

export interface CursorRunResponse {
  id: string;
  status: string;
  git?: {
    branches?: { branch?: string; prUrl?: string; repoUrl?: string }[];
  };
}

async function cursorFetch(path: string, init?: RequestInit) {
  const apiKey = getApiKey();
  return fetch(`${CURSOR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(apiKey),
      ...(init?.headers ?? {}),
    },
  });
}

export async function listCursorRepositories(): Promise<string[]> {
  const res = await cursorFetch("/repositories", {
    signal: AbortSignal.timeout(45_000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseCursorError(data, res.status));
  }

  const items = (data as { items?: { url?: string }[] }).items ?? [];
  return items
    .map((item) => item.url)
    .filter((url): url is string => Boolean(url))
    .map((url) => normalizeGithubRepoUrl(url));
}

export async function verifyRepoAccessible(repoUrl: string): Promise<{
  ok: boolean;
  normalizedUrl: string;
  error?: string;
}> {
  const normalizedUrl = normalizeGithubRepoUrl(repoUrl);

  try {
    const repos = await listCursorRepositories();
    const found = repos.some(
      (url) => url.toLowerCase() === normalizedUrl.toLowerCase()
    );

    if (!found) {
      return {
        ok: false,
        normalizedUrl,
        error:
          `Le repo ${normalizedUrl} n'est pas accessible par Cursor. ` +
          "Connectez GitHub sur cursor.com/dashboard → Integrations, installez l'app Cursor sur ce dépôt, puis réessayez.",
      };
    }

    return { ok: true, normalizedUrl };
  } catch (err) {
    return {
      ok: false,
      normalizedUrl,
      error:
        err instanceof Error
          ? err.message
          : "Impossible de vérifier l'accès GitHub Cursor",
    };
  }
}

export async function createCursorAgent(
  input: CursorCreateAgentInput
): Promise<CursorAgentResponse> {
  const repoUrl = normalizeGithubRepoUrl(input.repoUrl);
  const repoRef = input.repoRef?.trim() || "main";
  const modelId = process.env.CURSOR_AGENT_MODEL?.trim();

  const body: Record<string, unknown> = {
    name: input.name?.slice(0, 100),
    prompt: { text: input.prompt },
    repos: [
      {
        url: repoUrl,
        startingRef: repoRef,
      },
    ],
    autoCreatePR: input.autoCreatePR ?? true,
    skipReviewerRequest: true,
    mode: "agent",
  };

  if (modelId) {
    body.model = { id: modelId };
  }

  const res = await cursorFetch("/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = parseCursorError(data, res.status);
    console.error("Cursor create agent failed:", res.status, data);

    if (res.status === 400) {
      throw new Error(
        `${message} — Vérifiez : repo GitHub autorisé dans Cursor, branche « ${repoRef} » existante, clé API valide (cursor.com/settings).`
      );
    }

    throw new Error(message);
  }

  return data as CursorAgentResponse;
}

export async function getCursorRun(runId: string): Promise<CursorRunResponse> {
  const res = await cursorFetch(`/runs/${runId}`);

  if (!res.ok) {
    throw new Error(`Impossible de lire le run Cursor (${res.status})`);
  }

  return res.json() as Promise<CursorRunResponse>;
}

export async function getCursorAgent(agentId: string) {
  const res = await cursorFetch(`/agents/${agentId}`);

  if (!res.ok) {
    throw new Error(`Impossible de lire l'agent Cursor (${res.status})`);
  }

  return res.json() as Promise<{
    id: string;
    url?: string;
    latestRunId?: string;
  }>;
}
