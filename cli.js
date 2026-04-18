#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Baby J CLI — Command Line Interface for Jules Super Agent
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

// ── Helpers ──
function log(msg, color = C.white) { console.log(`${color}${msg}${C.reset}`); }
function logBold(msg, color = C.cyan) { log(`${C.bold}${msg}`, color); }
function logError(msg) { log(`${C.red}✗ ${msg}`, C.red); }
function logSuccess(msg) { log(`${C.green}✓ ${msg}`, C.green); }
function logDim(msg) { log(msg, C.gray); }

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

// ── COMMANDS ──
async function cmdDeploy(args) {
  const config = loadConfig();
  const provider = args[0];
  const repo = args[1];
  const branch = args[2] || "main";

  if (provider === "smart") {
    if (!repo) {
      logError("Usage: node cli.js deploy smart <owner/repo> [branch]");
      process.exit(1);
    }
    const [owner, name] = repo.split("/");
    if (!owner || !name) {
       logError("Invalid repo format. Use owner/repo");
       process.exit(1);
    }
    log(`  Starting ${C.bold}Smart Deploy${C.reset} for ${C.cyan}${repo}${C.reset}...`);

    try {
      const res = await fetch("http://localhost:3000/api/deploy/smart", {
        method: "POST",
        headers: {
          "X-GitHub-Token": config.github || "",
          "X-Vercel-Token": config.vercel || "",
          "X-Netlify-Token": config.netlify || "",
          "X-Render-Api-Key": config.render || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner, repo: name, branch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      logSuccess(`Project analyzed as ${C.bold}${data.analysis.type}${C.reset}`);
      logSuccess(`Deployed to ${C.bold}${data.provider}${C.reset}`);
      log(`  ${C.bold}URL:${C.reset} ${C.cyan}${data.result.url}${C.reset}`);
    } catch (e) {
      logError(e.message);
    }
    return;
  }

  if (provider === "list") {
    logBold("\n  Active Deployments\n");
    try {
      const res = await fetch("http://localhost:3000/api/deploy/projects", {
        headers: {
          "X-GitHub-Token": config.github || "",
          "X-Vercel-Token": config.vercel || "",
          "X-Netlify-Token": config.netlify || "",
          "X-Render-Api-Key": config.render || "",
        }
      });
      const projects = await res.json();
      if (!Array.isArray(projects)) throw new Error("Failed to fetch projects");

      projects.forEach(p => {
        log(`  ${C.bold}${p.name.padEnd(20)}${C.reset} ${C.cyan}${p.provider.padEnd(15)}${C.reset} ${C.dim}${p.url}${C.reset}`);
      });
    } catch (e) {
      logError(e.message);
    }
    return;
  }

  logBold("\n  Deploy Commands\n");
  log("  node cli.js deploy smart <repo> [branch]    One-click smart deploy");
  log("  node cli.js deploy list                     List all deployments");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const rest = args.slice(1);

  if (command === "deploy") {
    await cmdDeploy(rest);
  } else if (command === "auth") {
    const action = rest[0];
    const key = rest[1];
    const val = rest[2];
    const config = loadConfig();
    if (action === "set") {
      config[key] = val;
      saveConfig(config);
      logSuccess(`${key} token saved`);
    } else {
      log("Usage: node cli.js auth set <provider> <token>");
    }
  } else {
    logBold("Baby J CLI");
    log("  node cli.js deploy smart <owner/repo>");
    log("  node cli.js deploy list");
    log("  node cli.js auth set <provider> <token>");
  }
}

main().catch(e => logError(e.message));
