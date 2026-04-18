import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import {
  createOrUpdateRepoFile,
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
} from "@/lib/github-secrets";

/**
 * GITHUB PAGES — Deploy API Route
 *
 * Based on official GitHub REST API documentation:
 * https://docs.github.com/rest/pages/pages
 *
 * APPROACH:
 * 1. Create a GitHub Actions workflow file in the repo (.github/workflows/deploy-pages.yml)
 * 2. Enable GitHub Pages with build_type: "workflow"
 * 3. Trigger the workflow via workflow_dispatch
 * 4. Return Pages URL + workflow URL + setup steps
 *
 * REQUIRED TOKEN SCOPES:
 * - Classic PAT: repo + workflow
 * - Fine-grained: Contents (write), Pages (write), Administration (write), Actions (write), Secrets (write)
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
      return NextResponse.json({ error: "Owner and repo are required." }, { status: 400 });
    }

    const siteBranch = branch || "main";
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const pagesUrl = owner.toLowerCase() === repo.toLowerCase()
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repo}/`;

    // ─────────────────────────────────────────────
    // Step 1: Create GitHub Actions workflow file
    // ─────────────────────────────────────────────
    console.log(`[GitHub Pages] Setting up deployment for ${owner}/${repo}`);

    const workflowPath = ".github/workflows/deploy-pages.yml";
    const workflowContent = generatePagesWorkflow(siteBranch);

    const fileResult = await createOrUpdateRepoFile(
      owner, repo, workflowPath, workflowContent,
      "Add GitHub Pages deployment workflow",
      siteBranch,
      githubToken
    );

    if (!fileResult.success) {
      console.error(`[GitHub Pages] Workflow creation failed:`, fileResult.error);
      return NextResponse.json({
        success: false,
        url: pagesUrl,
        error: `Could not create workflow file: ${fileResult.error}`,
        hint: "Ensure your GitHub token has 'repo' and 'workflow' scopes, and you have write access to the repository.",
      }, { status: 500 });
    }

    console.log(`[GitHub Pages] Workflow pushed to ${workflowPath}`);

    // ─────────────────────────────────────────────
    // Step 2: Enable GitHub Pages with workflow source
    // ─────────────────────────────────────────────
    let pagesEnabled = false;
    let pagesMessage = "";

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

      if (enableRes.ok || enableRes.status === 201) {
        pagesEnabled = true;
        console.log(`[GitHub Pages] Pages enabled with workflow source`);
      } else if (enableRes.status === 409) {
        // Pages already configured — that's fine
        pagesEnabled = true;
        console.log(`[GitHub Pages] Pages already configured`);
      } else {
        const errRaw = await enableRes.text().catch(() => "");
        try {
          const j = JSON.parse(errRaw);
          pagesMessage = j.message || errRaw.substring(0, 200);
        } catch {
          pagesMessage = errRaw.substring(0, 200);
        }
        console.warn(`[GitHub Pages] Enable failed (${enableRes.status}):`, pagesMessage);
      }
    } catch (err) {
      console.warn("[GitHub Pages] Enable error:", err);
    }

    // ─────────────────────────────────────────────
    // Step 3: Trigger workflow dispatch
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // Step 4: Return result
    // ─────────────────────────────────────────────
    const autoDeploy = pagesEnabled && workflowTriggered;
    const settingsUrl = `https://github.com/${owner}/${repo}/settings/pages`;

    return NextResponse.json({
      success: true,
      url: pagesUrl,
      workflow_url: workflowUrl,
      pages_enabled: pagesEnabled,
      workflow_triggered: workflowTriggered,
      message: autoDeploy
        ? `GitHub Pages deployment triggered! Site will be live at ${pagesUrl} in 1-3 minutes.`
        : pagesEnabled
          ? `GitHub Pages enabled. The deploy workflow will run automatically on the next push to "${siteBranch}".`
          : `Workflow file created. To complete setup, go to your repository Settings → Pages and select "GitHub Actions" as the source.${pagesMessage ? ` (${pagesMessage})` : ""}`,
      dashboard_link: settingsUrl,
      setup_steps: [
        { step: 1, text: "Workflow file pushed to repo", done: true },
        { step: 2, text: pagesEnabled ? "GitHub Pages enabled" : "Enable Pages (may need manual step)", done: pagesEnabled },
        { step: 3, text: workflowTriggered ? "Deployment triggered" : "Push to branch to trigger deployment", done: workflowTriggered },
        { step: 4, text: `Site live at ${pagesUrl}`, done: false },
      ],
    });
  } catch (error) {
    console.error("[GitHub Pages] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `GitHub Pages error: ${msg}` }, { status: 500 });
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
