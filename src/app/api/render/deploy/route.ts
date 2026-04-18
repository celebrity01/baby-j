import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";
import { deploymentEngine } from "@/lib/deployment/engine";

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const body = await req.json();
    const { serviceId } = body;

    if (!serviceId) {
      return NextResponse.json({ error: "Missing serviceId in request body" }, { status: 400 });
    }

    const result = await deploymentEngine.deploy('render', token, { serviceId });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Render deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
