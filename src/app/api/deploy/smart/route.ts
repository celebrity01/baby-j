import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import { analyzeRepository } from "@/lib/deployment/analyzer";
import { deploymentEngine } from "@/lib/deployment/engine";

export async function POST(req: NextRequest) {
  try {
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    const vercelToken = sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || "");
    const netlifyToken = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    const renderToken = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");

    if (!githubToken) {
      return NextResponse.json({ error: "GitHub token required" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Owner and repo are required" }, { status: 400 });
    }

    // 1. Analyze
    const analysis = await analyzeRepository(githubToken, owner, repo);

    // 2. Select token
    let providerToken = "";
    const provider = analysis.recommendedProvider;

    if (provider === 'vercel') providerToken = vercelToken;
    else if (provider === 'netlify') providerToken = netlifyToken;
    else if (provider === 'render') providerToken = renderToken;
    else if (provider === 'github-pages') providerToken = githubToken;

    if (!providerToken) {
      return NextResponse.json({
        error: `Recommended provider ${provider} token missing`,
        analysis
      }, { status: 400 });
    }

    // 3. Create & Deploy
    const result = await deploymentEngine.createProject(provider, providerToken, {
      name: repo,
      repoOwner: owner,
      repoName: repo,
      repoUrl: `https://github.com/${owner}/${repo}`,
      branch: branch || "main",
    }, githubToken);

    return NextResponse.json({
      success: true,
      provider,
      analysis,
      result
    });

  } catch (error) {
    console.error("Smart deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
