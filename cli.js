#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Baby J CLI — Command Line Interface for Jules Super Agent
// ═══════════════════════════════════════════════════════════════
// Usage: node cli.js <command> [options]
//
// Commands:
//   auth          Configure API tokens
//   sessions      List Jules sessions
//   create        Create a new mission
//   repos         List GitHub repos
//   deploy        Deploy a repo to a hosting provider
//   status        Check deployment status
//   whoami        Show connected identities
//   help          Show this help
// ═══════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── ANSI Colors ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgCyan: "\x1b[46m",
  bgBlack: "\x1b[40m",
};

// ── Config ──
const CONFIG_DIR = path.join(os.homedir(), ".baby-j");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function maskToken(token) {
  if (!token || token.length < 8) return "****";
  return token.slice(0, 6) + "..." + token.slice(-4);
}

// ── Helpers ──
function log(msg, color = C.white) {
  console.log(`${color}${msg}${C.reset}`);
}

function logBold(msg, color = C.cyan) {
  log(`${C.bold}${msg}${C.reset}`, color);
}

function logError(msg) {
  log(`${C.red}✗ ${msg}`, C.red);
}

function logSuccess(msg) {
  log(`${C.green}✓ ${msg}`, C.green);
}

function logWarn(msg) {
  log(`${C.yellow}⚠ ${msg}`, C.yellow);
}

function logDim(msg) {
  log(msg, C.gray);
}

function logStep(step, text, done) {
  const icon = done ? `${C.green}✓${C.reset}` : `${C.gray}○${C.reset}`;
  const txt = done ? text : `${C.gray}${text}${C.reset}`;
  log(`  ${icon} Step ${step}: ${txt}`);
}

function relativeTime(dateString) {
  if (!dateString) return "unknown";
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
  return `${Math.floor(days / 30)}mo ago`;
}

function stateColor(state) {
  const colors = {
    RUNNING: C.cyan,
    COMPLETED: C.green,
    FAILED: C.red,
    AWAITING: C.yellow,
    CANCELLED: C.gray,
    STOPPED: C.gray,
  };
  return colors[state] || C.white;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
  if (!res.ok) {
    const message = data?.error?.message || data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// ═══════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════

// ── AUTH ──
function cmdAuth(args) {
  const config = loadConfig();
  const sub = args[0];

  if (sub === "set") {
    // Set a specific token: auth set <key> <value>
    const key = args[1];
    const value = args[2];
    if (!key || !value) {
      logError("Usage: node cli.js auth set <key> <value>");
      logDim("Keys: jules, github, vercel, netlify, render");
      process.exit(1);
    }
    config[key] = value;
    saveConfig(config);
    logSuccess(`${key} token saved (${maskToken(value)})`);
    return;
  }

  if (sub === "rm" || sub === "remove") {
    const key = args[1];
    if (!key || !config[key]) {
      logError(`No token found for "${key}"`);
      process.exit(1);
    }
    delete config[key];
    saveConfig(config);
    logSuccess(`${key} token removed`);
    return;
  }

  if (sub === "clear") {
    saveConfig({});
    logSuccess("All tokens cleared");
    return;
  }

  // Default: show current tokens
  logBold("\n  Baby J CLI — Auth Status\n");
  const tokens = [
    { key: "jules", label: "Jules API", url: "https://aistudio.google.com/apikey" },
    { key: "github", label: "GitHub", url: "https://github.com/settings/tokens" },
    { key: "vercel", label: "Vercel", url: "https://vercel.com/account/tokens" },
    { key: "netlify", label: "Netlify", url: "https://app.netlify.com/user/applications/personal" },
    { key: "render", label: "Render", url: "https://dashboard.render.com/account/api-keys" },
  ];

  for (const t of tokens) {
    const val = config[t.key];
    const status = val ? `${C.green}●${C.reset} ${maskToken(val)}` : `${C.red}○${C.reset} not set`;
    log(`  ${t.label.padEnd(12)} ${status}`);
  }

  log("");
  logDim("  Commands:");
  logDim("    node cli.js auth set <key> <token>   Set a token");
  logDim("    node cli.js auth rm <key>            Remove a token");
  logDim("    node cli.js auth clear               Clear all tokens");
  log("");
}

// ── WHOAMI ──
async function cmdWhoami() {
  const config = loadConfig();

  logBold("\n  Connected Identities\n");

  if (config.github) {
    try {
      const user = await api("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${config.github}` },
      });
      log(`  ${C.green}● GitHub${C.reset}    ${C.bold}${user.login}${C.reset}${user.name ? ` (${user.name})` : ""}`);
    } catch (e) {
      log(`  ${C.red}● GitHub${C.reset}    ${e.message}`);
    }
  } else {
    log(`  ${C.gray}○ GitHub${C.reset}    not connected`);
  }

  if (config.jules) {
    log(`  ${C.green}● Jules${C.reset}     API key configured (${maskToken(config.jules)})`);
  } else {
    log(`  ${C.gray}○ Jules${C.reset}     not connected`);
  }

  if (config.vercel) {
    try {
      const projects = await api("https://api.vercel.com/v9/projects?limit=1", {
        headers: { Authorization: `Bearer ${config.vercel}` },
      });
      log(`  ${C.green}● Vercel${C.reset}    ${projects.projects?.length || 0} project(s)`);
    } catch (e) {
      log(`  ${C.red}● Vercel${C.reset}    ${e.message}`);
    }
  } else {
    log(`  ${C.gray}○ Vercel${C.reset}    not connected`);
  }

  if (config.netlify) {
    try {
      const sites = await api("https://api.netlify.com/api/v1/sites?per_page=1", {
        headers: { Authorization: `Bearer ${config.netlify}` },
      });
      log(`  ${C.green}● Netlify${C.reset}   ${Array.isArray(sites) ? sites.length : 0} site(s)`);
    } catch (e) {
      log(`  ${C.red}● Netlify${C.reset}   ${e.message}`);
    }
  } else {
    log(`  ${C.gray}○ Netlify${C.reset}   not connected`);
  }

  if (config.render) {
    try {
      const services = await api("https://api.render.com/v1/services?limit=1", {
        headers: { Authorization: `Bearer ${config.render}` },
      });
      log(`  ${C.green}● Render${C.reset}    ${Array.isArray(services) ? services.length : 0} service(s)`);
    } catch (e) {
      log(`  ${C.red}● Render${C.reset}    ${e.message}`);
    }
  } else {
    log(`  ${C.gray}○ Render${C.reset}    not connected`);
  }

  log("");
}

// ── SESSIONS ──
async function cmdSessions(args) {
  const config = loadConfig();
  if (!config.jules) {
    logError("Jules API key not set. Run: node cli.js auth set jules <key>");
    process.exit(1);
  }

  const apiKey = config.jules;
  const headers = apiKey.startsWith("ya29.")
    ? { Authorization: `Bearer ${apiKey}` }
    : { "X-Goog-Api-Key": apiKey };

  try {
    const data = await api("https://jules.googleapis.com/v1alpha/parents/me/sessions", {
      headers,
    });
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      logDim("No sessions found.");
      return;
    }

    logBold(`\n  Jules Sessions (${sessions.length})\n`);

    for (const s of sessions) {
      const name = s.name || s.sessionId || "Untitled";
      const state = (s.state || "UNKNOWN").padEnd(12);
      const color = stateColor(s.state);
      const time = relativeTime(s.createdTime);
      const prompt = (s.prompt || "").substring(0, 60);

      log(`  ${C.bold}${name.substring(0, 40).padEnd(42)}${C.reset}`);
      log(`    ${color}${state}${C.reset} ${C.gray}${time.padEnd(10)}${C.reset} ${C.dim}${prompt}${C.dim}`);

      if (s.pullRequestNumber) {
        log(`    ${C.magenta}PR #${s.pullRequestNumber}${C.reset}`);
      }
    }
    log("");
  } catch (e) {
    logError(e.message);
  }
}

// ── CREATE MISSION ──
async function cmdCreate(args) {
  const config = loadConfig();
  if (!config.jules) {
    logError("Jules API key not set. Run: node cli.js auth set jules <key>");
    process.exit(1);
  }

  const prompt = args.join(" ");
  if (!prompt) {
    logError("Usage: node cli.js create \"<prompt>\"");
    logDim("Example: node cli.js create \"Build a todo app with React\"");
    process.exit(1);
  }

  const apiKey = config.jules;
  const headers = apiKey.startsWith("ya29.")
    ? { Authorization: `Bearer ${apiKey}` }
    : { "X-Goog-Api-Key": apiKey };

  log(`  Creating mission...`);

  try {
    const data = await api("https://jules.googleapis.com/v1alpha/parents/me/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        executionMode: "AGENT",
      }),
    });

    logSuccess(`Mission created!`);
    log(`  ${C.bold}Session:${C.reset}    ${data.sessionId}`);
    log(`  ${C.bold}State:${C.reset}      ${data.state || "created"}`);
    log("");
  } catch (e) {
    logError(e.message);
  }
}

// ── REPOS ──
async function cmdRepos(args) {
  const config = loadConfig();
  if (!config.github) {
    logError("GitHub token not set. Run: node cli.js auth set github <token>");
    process.exit(1);
  }

  try {
    const data = await api("https://api.github.com/user/repos?per_page=50&sort=updated", {
      headers: { Authorization: `Bearer ${config.github}` },
    });

    if (data.length === 0) {
      logDim("No repos found.");
      return;
    }

    logBold(`\n  GitHub Repos (${data.length})\n`);

    for (const r of data) {
      const name = r.full_name.padEnd(35);
      const priv = r.private ? `${C.red}private${C.reset}` : `${C.green}public${C.reset}`;
      const updated = relativeTime(r.updated_at);
      log(`  ${C.bold}${name}${C.reset}  ${priv.padEnd(10)} ${C.gray}${updated}${C.reset}`);
    }
    log("");
  } catch (e) {
    logError(e.message);
  }
}

// ── DEPLOY ──
async function cmdDeploy(args) {
  const config = loadConfig();
  const provider = args[0];
  const sub = args[1];
  const repo = args[2];
  const branch = args[3] || "main";

  if (!provider || provider === "help") {
    logBold("\n  Deploy Commands\n");
    log("");
    logDim("  Usage: node cli.js deploy <provider> [command] [repo] [branch]");
    log("");
    log(`  ${C.cyan}netlify <repo> [branch]${C.reset}       Create Netlify site for repo`);
    log(`  ${C.cyan}vercel <repo> [branch]${C.reset}         Create Vercel project for repo`);
    log(`  ${C.cyan}render <repo> [branch]${C.reset}         Create Render service for repo`);
    log(`  ${C.cyan}pages <repo> [branch]${C.reset}          Deploy to GitHub Pages`);
    log(`  ${C.cyan}list${C.reset}                          List all deployments`);
    log(`  ${C.gray}  netlify-list                  List Netlify sites`);
    log(`  ${C.gray}  vercel-list                   List Vercel projects`);
    log(`  ${C.gray}  render-list                   List Render services`);
    log(`  ${C.gray}  pages-list                    List GitHub Pages`);
    log("");
    logDim("  Example: node cli.js deploy netlify celebrity01/baby-j main");
    log("");
    return;
  }

  // ── LIST ALL ──
  if (provider === "list") {
    logBold("\n  All Deployments\n");
    await listDeployments(config);
    log("");
    return;
  }

  // ── PROVIDER LISTS ──
  if (provider === "netlify-list" || provider === "vercel-list" || provider === "render-list" || provider === "pages-list") {
    const pMap = {
      "netlify-list": "netlify",
      "vercel-list": "vercel",
      "render-list": "render",
      "pages-list": "github-pages",
    };
    await listSingleProvider(config, pMap[provider]);
    return;
  }

  // ── DEPLOY TO PROVIDER ──
  if (!repo) {
    logError(`Usage: node cli.js deploy ${provider} <owner/repo> [branch]`);
    process.exit(1);
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    logError('Repo must be in format "owner/repo"');
    process.exit(1);
  }

  switch (provider) {
    case "netlify":
      await deployNetlify(config, owner, repoName, branch);
      break;
    case "vercel":
      await deployVercel(config, owner, repoName, branch);
      break;
    case "render":
      await deployRender(config, owner, repoName, branch);
      break;
    case "pages":
      await deployPages(config, owner, repoName, branch);
      break;
    default:
      logError(`Unknown provider: ${provider}`);
      logDim("Use: netlify, vercel, render, or pages");
      process.exit(1);
  }
}

// ── DEPLOY: NETLIFY ──
async function deployNetlify(config, owner, repo, branch) {
  if (!config.netlify) {
    logError("Netlify token not set. Run: node cli.js auth set netlify <token>");
    process.exit(1);
  }

  log(`  Deploying ${C.cyan}${owner}/${repo}${C.reset} → ${C.green}Netlify${C.reset} (${branch})...`);
  log("");

  try {
    // Step 1: Create bare site
    const site = await api("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.netlify}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: repo }),
    });
    logSuccess(`Site created: ${site.name} (id: ${site.id})`);

    // Step 2: Configure build settings
    try {
      await api(`https://api.netlify.com/api/v1/sites/${site.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${config.netlify}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          build_settings: {
            branch,
            cmd: "npm run build",
            dir: ".next",
            repo_url: `https://github.com/${owner}/${repo}`,
          },
        }),
      });
      logSuccess("Build settings configured");
    } catch {
      logWarn("Build settings could not be configured (manual setup needed)");
    }

    log("");
    logBold("  Next Steps:");
    log(`  1. ${C.green}Site created${C.reset} — ${site.ssl_url || site.url}`);
    log(`  2. ${C.yellow}Connect repo${C.reset} — ${site.admin_url}`);
    log(`  3. ${C.gray}Push to branch${C.reset} — Netlify will auto-deploy`);
    log("");
  } catch (e) {
    logError(`Netlify deploy failed: ${e.message}`);
  }
}

// ── DEPLOY: VERCEL ──
async function deployVercel(config, owner, repo, branch) {
  if (!config.vercel) {
    logError("Vercel token not set. Run: node cli.js auth set vercel <token>");
    process.exit(1);
  }

  log(`  Deploying ${C.cyan}${owner}/${repo}${C.reset} → ${C.white}Vercel${C.reset} (${branch})...`);
  log("");

  try {
    // Get numeric repo ID
    let numericRepoId = null;
    if (config.github) {
      try {
        const repoData = await api(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `Bearer ${config.github}` },
        });
        numericRepoId = repoData.id;
      } catch {}
    }

    // Try with gitSource first
    if (numericRepoId) {
      try {
        const data = await api("https://api.vercel.com/v9/projects", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.vercel}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: repo,
            framework: "nextjs",
            gitSource: { type: "github", repo: numericRepoId },
          }),
        });
        const url = data.alias?.[0] || data.url || `https://${repo}-vercel.app`;
        logSuccess(`Project created with git linking`);
        log(`  ${C.bold}URL:${C.reset}     ${C.cyan}${url}${C.reset}`);
        log(`  ${C.bold}Git:${C.reset}     linked to ${owner}/${repo}`);
        log(`  ${C.bold}Branch:${C.reset}  ${branch} (auto-deploy on push)`);
        log("");
        return;
      } catch (e) {
        logWarn(`gitSource linking failed (${e.message}), trying bare project...`);
      }
    }

    // Fallback: bare project
    const data = await api("https://api.vercel.com/v9/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.vercel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: repo }),
    });
    const url = data.alias?.[0] || data.url || `https://${repo}-vercel.app`;
    logSuccess(`Project created`);
    log(`  ${C.bold}URL:${C.reset}     ${C.cyan}${url}${C.reset}`);
    log(`  ${C.yellow}Note:${C.reset}    Connect your GitHub repo in Vercel dashboard for auto-deploy`);
    log(`  ${C.bold}Dashboard:${C.reset} https://vercel.com/dashboard`);
    log("");
  } catch (e) {
    logError(`Vercel deploy failed: ${e.message}`);
  }
}

// ── DEPLOY: RENDER ──
async function deployRender(config, owner, repo, branch) {
  if (!config.render) {
    logError("Render API key not set. Run: node cli.js auth set render <key>");
    process.exit(1);
  }

  log(`  Deploying ${C.cyan}${owner}/${repo}${C.reset} → ${C.magenta}Render${C.reset} (${branch})...`);
  log("");

  try {
    // Get workspace ID
    const profileData = await api("https://api.render.com/v1/users", {
      headers: { Authorization: `Bearer ${config.render}` },
    });
    const users = Array.isArray(profileData) ? profileData : [profileData];
    const ownerId = users[0]?.uid || users[0]?.id;

    if (!ownerId) {
      logError("Could not determine Render workspace ID.");
      return;
    }

    // Create service
    const data = await api("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.render}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "web_service",
        name: repo,
        ownerId,
        serviceDetails: {
          repo: `https://github.com/${owner}/${repo}`,
          branch,
          runtime: "NODE",
          buildCommand: "npm install && npm run build",
          startCommand: "npm start",
          plan: "free",
          envVars: [{ key: "NODE_ENV", value: "production" }],
        },
      }),
    });

    const service = data.service || data;
    const serviceUrl = service.serviceDetails?.url || service.url;
    const serviceId = service.id;

    logSuccess(`Service created: ${repo}`);
    if (serviceUrl) log(`  ${C.bold}URL:${C.reset}       ${C.magenta}${serviceUrl}${C.reset}`);
    if (serviceId) log(`  ${C.bold}Dashboard:${C.reset} https://dashboard.render.com/web/${serviceId}`);
    log(`  ${C.bold}State:${C.reset}     ${service.currentState || "created"}`);
    log("");
  } catch (e) {
    logError(`Render deploy failed: ${e.message}`);
  }
}

// ── DEPLOY: GITHUB PAGES ──
async function deployPages(config, owner, repo, branch) {
  if (!config.github) {
    logError("GitHub token not set. Run: node cli.js auth set github <token>");
    process.exit(1);
  }

  const pagesUrl = owner.toLowerCase() === repo.toLowerCase()
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${repo}/`;

  log(`  Deploying ${C.cyan}${owner}/${repo}${C.reset} → ${C.blue}GitHub Pages${C.reset} (${branch})...`);
  log("");

  try {
    const base = `https://api.github.com/repos/${owner}/${repo}`;

    // Step 1: Push workflow file
    const workflowPath = ".github/workflows/deploy-pages.yml";
    const workflowContent = `name: Deploy to GitHub Pages

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
`;

    // Check if file exists (get SHA)
    let sha = undefined;
    try {
      const existing = await api(`${base}/contents/${workflowPath}`, {
        headers: { Authorization: `Bearer ${config.github}` },
      });
      sha = existing.sha;
    } catch {}

    const fileBody = { message: "Add GitHub Pages deployment workflow", content: Buffer.from(workflowContent).toString("base64"), branch };
    if (sha) fileBody.sha = sha;

    await api(`${base}/contents/${workflowPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.github}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fileBody),
    });
    logSuccess("Workflow file pushed");

    // Step 2: Enable Pages
    let pagesEnabled = false;
    try {
      await fetch(`${base}/pages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.github}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          build_type: "workflow",
          source: { branch, path: "/" },
        }),
      });
      pagesEnabled = true;
      logSuccess("GitHub Pages enabled");
    } catch {
      logWarn("Pages may already be configured or needs manual enable");
    }

    // Step 3: Trigger workflow
    let triggered = false;
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const triggerRes = await fetch(`${base}/actions/workflows/deploy-pages.yml/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.github}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: branch }),
      });
      triggered = triggerRes.ok;
      if (triggered) logSuccess("Workflow triggered");
    } catch {}

    log("");
    logBold("  Result:");
    log(`  ${C.bold}URL:${C.reset}       ${C.blue}${pagesUrl}${C.blue}`);
    log(`  ${C.bold}Workflow:${C.reset}  https://github.com/${owner}/${repo}/actions`);
    log(`  ${C.bold}Settings:${C.reset}  https://github.com/${owner}/${repo}/settings/pages`);

    if (!triggered) {
      log(`  ${C.yellow}Push to ${branch} to trigger deployment${C.reset}`);
    }
    log("");
  } catch (e) {
    logError(`GitHub Pages deploy failed: ${e.message}`);
  }
}

// ── LIST DEPLOYMENTS ──
async function listDeployments(config) {
  await listSingleProvider(config, "netlify");
  await listSingleProvider(config, "vercel");
  await listSingleProvider(config, "render");
  await listSingleProvider(config, "github-pages");
}

async function listSingleProvider(config, provider) {
  const labels = {
    netlify: "Netlify",
    vercel: "Vercel",
    render: "Render",
    "github-pages": "GitHub Pages",
  };
  const colors = {
    netlify: C.green,
    vercel: C.white,
    render: C.magenta,
    "github-pages": C.blue,
  };

  let items = [];

  try {
    if (provider === "netlify" && config.netlify) {
      const data = await api("https://api.netlify.com/api/v1/sites?per_page=20", {
        headers: { Authorization: `Bearer ${config.netlify}` },
      });
      items = (Array.isArray(data) ? data : []).map((s) => ({
        name: s.name || s.id,
        url: s.ssl_url || s.url,
        id: s.id,
      }));
    } else if (provider === "vercel" && config.vercel) {
      const data = await api("https://api.vercel.com/v9/projects?limit=20", {
        headers: { Authorization: `Bearer ${config.vercel}` },
      });
      items = (data.projects || []).map((p) => ({
        name: p.name,
        url: (p.alias || [])[0] || p.targets?.production?.url,
        id: p.id,
      }));
    } else if (provider === "render" && config.render) {
      const data = await api("https://api.render.com/v1/services?limit=20", {
        headers: { Authorization: `Bearer ${config.render}` },
      });
      items = (Array.isArray(data) ? data : []).map((s) => ({
        name: s.serviceDetails?.name || s.name || s.id,
        url: s.serviceDetails?.url || s.url,
        id: s.id,
      }));
    } else if (provider === "github-pages" && config.github) {
      const repos = await api("https://api.github.com/user/repos?per_page=100", {
        headers: { Authorization: `Bearer ${config.github}` },
      });
      const pagesRepos = repos.filter((r) => r.has_pages);
      for (const r of pagesRepos.slice(0, 10)) {
        try {
          const pages = await api(`https://api.github.com/repos/${r.owner.login}/${r.name}/pages`, {
            headers: { Authorization: `Bearer ${config.github}` },
          });
          if (pages.url) {
            items.push({ name: r.full_name, url: pages.url, id: r.name });
          }
        } catch {}
      }
    }
  } catch (e) {
    log(`  ${C.red}● ${labels[provider]}${C.reset}   ${e.message}`);
    return;
  }

  if (items.length === 0) {
    log(`  ${C.gray}○ ${labels[provider]}${C.reset}   no resources`);
    return;
  }

  const color = colors[provider];
  for (const item of items) {
    log(`  ${color}● ${labels[provider]}${C.reset}   ${C.bold}${item.name}${C.reset}  ${C.dim}${item.url || ""}${C.reset}`);
  }
}

// ── STATUS ──
async function cmdStatus(args) {
  const config = loadConfig();
  const repo = args[0];

  if (!repo) {
    logError("Usage: node cli.js status <owner/repo>");
    process.exit(1);
  }

  if (!config.github) {
    logError("GitHub token not set. Run: node cli.js auth set github <token>");
    process.exit(1);
  }

  const [owner, repoName] = repo.split("/");
  log(`  Checking ${C.cyan}${owner}/${repo}${C.reset} workflow status...\n`);

  try {
    const data = await api(
      `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/deploy-pages.yml/runs?per_page=3`,
      { headers: { Authorization: `Bearer ${config.github}` } }
    );

    const runs = data.workflow_runs || [];
    if (runs.length === 0) {
      logDim("No workflow runs found.");
      return;
    }

    for (const run of runs) {
      const status = run.status || "unknown";
      const conclusion = run.conclusion || "";
      const color = conclusion === "success" ? C.green : conclusion === "failure" ? C.red : status === "in_progress" ? C.cyan : C.yellow;
      const icon = conclusion === "success" ? "✓" : conclusion === "failure" ? "✗" : "◎";
      const time = relativeTime(run.created_at);
      const branch = run.head_branch || "";

      log(`  ${color}${icon} ${status.padEnd(15)} ${branch.padEnd(20)} ${C.gray}${time}${C.reset}`);
      if (run.html_url) log(`    ${C.dim}${run.html_url}${C.reset}`);
    }
    log("");
  } catch (e) {
    logError(e.message);
  }
}

// ── HELP ──
function cmdHelp() {
  log(`${C.bgCyan}${C.bgBlack}${C.bold} Baby J CLI ${C.reset}`);
  log(`${C.dim} Jules Super Agent — Command Line Interface${C.reset}`);
  log("");
  log(`${C.bold} USAGE${C.reset}`);
  log("  node cli.js <command> [options]");
  log("");
  log(`${C.bold} COMMANDS${C.reset}`);
  log("");
  log(`  ${C.cyan}auth${C.reset}              ${C.dim}Configure API tokens${C.reset}`);
  log(`  ${C.cyan}whoami${C.reset}            ${C.dim}Show connected identities${C.reset}`);
  log(`  ${C.cyan}sessions${C.reset}           ${C.dim}List Jules sessions${C.reset}`);
  log(`  ${C.cyan}create <prompt>${C.reset}     ${C.dim}Create a new mission${C.reset}`);
  log(`  ${C.cyan}repos${C.reset}              ${C.dim}List GitHub repos${C.reset}`);
  log(`  ${C.cyan}deploy <provider>${C.reset}    ${C.dim}Deploy to a hosting provider${C.reset}`);
  log(`  ${C.cyan}status <repo>${C.reset}       ${C.dim}Check deployment workflow status${C.reset}`);
  log("");
  log(`${C.bold} DEPLOY PROVIDERS${C.reset}`);
  log(`  node cli.js deploy ${C.green}netlify${C.reset} <owner/repo> [branch]`);
  log(`  node cli.js deploy ${C.white}vercel${C.reset} <owner/repo> [branch]`);
  log(`  node cli.js deploy ${C.magenta}render${C.reset} <owner/repo> [branch]`);
  log(`  node cli.js deploy ${C.blue}pages${C.reset} <owner/repo> [branch]`);
  log(`  node cli.js deploy ${C.gray}list${C.reset}`);
  log("");
  log(`${C.bold} AUTH EXAMPLES${C.reset}`);
  log("  node cli.js auth set jules ya29.a0...");
  log("  node cli.js auth set github ghp_x...");
  log("  node cli.js auth set vercel tk_y...");
  log("  node cli.js auth set netlify tk_...");
  log("  node cli.js auth set render rnd_...");
  log("");
  log(`${C.bold} CONFIG${C.reset}`);
  log(`  ${C.dim}Stored at: ~/.baby-j/config.json${C.reset}`);
  log("");
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const rest = args.slice(1);

  switch (command) {
    case "auth":
      cmdAuth(rest);
      break;
    case "whoami":
      await cmdWhoami();
      break;
    case "sessions":
    case "list":
      await cmdSessions(rest);
      break;
    case "create":
    case "new":
      await cmdCreate(rest);
      break;
    case "repos":
      await cmdRepos(rest);
      break;
    case "deploy":
    case "d":
      await cmdDeploy(rest);
      break;
    case "status":
      await cmdStatus(rest);
      break;
    case "help":
    case "-h":
    case "--help":
      cmdHelp();
      break;
    default:
      logError(`Unknown command: ${command}`);
      logDim("Run: node cli.js help");
      process.exit(1);
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
