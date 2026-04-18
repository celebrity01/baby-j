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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const headers = getJulesHeaders(req);
    const body = await req.json();
    const res = await fetch(`${JULES_BASE}/sessions/${sessionId}/message`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
