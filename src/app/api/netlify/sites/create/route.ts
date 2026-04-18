import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Create a Netlify site, optionally linked to a GitHub repo.
 *
 * Strategy:
 * 1. If repoUrl + githubToken are both provided, resolve the GitHub repo
 *    to a numeric ID via GitHub API, then create a Netlify site with repo link.
 * 2. If repoUrl is provided but no githubToken, create a standalone site with
 *    build settings (repo won't auto-build but site is functional).
 * 3. If no repoUrl, just create a bare standalone site.
 *
 * Cross-system communication: The GitHub token is forwarded from the UI
 * (where it's already connected) alongside the Netlify provider token,
 * so this route can talk to GitHub's API to resolve repo metadata.
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Netlify-Token header" }, { status: 401 });
    }

    // Cross-system: accept GitHub token from UI to resolve repo metadata
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");

    const body = await req.json();
    const { name, repoUrl, branch, repoId } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing site name" }, { status: 400 });
    }

    const siteBranch = branch || "main";

    // Step 1: Resolve GitHub repo to numeric ID if we have a token
    let numericRepoId: number | null = repoId || null;

    if (repoUrl && githubToken && !numericRepoId) {
      try {
        // Parse owner/repo from URL like "https://github.com/owner/repo"
        const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
        if (urlMatch) {
          const [, owner, repo] = urlMatch;
          const ghRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            if (ghData.id) numericRepoId = ghData.id;
          }
        }
      } catch (err) {
        console.warn("Failed to resolve GitHub repo ID (non-fatal):", err);
      }
    }

    // Step 2: Try creating site with repo link (requires Netlify GitHub App installed)
    if (numericRepoId) {
      try {
        const linkedRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            repo: {
              id: numericRepoId,
              branch: siteBranch,
              cmd: "npm run build",
              dir: "out",
              provider: "github",
            },
          }),
        });

        if (linkedRes.ok) {
          const data = await linkedRes.json();
          return NextResponse.json(data);
        }

        // If linked creation fails, fall through to standalone creation
        const errBody = await linkedRes.json().catch(() => ({}));
        console.log("Netlify linked creation failed, falling back to standalone:", linkedRes.status, errBody);
      } catch (err) {
        console.warn("Netlify linked creation error (non-fatal):", err);
      }
    }

    // Step 3: Create standalone site (always works with valid PAT)
    const standaloneRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!standaloneRes.ok) {
      const errData = await standaloneRes.json().catch(() => ({}));
      const message = errData?.message || errData?.error || "Failed to create Netlify site";
      return NextResponse.json({ error: String(message) }, { status: standaloneRes.status });
    }

    const data = await standaloneRes.json();

    // Step 4: Configure build settings on the created site (best-effort)
    const siteId = data.id as string;
    if (siteId) {
      try {
        const patchBody: Record<string, unknown> = {
          build_settings: {
            branch: siteBranch,
            cmd: "npm run build",
            dir: "out",
          },
        };

        // If we have a repo URL but no linked repo, store it as build metadata
        if (repoUrl) {
          (patchBody.build_settings as Record<string, unknown>).repo_url = repoUrl;
        }

        const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        });

        if (patchRes.ok) {
          const patchedData = await patchRes.json();
          // Merge patched build settings back into response
          data.build_settings = patchedData.build_settings || data.build_settings;
        } else {
          console.warn("Netlify build_settings PATCH failed (non-fatal):", await patchRes.text().catch(() => ""));
        }
      } catch (err) {
        console.warn("Netlify build_settings PATCH error (non-fatal):", err);
      }
    }

    // Step 5: If we have GitHub token and repo, try to install GitHub repo via Netlify's
    // manual repo link API as a secondary attempt (works without the GitHub App)
    if (repoUrl && githubToken && siteId && !numericRepoId) {
      try {
        const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
        if (urlMatch) {
          const [, owner, repo] = urlMatch;
          await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/repo`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              repo_url: repoUrl,
              branch: siteBranch,
              dir: "out",
              cmd: "npm run build",
              provider: "github",
              repo_owner: owner,
              repo_name: repo,
            }),
          });
        }
      } catch (err) {
        console.warn("Netlify manual repo link failed (non-fatal):", err);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Netlify site create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
