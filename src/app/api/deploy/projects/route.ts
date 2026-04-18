import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import { deploymentEngine } from "@/lib/deployment/engine";

export async function GET(req: NextRequest) {
  try {
    const tokens: Record<string, string> = {
      'vercel': sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || ""),
      'netlify': sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || ""),
      'render': sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || ""),
      'github-pages': sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || ""),
      'cloudflare-pages': sanitizeHeaderValue(req.headers.get("X-Cloudflare-Token") || ""),
    };

    const projects = await deploymentEngine.listAllProjects(tokens);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("List all projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
