import { NextRequest, NextResponse } from "next/server";
import { getJulesHeaders, JULES_BASE, clampParam } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const headers = getJulesHeaders(req);
    const url = new URL(req.url);
    const pageSize = clampParam(url.searchParams.get("pageSize"), 1, 100, 100);
    const pageToken = url.searchParams.get("pageToken");
    let fetchUrl = `${JULES_BASE}/sessions/${encodeURIComponent(sessionId)}/activities?pageSize=${encodeURIComponent(pageSize)}`;
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
    console.error("Jules session activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
