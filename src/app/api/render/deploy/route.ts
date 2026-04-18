import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

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

    const res = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clearCache: "dont_clear" }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data?.message || data?.error || `Render deploy failed: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    // Render returns the deploy object — the service URL comes from the service itself
    // For the trigger deploy endpoint, the URL needs to be fetched from the service details
    const url = data?.deploy?.liveUrl || data?.liveUrl;

    return NextResponse.json({
      ...data,
      url,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
