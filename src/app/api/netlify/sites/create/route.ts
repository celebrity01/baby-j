import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * NETLIFY — Create Site API Route
 *
 * Based on official Netlify API documentation:
 * https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
 *
 * APPROACH:
 * 1. Create a bare Netlify site (POST /api/v1/sites with { name })
 *    - Bare site creation ALWAYS works with a valid PAT
 *    - No repo linking — avoids 422 errors entirely
 *
 * 2. Configure build settings (PATCH /api/v1/sites/{id})
 *    - Sets branch, build command, publish directory
 *
 * 3. Return site URL + admin URL for manual repo connection
 *    - The user connects their GitHub repo in the Netlify dashboard
 *    - Netlify automatically builds on push once connected
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json(
        { error: "Netlify token required. Add your token in Settings." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, repoUrl, branch } = body;
    const siteName = (name || "my-site")
      .replace(/[^a-zA-Z0-9\-]/g, "")
      .toLowerCase()
      .substring(0, 50);

    // ─────────────────────────────────────────────
    // Step 1: Create bare Netlify site
    // ─────────────────────────────────────────────
    console.log(`[Netlify] Creating bare site: ${siteName}`);

    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: siteName }),
    });

    if (!createRes.ok) {
      const raw = await createRes.text().catch(() => "");
      let errMsg = raw.substring(0, 300);
      try {
        const j = JSON.parse(raw);
        errMsg = j.message || j.error || errMsg;
      } catch { /* keep raw */ }
      console.error(`[Netlify] Site creation failed (${createRes.status}):`, errMsg);
      return NextResponse.json({
        error: `Netlify rejected site creation (${createRes.status}): ${errMsg}`,
        hint: "Check that your Netlify token is valid and has site creation permissions.",
      }, { status: createRes.status });
    }

    const site = (await createRes.json()) as Record<string, unknown>;
    const siteId = site.id as string;
    const siteUrl = (site.ssl_url as string) || (site.url as string) || "";
    const adminUrl = (site.admin_url as string) || `https://app.netlify.com/sites/${siteName}`;

    console.log(`[Netlify] Site created: id=${siteId}, url=${siteUrl}`);

    // ─────────────────────────────────────────────
    // Step 2: Configure build settings
    // ─────────────────────────────────────────────
    const siteBranch = branch || "main";
    let buildConfigured = false;

    try {
      const patchRes = await fetch(
        `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`,
        {
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
        }
      );

      buildConfigured = patchRes.ok;
      if (!patchRes.ok) {
        console.warn(`[Netlify] Build config failed (${patchRes.status})`);
      }
    } catch (err) {
      console.warn("[Netlify] Build config error:", err);
    }

    // ─────────────────────────────────────────────
    // Step 3: Return result with next steps
    // ─────────────────────────────────────────────
    return NextResponse.json({
      id: siteId,
      name: siteName,
      url: siteUrl,
      admin_url: adminUrl,
      build_configured: buildConfigured,
      success: true,
      needs_manual_repo_link: true,
      message: buildConfigured
        ? `Site "${siteName}" created with build settings configured. Go to your Netlify dashboard to connect your GitHub repo and start deploying.`
        : `Site "${siteName}" created. Go to your Netlify dashboard to connect your GitHub repo and configure build settings.`,
      dashboard_link: adminUrl,
      setup_steps: [
        { step: 1, text: "Site created on Netlify", done: true },
        { step: 2, text: buildConfigured ? "Build settings configured" : "Configure build settings manually", done: buildConfigured },
        { step: 3, text: "Connect GitHub repo in Netlify dashboard", done: false, link: adminUrl },
        { step: 4, text: "Push to repo — Netlify auto-deploys", done: false },
      ],
    });
  } catch (error) {
    console.error("[Netlify] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Netlify error: ${msg}` }, { status: 500 });
  }
}
