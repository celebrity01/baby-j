import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const res = await fetch("https://api.render.com/v1/services?limit=100", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.message || errData?.error || `Failed to list Render services: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();

    // Normalize the response to a consistent format
    const services = (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: (s.serviceDetails as Record<string, unknown>)?.name || s.name || s.id,
      url: (s.serviceDetails as Record<string, unknown>)?.url || s.url,
      type: s.type,
      state: s.state,
    }));

    return NextResponse.json(services);
  } catch (error) {
    console.error("Render services list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const body = await req.json();

    const res = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      const message = data?.message || data?.error || `Failed to create Render service: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const url = data?.serviceDetails?.url || data?.url;

    return NextResponse.json({
      ...data,
      url,
    });
  } catch (error) {
    console.error("Render service create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
