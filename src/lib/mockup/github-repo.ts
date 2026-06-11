import { normalizeGithubRepoUrl } from "./cursor-client";

function parseGithubOwnerRepo(repoUrl: string): { owner: string; repo: string } {
  const normalized = normalizeGithubRepoUrl(repoUrl);
  const parts = new URL(normalized).pathname.split("/").filter(Boolean);
  return { owner: parts[0], repo: parts[1] };
}

async function githubFetch(path: string) {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "CRM-Prospect-Mockup",
    },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function getGithubDefaultBranch(
  repoUrl: string
): Promise<string | null> {
  const { owner, repo } = parseGithubOwnerRepo(repoUrl);
  const res = await githubFetch(`/repos/${owner}/${repo}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? null;
}

export async function githubBranchExists(
  repoUrl: string,
  branch: string
): Promise<boolean> {
  const { owner, repo } = parseGithubOwnerRepo(repoUrl);
  const res = await githubFetch(
    `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`
  );
  return res.ok;
}

export async function listGithubBranches(repoUrl: string): Promise<string[]> {
  const { owner, repo } = parseGithubOwnerRepo(repoUrl);
  const res = await githubFetch(
    `/repos/${owner}/${repo}/branches?per_page=10`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { name: string }[];
  return data.map((branch) => branch.name);
}

export async function resolveGithubRepoRef(
  repoUrl: string,
  configuredRef?: string | null
): Promise<{ ref: string; autoDetected: boolean }> {
  const normalized = normalizeGithubRepoUrl(repoUrl);
  const preferred = configuredRef?.trim() || "";

  if (preferred && (await githubBranchExists(normalized, preferred))) {
    return { ref: preferred, autoDetected: false };
  }

  const defaultBranch = await getGithubDefaultBranch(normalized);
  if (
    defaultBranch &&
    (await githubBranchExists(normalized, defaultBranch))
  ) {
    return {
      ref: defaultBranch,
      autoDetected: !preferred || preferred !== defaultBranch,
    };
  }

  for (const fallback of ["main", "master"]) {
    if (await githubBranchExists(normalized, fallback)) {
      return { ref: fallback, autoDetected: true };
    }
  }

  const branches = await listGithubBranches(normalized);
  if (branches.length > 0) {
    return { ref: branches[0], autoDetected: true };
  }

  throw new Error(
    `Le repo ${normalized} est vide (aucune branche). ` +
      "Sur GitHub, ajoutez un README ou un premier commit, puis relancez la maquette."
  );
}
