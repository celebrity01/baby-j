import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Deploy to GitHub Pages.
 *
 * Simple, reliable approach:
 * 1. Create a workflow file in the repo via Contents API
 * 2. Enable Pages with build_type: "workflow"
 * 3. If already enabled, trigger a rebuild
 * 4. Return clear instructions for any manual steps
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "GitHub token required. Connect GitHub in Settings." }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Owner and repo are required." }, { status: 400 });
    }

    const siteBranch = branch || "main";
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const apiBase = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}`;
    const pagesUrl = `https://${owner}.github.io/${repo}/`;

    // Step 1: Check if Pages already exists
    const checkRes = await fetch(`${apiBase}/pages`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (checkRes.ok) {
      // Pages already enabled — trigger rebuild via workflow dispatch
      const pagesData = await checkRes.json() as Record<string, unknown>;
      console.log(`Pages already enabled for ${owner}/${repo}`);

      // Try to find and trigger a pages workflow
      let workflowTriggered = false;
      try {
        const wfRes = await fetch(`${apiBase}/actions/workflows`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (wfRes.ok) {
          const wfData = await wfRes.json() as Record<string, unknown>;
          const workflows = (wfData.workflows as Record<string, unknown>[]) || [];
          for (const wf of workflows) {
            const path = wf.path as string || "";
            if (path.includes("pages") || (wf.name as string || "").toLowerCase().includes("pages")) {
              const triggerRes = await fetch(`${apiBase}/actions/workflows/${wf.id}/dispatches`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
                body: JSON.stringify({ ref: siteBranch }),
              });
              if (triggerRes.ok) {
                workflowTriggered = true;
                console.log(`Triggered workflow: ${wf.name}`);
              }
              break;
            }
          }
        }
      } catch { /* non-fatal */ }

      return NextResponse.json({
        success: true,
        url: pagesUrl,
        message: workflowTriggered
          ? `GitHub Pages rebuild triggered for ${owner}/${repo}. Check progress in the Actions tab.`
          : `GitHub Pages is active at ${pagesUrl}. Push to ${siteBranch} to update.`,
      });
    }

    // Step 2: Pages not set up — create workflow and enable
    console.log(`Setting up Pages for ${owner}/${repo}...`);

    // Create workflow file
    const workflowCreated = await createWorkflowFile(token, owner, repo, siteBranch);

    // Enable Pages
    const enableRes = await fetch(`${apiBase}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        build_type: "workflow",
        source: { branch: siteBranch, path: "/" },
      }),
    });

    if (enableRes.ok) {
      return NextResponse.json({
        success: true,
        url: pagesUrl,
        message: `GitHub Pages enabled for ${owner}/${repo}. The workflow will run automatically on the next push to ${siteBranch}.`,
      });
    }

    // Enable failed — read error
    const errRaw = await enableRes.text().catch(() => "");
    let errMsg = errRaw.substring(0, 300);
    try {
      const j = JSON.parse(errRaw);
      errMsg = j.message || errMsg;
    } catch { /* keep raw */ }

    // If workflow was created but Pages enable failed, still return success
    // with instructions for the user to complete setup manually
    if (workflowCreated) {
      return NextResponse.json({
        success: true,
        url: pagesUrl,
        message: `Workflow created at .github/workflows/deploy-pages.yml. Go to https://github.com/${owner}/${repo}/settings/pages and select "GitHub Actions" as the source to complete setup.`,
      });
    }

    console.error(`Pages enable failed (${enableRes.status}):`, errMsg);
    return NextResponse.json({
      error: `Could not enable GitHub Pages: ${errMsg}. Ensure your token has 'repo' and 'pages' permissions.`,
    }, { status: enableRes.status });
  } catch (error) {
    console.error("GitHub Pages deploy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `GitHub Pages setup failed: ${msg}` }, { status: 500 });
  }
}

async function createWorkflowFile(token: string, owner: string, repo: string, branch: string): Promise<boolean> {
  const path = ".github/workflows/deploy-pages.yml";
  const content = Buffer.from(
`name: Deploy to GitHub Pages
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
          cache: npm
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
`
  ).toString("base64");

  try {
    // Check if already exists
    const check = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
    );
    if (check.ok) return true;

    // Create it
    const create = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Add GitHub Pages deployment workflow", content, branch }),
      },
    );

    if (create.ok) {
      console.log("Created deploy-pages.yml workflow");
      return true;
    }
    const errText = await create.text().catch(() => "");
    console.error(`Workflow creation failed:`, errText.substring(0, 200));
    return false;
  } catch (err) {
    console.error("Workflow creation error:", err);
    return false;
  }
}
