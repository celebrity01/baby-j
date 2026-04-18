import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * VERCEL — Create Project API Route
 *
 * Based on official Vercel REST API documentation:
 * https://vercel.com/docs/rest-api/projects/create-a-new-project
 *
 * APPROACH:
 * 1. Resolve the GitHub repo's numeric ID (required by Vercel's gitSource)
 * 2. Create project with name + gitSource (if numeric ID available)
 * 3. If gitSource linking fails (GitHub App not installed), create bare project
 * 4. Return project URL with clear next steps
 */
export async function POST(req: NextRequest) {
  try {
    const vercelToken = sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || "");
    if (!vercelToken) {
      return NextResponse.json(
        { error: "Vercel token required. Add your token in Settings." },
        { status: 401 }
      );
    }

    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    const body = await req.json();
    const { name, repoOwner, repoName, branch } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }

    const projBranch = branch || "main";
    let numericRepoId: number | null = null;

    // ─────────────────────────────────────────────
    // Step 1: Resolve GitHub repo numeric ID
    // Vercel requires the numeric repo ID, not the owner/name string
    // ─────────────────────────────────────────────
    if (repoOwner && repoName && githubToken) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as Record<string, unknown>;
          numericRepoId = ghData.id as number;
          console.log(`[Vercel] Resolved repo ID: ${numericRepoId}`);
        }
      } catch (err) {
        console.warn("[Vercel] Could not resolve repo ID:", err);
      }
    }

    // ─────────────────────────────────────────────
    // Step 2: Create Vercel project
    // Try WITH gitSource first, fall back to bare project
    // ─────────────────────────────────────────────

    // Attempt 1: With gitSource (requires Vercel GitHub App installed)
    if (numericRepoId) {
      console.log(`[Vercel] Creating project "${name}" with gitSource`);
      const createRes = await fetch("https://api.vercel.com/v9/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          framework: "nextjs",
          gitSource: {
            type: "github",
            repo: numericRepoId,
          },
        }),
      });

      if (createRes.ok) {
        const data = (await createRes.json()) as Record<string, unknown>;
        const projUrl = data.alias?.[0] || data.url || `https://${name}-vercel.app`;
        console.log(`[Vercel] Project created with gitSource: ${projUrl}`);

        return NextResponse.json({
          id: data.id,
          name,
          url: projUrl,
          success: true,
          git_linked: true,
          message: `Project "${name}" created and linked to ${repoOwner}/${repoName}. Vercel will auto-deploy on push to ${projBranch}.`,
          setup_steps: [
            { step: 1, text: "Project created on Vercel", done: true },
            { step: 2, text: "GitHub repo linked", done: true },
            { step: 3, text: `Push to ${projBranch} — Vercel auto-deploys`, done: false },
          ],
        });
      }

      // gitSource failed — log and fall back
      const errText = await createRes.text().catch(() => "");
      console.warn(`[Vercel] gitSource linking failed (${createRes.status}):`, errText.substring(0, 200));
    }

    // Attempt 2: Bare project (no git linking — always works)
    console.log(`[Vercel] Creating bare project "${name}"`);
    const bareRes = await fetch("https://api.vercel.com/v9/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!bareRes.ok) {
      const raw = await bareRes.text().catch(() => "");
      let errMsg = raw.substring(0, 300);
      try {
        const j = JSON.parse(raw);
        errMsg = j.error?.message || j.error || j.message || errMsg;
      } catch { /* keep raw */ }
      console.error(`[Vercel] Project creation failed (${bareRes.status}):`, errMsg);
      return NextResponse.json({
        error: `Vercel rejected project creation (${bareRes.status}): ${errMsg}`,
        hint: "Check your Vercel token has project creation permissions.",
      }, { status: bareRes.status });
    }

    const data = (await bareRes.json()) as Record<string, unknown>;
    const projUrl = data.alias?.[0] || data.url || `https://${name}-vercel.app`;

    console.log(`[Vercel] Bare project created: ${projUrl}`);

    return NextResponse.json({
      id: data.id,
      name,
      url: projUrl,
      success: true,
      git_linked: false,
      message: numericRepoId
        ? `Project "${name}" created. Could not auto-link the GitHub repo — the Vercel GitHub App may not be installed. Go to the Vercel dashboard to import your repo manually.`
        : `Project "${name}" created. Go to the Vercel dashboard to connect your GitHub repo.`,
      dashboard_link: `https://vercel.com/dashboard`,
      setup_steps: [
        { step: 1, text: "Project created on Vercel", done: true },
        { step: 2, text: "Connect GitHub repo in Vercel dashboard", done: false },
        { step: 3, text: "Push to repo — Vercel auto-deploys", done: false },
      ],
    });
  } catch (error) {
    console.error("[Vercel] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Vercel error: ${msg}` }, { status: 500 });
  }
}
