import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-GitHub-Token header" }, { status: 401 });
    }
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("GitHub user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
