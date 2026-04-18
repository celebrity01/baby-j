import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

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

    const res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/builds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Deployed from Jules Super Agent" }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data?.message || `Netlify deploy failed: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    // Netlify returns the site URL in `ssl_url`, `url`, or `deploy_ssl_url`
    const url = data.ssl_url || data.url || data.deploy_ssl_url;

    return NextResponse.json({
      ...data,
      url,
    });
  } catch (error) {
    console.error("Netlify deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
