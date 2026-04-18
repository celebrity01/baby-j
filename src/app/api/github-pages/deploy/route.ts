import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Deploy to GitHub Pages.
 *
 * Modern GitHub Pages uses GitHub Actions for deployment.
 * Strategy:
 * 1. Check if Pages is already enabled
 * 2. If not, enable it with build_type "workflow"
 * 3. If the repo doesn't have a workflow, create one via the Contents API
 * 4. Trigger a rebuild if Pages already exists
 *
 * Cross-system: Uses the GitHub token from the connected account.
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing GitHub token. Connect GitHub in Settings." }, { status: 401 });
    }
    const body = await req.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 });
    }

    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const siteBranch = branch || "main";
    const baseUrl = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}`;

    // Step 1: Check if Pages is already enabled
    const checkRes = await fetch(`${baseUrl}/pages`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    let pagesEnabled = false;

    if (checkRes.ok) {
      pagesEnabled = true;
      const currentPages = await checkRes.json() as Record<string, unknown>;
      console.log(`Pages already enabled for ${owner}/${repo}, status:`, currentPages.status);

      // Trigger rebuild
      const rebuildRes = await fetch(`${baseUrl}/actions/workflows`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (rebuildRes.ok) {
        const workflows = await rebuildRes.json() as Record<string, unknown>;
        const wfs = (workflows.workflows as Record<string, unknown>[]) || [];
        const pagesWorkflow = wfs.find((w: Record<string, unknown>) =>
          (w.path as string)?.includes("pages") || (w.name as string)?.toLowerCase().includes("pages")
        );

        if (pagesWorkflow?.id) {
          // Trigger the pages workflow
          const triggerRes = await fetch(
            `${baseUrl}/actions/workflows/${pagesWorkflow.id}/dispatches`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ref: siteBranch }),
            }
          );
          if (triggerRes.ok) {
            console.log(`Triggered Pages workflow for ${owner}/${repo}`);
          } else {
            console.warn(`Failed to trigger Pages workflow (${triggerRes.status})`);
          }
        }
      }

      const pagesUrl = currentPages.html_url || `https://${owner}.github.io/${repo}/`;
      return NextResponse.json({
        success: true,
        url: pagesUrl,
        message: `GitHub Pages rebuild triggered for ${owner}/${repo}`,
        status: currentPages.status,
      });
    }

    // Step 2: Pages not enabled — enable it
    // GitHub may return HTML 404 for repos that don't have Pages set up
    if (checkRes.status === 404) {
      console.log(`Pages not enabled for ${owner}/${repo}, enabling...`);

      // First, create a GitHub Actions workflow file for Pages deployment
      const workflowCreated = await createPagesWorkflow(token, owner, repo, siteBranch);

      if (!workflowCreated) {
        // If we can't create the workflow, try enabling Pages in legacy mode (branch-based)
        const legacyRes = await fetch(`${baseUrl}/pages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: { branch: siteBranch, path: "/" },
          }),
        });

        if (!legacyRes.ok) {
          const errText = await legacyRes.text().catch(() => "");
          const errJson = tryParseJson(errText);
          const errMsg = errJson?.message || errText.substring(0, 200) || `GitHub API error (${legacyRes.status})`;
          console.error(`Failed to enable Pages: ${errMsg}`);
          return NextResponse.json({
            error: `Could not enable GitHub Pages: ${errMsg}. Make sure your GitHub token has the 'repo' and 'pages' scopes.`,
          }, { status: legacyRes.status });
        }

        return NextResponse.json({
          success: true,
          url: `https://${owner}.github.io/${repo}/`,
          message: `GitHub Pages enabled for ${owner}/${repo} (legacy mode). Configure your build in the repo settings.`,
        });
      }

      // Workflow created — now enable Pages with workflow build type
      const enableRes = await fetch(`${baseUrl}/pages`, {
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

      if (!enableRes.ok) {
        // Try with PUT as fallback
        const enableRes2 = await fetch(`${baseUrl}/pages`, {
          method: "PUT",
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

        if (!enableRes2.ok) {
          const errText = await enableRes2.text().catch(() => "");
          const errJson = tryParseJson(errText);
          const errMsg = errJson?.message || errText.substring(0, 200) || `GitHub API error (${enableRes2.status})`;
          console.error(`Failed to enable Pages (PUT): ${errMsg}`);

          // Workflow was created but Pages enable failed — still useful info
          return NextResponse.json({
            success: true,
            url: `https://${owner}.github.io/${repo}/`,
            message: `Pages workflow created at .github/workflows/deploy-pages.yml. Go to repo Settings > Pages and select "GitHub Actions" as the source to complete setup.`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        url: `https://${owner}.github.io/${repo}/`,
        message: `GitHub Pages enabled with Actions workflow for ${owner}/${repo}. The workflow will run automatically on push to ${siteBranch}.`,
      });
    }

    // Other error (e.g., 403 forbidden, 401 unauthorized)
    const errText = await checkRes.text().catch(() => "");
    const errJson = tryParseJson(errText);
    const errMsg = errJson?.message || errText.substring(0, 200) || `GitHub API error (${checkRes.status})`;
    return NextResponse.json({
      error: `GitHub Pages check failed: ${errMsg}`,
    }, { status: checkRes.status });

  } catch (error) {
    console.error("GitHub Pages deploy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `GitHub Pages setup failed: ${msg}` }, { status: 500 });
  }
}

/**
 * Create a GitHub Actions workflow file for deploying to Pages.
 * Uses the Contents API to create .github/workflows/deploy-pages.yml
 */
async function createPagesWorkflow(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  const path = ".github/workflows/deploy-pages.yml";
  const content = Buffer.from(`name: Deploy to GitHub Pages

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
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
`).toString("base64");

  try {
    // Check if workflow already exists
    const checkRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (checkRes.ok) {
      console.log("Pages workflow already exists, skipping creation");
      return true;
    }

    // Create the workflow file
    const createRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Configure GitHub Pages deployment",
          content,
          branch,
        }),
      }
    );

    if (createRes.ok) {
      console.log("Created Pages workflow successfully");
      return true;
    }

    const errText = await createRes.text().catch(() => "");
    const errJson = tryParseJson(errText);
    const errMsg = errJson?.message || errText.substring(0, 200);
    console.error(`Failed to create Pages workflow: ${errMsg}`);
    return false;
  } catch (err) {
    console.error("Failed to create Pages workflow:", err);
    return false;
  }
}

/** Safely try to parse JSON, returning null if invalid */
function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
