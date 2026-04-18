import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Create a Netlify site.
 *
 * Simple, reliable approach:
 * 1. Always use a UUID suffix to guarantee unique site name
 * 2. Create a bare site (minimal payload = minimal failure surface)
 * 3. Configure build settings via separate PATCH
 * 4. Return the site URL immediately
 *
 * Cross-system: Accepts X-GitHub-Token to resolve repo metadata.
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Netlify token required. Add your token in Settings." }, { status: 401 });
    }

    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    const body = await req.json();
    const { name, repoUrl, branch } = body;
    const siteBranch = branch || "main";

    // Generate guaranteed-unique site name using UUID suffix
    const baseName = (name || "site")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .substring(0, 30);
    const uniqueName = `${baseName}-${crypto.randomUUID().split("-")[0]}`;

    console.log(`Creating Netlify site: ${uniqueName}`);

    // Step 1: Create bare site (smallest possible payload)
    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: uniqueName,
      }),
    });

    if (!createRes.ok) {
      // Read raw response — handle both JSON and non-JSON
      const raw = await createRes.text().catch(() => "");
      let errMsg = raw.substring(0, 300);
      try {
        const j = JSON.parse(raw);
        errMsg = j.message || j.error || j.code || errMsg;
      } catch { /* keep raw text */ }
      console.error(`Netlify create failed (${createRes.status}):`, errMsg);
      return NextResponse.json({
        error: `Netlify rejected the site creation (${createRes.status}): ${errMsg}. Check that your Netlify token is valid and has site creation permissions.`,
      }, { status: createRes.status });
    }

    const site = await createRes.json() as Record<string, unknown>;
    const siteId = site.id as string;
    const siteUrl = (site.ssl_url as string) || (site.url as string) || `https://${uniqueName}.netlify.app`;

    // Step 2: Configure build settings (non-blocking, best-effort)
    let buildConfigured = false;
    if (siteId) {
      try {
        const patchBody: Record<string, unknown> = {
          build_settings: {
            branch: siteBranch,
            cmd: "npm run build",
            dir: "out",
          },
        };

        // Include repo URL as reference if available
        if (repoUrl) {
          patchBody.repo_url = repoUrl;
        }

        const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        });

        buildConfigured = patchRes.ok;
        if (!patchRes.ok) {
          console.warn(`Build config PATCH failed (${patchRes.status}):`, await patchRes.text().catch(() => ""));
        }
      } catch (err) {
        console.warn("Build config error:", err);
      }
    }

    // Step 3: Return clean response
    return NextResponse.json({
      id: siteId,
      name: uniqueName,
      url: siteUrl,
      state: site.state || "created",
      build_configured: buildConfigured,
      message: buildConfigured
        ? `Site created with build settings. Connect your repo at https://app.netlify.com/sites/${uniqueName}/configuration`
        : `Site created. Go to https://app.netlify.com/sites/${uniqueName}/configuration to connect your GitHub repo and configure build settings.`,
    });
  } catch (error) {
    console.error("Netlify site create error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create Netlify site: ${msg}` }, { status: 500 });
  }
}
