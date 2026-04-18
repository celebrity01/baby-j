import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import {
  setRepoSecret,
  createOrUpdateRepoFile,
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
} from "@/lib/github-secrets";

/**
 * Create a Netlify site and deploy via GitHub Actions.
 *
 * NEW ARCHITECTURE:
 * 1. Create a bare Netlify site (simple API call, always works)
 * 2. Push a GitHub Actions workflow file to the user's repo
 * 3. Store NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID as encrypted repo secrets
 * 4. Trigger the workflow via workflow_dispatch
 * 5. Return both the Netlify site URL and the GitHub Actions run URL
 *
 * This bypasses the Netlify GitHub App requirement entirely.
 * GitHub Actions handles the build + deploy automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const netlifyToken = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!netlifyToken) {
      return NextResponse.json(
        { error: "Netlify token required. Add your token in Settings." },
        { status: 401 }
      );
    }

    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token required. Connect GitHub in Settings." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, branch } = body;
    const siteBranch = branch || "main";

    if (!name) {
      return NextResponse.json(
        { error: "Repository name is required." },
        { status: 400 }
      );
    }

    // ── Step 1: Create bare Netlify site ──
    const baseName = name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .substring(0, 30);
    const uniqueName = `${baseName}-${crypto.randomUUID().split("-")[0]}`;

    console.log(`[Netlify] Creating site: ${uniqueName}`);

    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: uniqueName }),
    });

    if (!createRes.ok) {
      const raw = await createRes.text().catch(() => "");
      let errMsg = raw.substring(0, 300);
      try {
        const j = JSON.parse(raw);
        errMsg = j.message || j.error || errMsg;
      } catch { /* keep raw */ }
      console.error(`[Netlify] Site creation failed (${createRes.status}):`, errMsg);
      return NextResponse.json(
        { error: `Netlify rejected site creation (${createRes.status}): ${errMsg}. Check your Netlify token permissions.` },
        { status: createRes.status }
      );
    }

    const site = (await createRes.json()) as Record<string, unknown>;
    const siteId = site.id as string;
    const siteUrl = (site.ssl_url as string) || (site.url as string) || `https://${uniqueName}.netlify.app`;

    console.log(`[Netlify] Site created: id=${siteId}, url=${siteUrl}`);

    // ── Step 2: Push GitHub Actions workflow file ──
    const workflowPath = ".github/workflows/deploy-netlify.yml";
    const workflowContent = generateNetlifyWorkflow(siteBranch);

    console.log(`[Netlify] Pushing workflow to ${workflowPath}`);

    const fileResult = await createOrUpdateRepoFile(
      name.split("/")[0] || "",  // owner - fallback, will be overridden
      name.split("/")[1] || name, // repo
      workflowPath,
      workflowContent,
      "Add Netlify deployment workflow via Baby J",
      siteBranch,
      githubToken
    );

    // If the name contains a slash (owner/repo format), parse it
    // Otherwise use the body's repoUrl or the name as-is
    const repoUrl = body.repoUrl as string | undefined;
    let owner: string;
    let repo: string;

    if (name.includes("/")) {
      [owner, repo] = name.split("/");
    } else if (repoUrl) {
      const parts = repoUrl.replace(/\/$/, "").split("/");
      owner = parts[parts.length - 2] || "";
      repo = parts[parts.length - 1] || name;
    } else {
      owner = "";
      repo = name;
    }

    if (!owner || !repo) {
      return NextResponse.json({
        id: siteId,
        name: uniqueName,
        url: siteUrl,
        success: true,
        message: `Netlify site created at ${siteUrl}. Could not determine repo owner/repo from "${name}". Please manually connect your repo in the Netlify dashboard.`,
      });
    }

    // ── Step 3: Set encrypted GitHub secrets ──
    console.log(`[Netlify] Setting secrets for ${owner}/${repo}`);

    const [tokenSecret, siteSecret] = await Promise.all([
      setRepoSecret(owner, repo, "NETLIFY_AUTH_TOKEN", netlifyToken, githubToken),
      setRepoSecret(owner, repo, "NETLIFY_SITE_ID", siteId, githubToken),
    ]);

    if (!tokenSecret || !siteSecret) {
      console.warn(`[Netlify] Some secrets failed to set. Token: ${tokenSecret}, Site: ${siteSecret}`);
    }

    // ── Step 4: Trigger workflow dispatch ──
    let workflowUrl = "";
    let workflowTriggered = false;

    try {
      // Wait a moment for GitHub to register the new workflow file
      await new Promise((r) => setTimeout(r, 2000));

      workflowTriggered = await triggerWorkflowDispatch(
        owner, repo, "deploy-netlify.yml", siteBranch, githubToken
      );

      if (workflowTriggered) {
        // Wait and fetch the run URL
        await new Promise((r) => setTimeout(r, 3000));
        const run = await getLatestWorkflowRun(owner, repo, "deploy-netlify.yml", githubToken);
        if (run) {
          workflowUrl = (run.html_url as string) || "";
        }
      }
    } catch (err) {
      console.warn("[Netlify] Workflow trigger error:", err);
    }

    // ── Step 5: Return result ──
    const secretsSet = tokenSecret && siteSecret;
    const autoDeploy = secretsSet && workflowTriggered;

    return NextResponse.json({
      id: siteId,
      name: uniqueName,
      url: siteUrl,
      success: true,
      workflow_url: workflowUrl,
      workflow_triggered: workflowTriggered,
      secrets_set: secretsSet,
      message: autoDeploy
        ? `Netlify site created and deployment triggered! The site will be live at ${siteUrl} in 1-3 minutes. Watch progress: ${workflowUrl}`
        : secretsSet
          ? `Netlify site created and secrets configured. Go to GitHub Actions tab to trigger the deploy-netlify workflow manually. Site URL: ${siteUrl}`
          : `Netlify site created at ${siteUrl}. To complete setup: 1) Go to https://github.com/${owner}/${repo}/settings/secrets/actions 2) Add NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID 3) Push to ${siteBranch} to trigger deployment.`,
    });
  } catch (error) {
    console.error("[Netlify] Deployment error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create Netlify deployment: ${msg}` },
      { status: 500 }
    );
  }
}

function generateNetlifyWorkflow(branch: string): string {
  return `name: Deploy to Netlify

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: './out'
          production-branch: ${branch}
          production-deploy: true
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
`;
}
