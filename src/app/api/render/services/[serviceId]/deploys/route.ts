import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

const RENDER_BASE = "https://api.render.com/v1";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const res = await fetch(`${RENDER_BASE}/services/${encodeURIComponent(serviceId)}/deploys?limit=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Render service deploys list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const body = await req.json();
    const res = await fetch(`${RENDER_BASE}/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || { clearCache: "dont_clear" }),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Render service deploy trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
