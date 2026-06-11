const CURSOR_API_BASE = "https://api.cursor.com/v1";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
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

export async function createCursorAgent(
  input: CursorCreateAgentInput
): Promise<CursorAgentResponse> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY manquant — ajoutez-le dans Railway");
  }

  const res = await fetch(`${CURSOR_API_BASE}/agents`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name?.slice(0, 100),
      prompt: { text: input.prompt },
      repos: [
        {
          url: input.repoUrl,
          startingRef: input.repoRef ?? "main",
        },
      ],
      autoCreatePR: input.autoCreatePR ?? true,
      skipReviewerRequest: true,
      mode: "agent",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Erreur Cursor API (${res.status})`;
    throw new Error(message);
  }

  return data as CursorAgentResponse;
}

export async function getCursorRun(runId: string): Promise<CursorRunResponse> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY manquant");

  const res = await fetch(`${CURSOR_API_BASE}/runs/${runId}`, {
    headers: { Authorization: authHeader(apiKey) },
  });

  if (!res.ok) {
    throw new Error(`Impossible de lire le run Cursor (${res.status})`);
  }

  return res.json() as Promise<CursorRunResponse>;
}

export async function getCursorAgent(agentId: string) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY manquant");

  const res = await fetch(`${CURSOR_API_BASE}/agents/${agentId}`, {
    headers: { Authorization: authHeader(apiKey) },
  });

  if (!res.ok) {
    throw new Error(`Impossible de lire l'agent Cursor (${res.status})`);
  }

  return res.json() as Promise<{
    id: string;
    url?: string;
    latestRunId?: string;
  }>;
}
