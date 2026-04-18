import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function getJulesHeaders(req: NextRequest): HeadersInit {
  const apiKey = req.headers.get("X-Jules-Api-Key") || "";
  const sanitized = sanitizeHeaderValue(apiKey);
  if (sanitized.startsWith("ya29.")) {
    return { Authorization: `Bearer ${sanitized}` };
  }
  return { "X-Goog-Api-Key": sanitized };
}

const JULES_BASE = "https://jules.googleapis.com/v1alpha";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const headers = getJulesHeaders(req);
    const url = new URL(req.url);
    const pageSize = url.searchParams.get("pageSize") || "100";
    const pageToken = url.searchParams.get("pageToken");
    let fetchUrl = `${JULES_BASE}/sessions/${sessionId}/activities?pageSize=${pageSize}`;
    if (pageToken) fetchUrl += `&pageToken=${pageToken}`;

    const res = await fetch(fetchUrl, {
      headers,
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
