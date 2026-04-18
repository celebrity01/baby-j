import { NextRequest, NextResponse } from "next/server";
import { getJulesHeaders, JULES_BASE } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const headers = getJulesHeaders(req);
    const res = await fetch(`${JULES_BASE}/sources`, {
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
    console.error("Jules sources error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
