import { NextRequest, NextResponse } from "next/server";
import { getJulesHeaders, JULES_BASE } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const headers = getJulesHeaders(req);
    const res = await fetch(`${JULES_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
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
    console.error("Jules session detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
