import { NextRequest, NextResponse } from "next/server";
import { getJulesHeaders, JULES_BASE, clampParam } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const headers = getJulesHeaders(req);
    const url = new URL(req.url);
    const pageSize = clampParam(url.searchParams.get("pageSize"), 1, 100, 50);
    const pageToken = url.searchParams.get("pageToken");
    let fetchUrl = `${JULES_BASE}/sessions?pageSize=${encodeURIComponent(pageSize)}`;
    if (pageToken) fetchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res = await fetch(fetchUrl, {
      headers,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.error?.message || data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Jules sessions list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headers = getJulesHeaders(req);
    const body = await req.json();
    const res = await fetch(`${JULES_BASE}/sessions`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.error?.message || data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Jules sessions create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
