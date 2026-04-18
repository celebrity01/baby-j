// Jules API Client - All API calls proxied through Next.js routes

const JULES_BASE = "/api/jules";
const GITHUB_BASE = "/api/github";
const GITHUB_PAGES_BASE = "/api/github-pages";
const VERCEL_BASE = "/api/vercel";
const NETLIFY_BASE = "/api/netlify";
const RENDER_BASE = "/api/render";

// ===== Types =====

export interface JulesSource {
  name?: string;
  repository?: {
    name?: string;
    owner?: string;
    defaultBranch?: string;
    uri?: string;
  };
  id?: string;
}

export interface JulesSession {
  name?: string;
  sessionId?: string;
  prompt?: string;
  state?: string;
  createdTime?: string;
  completedTime?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  sourceContext?: {
    sourceName?: string;
    branch?: string;
  };
  executionMode?: string;
  metadata?: Record<string, unknown>;
}

export interface JulesActivity {
  type: string;
  agentMessage?: string;
  userMessage?: string;
  plan?: {
    title?: string;
    steps?: { description: string; files?: string[] }[];
  };
  progressMessage?: string;
  progressPercent?: number;
  errorMessage?: string;
  bashCommand?: string;
  bashOutput?: string;
  codeChanges?: {
    patches?: { filename: string; patch: string }[];
  };
  timestamp?: string;
}

export interface GitHubUser {
  login: string;
  name?: string;
  avatar_url?: string;
  id?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  default?: boolean;
  commit?: {
    sha?: string;
  };
}

// ===== Sanitize Header Value =====

// sanitizeHeaderValue is in api-utils.ts for server-side use

// ===== Jules API Calls =====

export async function listSources(apiKey: string): Promise<JulesSource[]> {
  const res = await fetch(`${JULES_BASE}/sources`, {
    headers: {
      "X-Jules-Api-Key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Failed to list sources: ${res.status}`);
  const data = await res.json();
  return data.sources || [];
}

export async function listSessions(apiKey: string): Promise<JulesSession[]> {
  const res = await fetch(`${JULES_BASE}/sessions`, {
    headers: {
      "X-Jules-Api-Key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
  const data = await res.json();
  return data.sessions || [];
}

export async function createSession(
  apiKey: string,
  params: {
    prompt: string;
    sourceContext?: { sourceName: string; branch?: string };
    executionMode?: string;
    sessionTitle?: string;
  }
): Promise<JulesSession> {
  const res = await fetch(`${JULES_BASE}/sessions`, {
    method: "POST",
    headers: {
      "X-Jules-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSession(apiKey: string, sessionId: string): Promise<JulesSession> {
  const res = await fetch(`${JULES_BASE}/sessions/${sessionId}`, {
    headers: {
      "X-Jules-Api-Key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
  return res.json();
}

export async function getActivities(apiKey: string, sessionId: string): Promise<JulesActivity[]> {
  const res = await fetch(`${JULES_BASE}/sessions/${sessionId}/activities`, {
    headers: {
      "X-Jules-Api-Key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Failed to get activities: ${res.status}`);
  const data = await res.json();
  return data.activities || [];
}

export async function approvePlan(apiKey: string, sessionId: string): Promise<void> {
  const res = await fetch(`${JULES_BASE}/sessions/${sessionId}/approve`, {
    method: "POST",
    headers: {
      "X-Jules-Api-Key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Failed to approve plan: ${res.status}`);
}

export async function sendMessage(apiKey: string, sessionId: string, message: string): Promise<void> {
  const res = await fetch(`${JULES_BASE}/sessions/${sessionId}/message`, {
    method: "POST",
    headers: {
      "X-Jules-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
}

// ===== GitHub API Calls =====

export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_BASE}/user`, {
    headers: { "X-GitHub-Token": token },
  });
  if (!res.ok) throw new Error(`GitHub auth failed: ${res.status}`);
  return res.json();
}

export async function listGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_BASE}/repos`, {
    headers: { "X-GitHub-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to list repos: ${res.status}`);
  return res.json();
}

export async function createGitHubRepo(
  token: string,
  params: { name: string; description?: string; private?: boolean; autoInit?: boolean }
): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_BASE}/create-repo`, {
    method: "POST",
    headers: {
      "X-GitHub-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create repo: ${res.status}`);
  return res.json();
}

export async function getRepoDetails(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_BASE}/repos/${owner}/${repo}`, {
    headers: { "X-GitHub-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to get repo: ${res.status}`);
  return res.json();
}

export async function listBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  const res = await fetch(`${GITHUB_BASE}/repos/${owner}/${repo}/branches`, {
    headers: { "X-GitHub-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to list branches: ${res.status}`);
  return res.json();
}

// ===== GitHub Pages Calls =====

export async function listPagesSites(token: string): Promise<unknown[]> {
  const res = await fetch(`${GITHUB_PAGES_BASE}/sites`, {
    headers: { "X-GitHub-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to list Pages sites: ${res.status}`);
  return res.json();
}

export async function deployPages(
  token: string,
  params: { owner: string; repo: string; branch?: string }
): Promise<unknown> {
  const res = await fetch(`${GITHUB_PAGES_BASE}/deploy`, {
    method: "POST",
    headers: {
      "X-GitHub-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to deploy Pages: ${res.status}`);
  return res.json();
}

// ===== Vercel Calls =====

export async function listVercelProjects(token: string): Promise<unknown[]> {
  const res = await fetch(`${VERCEL_BASE}/projects`, {
    headers: { "X-Vercel-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to list Vercel projects: ${res.status}`);
  return res.json();
}

export async function createVercelProject(
  token: string,
  params: { name: string; repoOwner?: string; repoName?: string; branch?: string }
): Promise<unknown> {
  const res = await fetch(`${VERCEL_BASE}/projects/create`, {
    method: "POST",
    headers: {
      "X-Vercel-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create Vercel project: ${res.status}`);
  return res.json();
}

export async function deployVercel(token: string, params: { projectId: string }): Promise<unknown> {
  const res = await fetch(`${VERCEL_BASE}/deploy`, {
    method: "POST",
    headers: {
      "X-Vercel-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to deploy Vercel: ${res.status}`);
  return res.json();
}

// ===== Netlify Calls =====

export async function listNetlifySites(token: string): Promise<unknown[]> {
  const res = await fetch(`${NETLIFY_BASE}/sites`, {
    headers: { "X-Netlify-Token": token },
  });
  if (!res.ok) throw new Error(`Failed to list Netlify sites: ${res.status}`);
  return res.json();
}

export async function createNetlifySite(
  token: string,
  params: { name: string; repoUrl?: string; branch?: string },
  githubToken?: string | null
): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Netlify-Token": token,
    "Content-Type": "application/json",
  };
  // Cross-system: forward GitHub token so the API route can resolve repo metadata
  if (githubToken) {
    headers["X-GitHub-Token"] = githubToken;
  }
  const res = await fetch(`${NETLIFY_BASE}/sites/create`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Failed to create Netlify site (${res.status})`);
  }
  return res.json();
}

export async function deployNetlify(token: string, params: { siteId: string }): Promise<unknown> {
  const res = await fetch(`${NETLIFY_BASE}/deploy`, {
    method: "POST",
    headers: {
      "X-Netlify-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to deploy Netlify: ${res.status}`);
  return res.json();
}

// ===== Render Calls =====

export async function listRenderServices(token: string): Promise<unknown[]> {
  const res = await fetch(`${RENDER_BASE}/services`, {
    headers: { "X-Render-Api-Key": token },
  });
  if (!res.ok) throw new Error(`Failed to list Render services: ${res.status}`);
  return res.json();
}

export async function createRenderService(
  token: string,
  params: { name: string; repoUrl?: string; branch?: string; runtime?: string }
): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Render-Api-Key": token,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${RENDER_BASE}/services`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Failed to create Render service (${res.status})`);
  }
  return res.json();
}

export async function deployRender(token: string, params: { serviceId: string }): Promise<unknown> {
  const res = await fetch(`${RENDER_BASE}/deploy`, {
    method: "POST",
    headers: {
      "X-Render-Api-Key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to deploy Render: ${res.status}`);
  return res.json();
}

// ===== Relative Time Helper =====

export function relativeTime(dateString?: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ===== Deploy Instructions Builder =====

export function buildDeployInstructions(platforms: {
  vercel: boolean;
  netlify: boolean;
  render: boolean;
  githubPages: boolean;
}): string {
  let instructions = "";

  if (platforms.vercel) {
    instructions += `

IMPORTANT: Also generate a \`vercel.json\` configuration file with the following structure:
\`\`\`json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
\`\`\`
Ensure the project is compatible with Vercel deployment.`;
  }

  if (platforms.netlify) {
    instructions += `

IMPORTANT: Also generate a \`netlify.toml\` configuration file with the following structure:
\`\`\`toml
[build]
  command = "npm run build"
  publish = "out"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
\`\`\`
Ensure the project is compatible with Netlify deployment.`;
  }

  if (platforms.render) {
    instructions += `

IMPORTANT: Also generate a \`render.yaml\` blueprint file with the following structure:
\`\`\`yaml
services:
  - type: web
    name: my-app
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
\`\`\`
Ensure the project is compatible with Render deployment.`;
  }

  if (platforms.githubPages) {
    instructions += `

IMPORTANT: Also generate a GitHub Actions workflow at \`.github/workflows/deploy.yml\` for GitHub Pages deployment:
\`\`\`yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./out
      - uses: actions/deploy-pages@v4
\`\`\`
Ensure the project builds to a static output compatible with GitHub Pages.`;
  }

  return instructions;
}
