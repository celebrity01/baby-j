import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Vercel-Token header" }, { status: 401 });
    }
    const res = await fetch("https://api.vercel.com/v9/projects?limit=100", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data.projects || [], { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
