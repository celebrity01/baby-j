import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import { deploymentEngine } from "@/lib/deployment/engine";

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

    // This route usually handles BOTH creation/enablement and triggering.
    // In our engine, createProject handles enablement.

    const result = await deploymentEngine.createProject('github-pages', githubToken, {
      repoOwner: owner,
      repoName: repo,
      branch: branch || "main"
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    // Trigger deployment
    const deployResult = await deploymentEngine.deploy('github-pages', githubToken, {
      repoOwner: owner,
      repoName: repo,
      branch: branch || "main"
    });

    return NextResponse.json({
      ...result,
      ...deployResult,
      success: result.success && deployResult.success
    });

  } catch (error) {
    console.error("[GitHub Pages] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `GitHub Pages error: ${msg}` }, { status: 500 });
  }
}
