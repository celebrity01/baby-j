import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Netlify-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { name, repoUrl, branch } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing site name" }, { status: 400 });
    }

    // Strategy: First try creating the site WITH repo link (requires GitHub App installation).
    // If that fails (e.g. 422 because no GitHub App installed), fall back to creating
    // the site without repo, then configure build settings separately.
    let data: Record<string, unknown>;

    if (repoUrl) {
      // Attempt 1: Create site with GitHub repo link
      const linkedRes = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          repo: {
            repo_url: repoUrl,
            branch: branch || "main",
            cmd: "npm run build",
            dir: "out",
            provider: "github",
          },
        }),
      });

      if (linkedRes.ok) {
        data = await linkedRes.json();
        return NextResponse.json(data);
      }

      // If 422 or similar, the GitHub App is likely not installed — fall back
      const errBody = await linkedRes.json().catch(() => ({}));
      console.log("Netlify linked site creation failed, falling back to standalone:", linkedRes.status, errBody);
    }

    // Attempt 2: Create a standalone site (always works with a valid PAT)
    const standaloneRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
      }),
    });

    if (!standaloneRes.ok) {
      const errData = await standaloneRes.json().catch(() => ({}));
      const message = errData?.message || errData?.error || "Failed to create Netlify site";
      return NextResponse.json({ error: String(message) }, { status: standaloneRes.status });
    }

    data = await standaloneRes.json();

    // Now configure build settings on the created site (best-effort)
    const siteId = data.id as string;
    if (siteId) {
      try {
        await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            build_settings: {
              branch: branch || "main",
              cmd: "npm run build",
              dir: "out",
              repo_url: repoUrl,
            },
          }),
        });
      } catch {
        // Build settings update is best-effort — site was still created
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Netlify site create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
