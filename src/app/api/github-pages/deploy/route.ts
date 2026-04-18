import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import {
  createOrUpdateRepoFile,
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
} from "@/lib/github-secrets";

/**
 * Deploy to GitHub Pages via GitHub Actions.
 *
 * NEW ARCHITECTURE:
 * 1. Push a GitHub Actions workflow file for Pages deployment
 * 2. Enable Pages with build_type: "workflow" via GitHub API
 * 3. Trigger the workflow via workflow_dispatch
 * 4. Return the Pages URL and workflow run URL
 *
 * This is more reliable than direct API calls because:
 * - GitHub Actions handles the build and deploy automatically
 * - No manual configuration needed beyond pushing the workflow
 * - Works with any GitHub token that has 'repo' scope
 */
export async function POST(req: NextRequest) {
  try {
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token required. Connect GitHub in Settings." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required." },
        { status: 400 }
      );
    }

    const siteBranch = branch || "main";
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const apiBase = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}`;
    const pagesUrl = `https://${owner}.github.io/${repo}/`;

    // ── Step 1: Push GitHub Actions workflow file ──
    console.log(`[GitHub Pages] Setting up deployment for ${owner}/${repo}`);

    const workflowPath = ".github/workflows/deploy-pages.yml";
    const workflowContent = generatePagesWorkflow(siteBranch);

    const fileResult = await createOrUpdateRepoFile(
      owner, repo, workflowPath, workflowContent,
      "Add GitHub Pages deployment workflow via Baby J",
      siteBranch,
      githubToken
    );

    if (!fileResult.success) {
      console.error(`[GitHub Pages] Workflow creation failed:`, fileResult.error);
      return NextResponse.json({
        success: false,
        url: pagesUrl,
        error: `Failed to create workflow file: ${fileResult.error}. Check that your token has write access to ${owner}/${repo}.`,
      });
    }

    console.log(`[GitHub Pages] Workflow pushed to ${workflowPath}`);

    // ── Step 2: Enable GitHub Pages with workflow source ──
    let pagesEnabled = false;
    let pagesError = "";

    try {
      const enableRes = await fetch(`${apiBase}/pages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          build_type: "workflow",
          source: { branch: siteBranch, path: "/" },
        }),
      });

      if (enableRes.ok) {
        pagesEnabled = true;
        console.log(`[GitHub Pages] Pages enabled with workflow source`);
      } else if (enableRes.status === 409) {
        // Pages already configured - that's fine
        pagesEnabled = true;
        console.log(`[GitHub Pages] Pages already configured`);
      } else {
        const errRaw = await enableRes.text().catch(() => "");
        try {
          const j = JSON.parse(errRaw);
          pagesError = j.message || errRaw.substring(0, 200);
        } catch {
          pagesError = errRaw.substring(0, 200);
        }
        console.warn(`[GitHub Pages] Enable failed (${enableRes.status}):`, pagesError);
      }
    } catch (err) {
      console.warn("[GitHub Pages] Enable error:", err);
    }

    // ── Step 3: Trigger workflow dispatch ──
    let workflowUrl = "";
    let workflowTriggered = false;

    try {
      // Wait for GitHub to register the new workflow file
      await new Promise((r) => setTimeout(r, 2000));

      workflowTriggered = await triggerWorkflowDispatch(
        owner, repo, "deploy-pages.yml", siteBranch, githubToken
      );

      if (workflowTriggered) {
        await new Promise((r) => setTimeout(r, 3000));
        const run = await getLatestWorkflowRun(owner, repo, "deploy-pages.yml", githubToken);
        if (run) {
          workflowUrl = (run.html_url as string) || "";
        }
      }
    } catch (err) {
      console.warn("[GitHub Pages] Workflow trigger error:", err);
    }

    // ── Step 4: Return result ──
    const autoDeploy = pagesEnabled && workflowTriggered;

    return NextResponse.json({
      success: true,
      url: pagesUrl,
      workflow_url: workflowUrl,
      pages_enabled: pagesEnabled,
      workflow_triggered: workflowTriggered,
      message: autoDeploy
        ? `GitHub Pages deployment triggered! The site will be live at ${pagesUrl} in 1-3 minutes. Watch progress: ${workflowUrl}`
        : pagesEnabled
          ? `GitHub Pages enabled. Deploy the ${siteBranch} branch to trigger the workflow automatically. Workflow file created at .github/workflows/deploy-pages.yml.`
          : `Workflow created at .github/workflows/deploy-pages.yml. To complete setup: Go to https://github.com/${owner}/${repo}/settings/pages and select "GitHub Actions" as the source.${pagesError ? ` Note: ${pagesError}` : ""}`,
    });
  } catch (error) {
    console.error("[GitHub Pages] Deploy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `GitHub Pages setup failed: ${msg}` },
      { status: 500 }
    );
  }
}

function generatePagesWorkflow(branch: string): string {
  return `name: Deploy to GitHub Pages

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

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

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
}
