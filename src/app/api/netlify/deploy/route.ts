import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import { deploymentEngine } from "@/lib/deployment/engine";

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

    const result = await deploymentEngine.deploy('netlify', token, { siteId });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Netlify deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
