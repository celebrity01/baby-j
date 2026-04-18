import { NextRequest, NextResponse } from "next/server";
import { getJulesHeaders, JULES_BASE } from "@/lib/api-utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const headers = getJulesHeaders(req);
    const body = await req.json();
    const res = await fetch(`${JULES_BASE}/sessions/${encodeURIComponent(sessionId)}/message`, {
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
    console.error("Jules session message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
