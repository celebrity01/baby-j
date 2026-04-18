import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * NETLIFY — Deploy (Redeploy) API Route (v3)
 *
 * POST /api/netlify/deploy
 * Headers: X-Netlify-Token
 * Body: { siteId }
 *
 * Flow:
 * 1. Fetch site details to check if repo is linked
 * 2. If no repo linked → return helpful error with dashboard link
 * 3. If repo linked → trigger build
 */
export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Netlify-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { siteId } = body;

    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId in request body" }, { status: 400 });
    }

    // ── Step 1: Check site details for linked repo ──
    let siteData: Record<string, unknown> | null = null;
    try {
      const siteRes = await fetch(
        `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (siteRes.ok) {
        siteData = (await siteRes.json()) as Record<string, unknown>;
      }
    } catch (err) {
      console.warn("[Netlify Deploy] Could not fetch site details:", err);
    }

    // Check if repo is linked
    const buildSettings = (siteData?.build_settings as Record<string, unknown>) || {};
    const repoUrl = buildSettings.repo_url as string | undefined;
    const hasRepoLinked = !!repoUrl;
    const adminUrl = (siteData?.admin_url as string) || `https://app.netlify.com/sites/${siteId}`;

    if (!hasRepoLinked) {
      return NextResponse.json({
        error: "This site does not have a GitHub repo linked. Redeploy only works for linked sites.",
        needs_manual_repo_link: true,
        dashboard_link: adminUrl,
        hint: "Connect your GitHub repo in the Netlify dashboard first, then use Redeploy.",
        site_id: siteId,
      }, { status: 422 });
    }

    // ── Step 2: Trigger build on linked site ──
    const res = await fetch(
      `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Deployed from Baby J" }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const message = data?.message || `Netlify deploy failed: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    // Netlify returns the site URL in `ssl_url`, `url`, or `deploy_ssl_url`
    const url = data.ssl_url || data.url || data.deploy_ssl_url;

    return NextResponse.json({
      ...data,
      url,
    });
  } catch (error) {
    console.error("Netlify deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
