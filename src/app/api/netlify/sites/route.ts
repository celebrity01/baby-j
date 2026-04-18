import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Netlify-Token header" }, { status: 401 });
    }
    const res = await fetch("https://api.netlify.com/api/v1/sites?per_page=100", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.message || `Failed to list Netlify sites: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();

    // Normalize the response to a consistent format
    const sites = (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name || s.id,
      url: s.ssl_url || s.url || s.deploy_ssl_url,
      state: s.state,
    }));

    return NextResponse.json(sites);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
