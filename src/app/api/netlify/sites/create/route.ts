import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Create a Netlify site, optionally linked to a GitHub repo.
 *
 * Strategy:
 * 1. If repoUrl + githubToken provided, resolve GitHub repo to numeric ID
 * 2. Try creating site with repo link (requires Netlify GitHub App)
 * 3. Fall back to standalone site + build settings
 *
 * Cross-system: Accepts X-GitHub-Token to resolve repo metadata via GitHub API.
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing Netlify token. Connect your Netlify account in Settings." }, { status: 401 });
    }

    // Cross-system: accept GitHub token to resolve repo metadata
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");

    const body = await req.json();
    const { name, repoUrl, branch } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing site name" }, { status: 400 });
    }

    const siteBranch = branch || "main";

    // Step 1: Resolve GitHub repo to numeric ID
    let numericRepoId: number | null = null;

    if (repoUrl && githubToken) {
      try {
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
            console.log(`Resolved GitHub repo ${owner}/${repo} to ID: ${numericRepoId}`);
          } else {
            console.warn(`GitHub API returned ${ghRes.status} for repo ${owner}/${repo}`);
          }
        }
      } catch (err) {
        console.warn("Failed to resolve GitHub repo ID (non-fatal):", err);
      }
    }

    // Step 2: Try creating site with repo link
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

        const errBody = await linkedRes.text().catch(() => "");
        console.log(`Netlify linked creation failed (${linkedRes.status}):`, errBody.substring(0, 200));
      } catch (err) {
        console.warn("Netlify linked creation error (non-fatal):", err);
      }
    }

    // Step 3: Create standalone site with unique name fallback
    // Netlify site names are globally unique — if taken, append a suffix
    let siteName = name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
    if (siteName.length > 50) siteName = siteName.substring(0, 50);
    if (!/^[a-z]/.test(siteName)) siteName = "site-" + siteName;

    let standaloneRes: Response;
    let data: Record<string, unknown> | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      const attemptName = attempt === 0 ? siteName : `${siteName}-${Date.now().toString(36)}`;

      standaloneRes = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: attemptName }),
      });

      if (standaloneRes.ok) {
        data = await standaloneRes.json();
        break;
      }

      // Extract error message — try JSON first, then fall back to text
      const contentType = standaloneRes.headers.get("content-type") || "";
      let errorMsg = "";

      if (contentType.includes("application/json")) {
        try {
          const errData = await standaloneRes.json();
          errorMsg = errData.message || errData.error || errData.code || "";
        } catch { /* JSON parse failed */ }
      } else {
        errorMsg = await standaloneRes.text().catch(() => "");
      }

      lastError = `Netlify API (${standaloneRes.status}): ${errorMsg}`.trim();

      // If it's a name conflict (422), try with a different name
      if (standaloneRes.status === 422 && errorMsg.toLowerCase().includes("name")) {
        console.log(`Site name "${attemptName}" taken, retrying...`);
        continue;
      }

      // Any other error — stop retrying
      break;
    }

    if (!data) {
      return NextResponse.json({
        error: lastError || "Failed to create Netlify site. Please check your Netlify token and try again.",
      }, { status: 400 });
    }

    // Step 4: Configure build settings
    const siteId = data.id as string;
    if (siteId) {
      try {
        const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            build_settings: {
              branch: siteBranch,
              cmd: "npm run build",
              dir: "out",
            },
          }),
        });

        if (patchRes.ok) {
          const patchedData = await patchRes.json();
          data.build_settings = patchedData.build_settings || data.build_settings;
        }
      } catch (err) {
        console.warn("Build settings PATCH failed (non-fatal):", err);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Netlify site create error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Netlify setup failed: ${msg}` }, { status: 500 });
  }
}
