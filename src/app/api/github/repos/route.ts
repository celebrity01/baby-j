import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue, clampParam } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-GitHub-Token header" }, { status: 401 });
    }
    const url = new URL(req.url);
    const page = clampParam(url.searchParams.get("page"), 1, 100, 1);
    const perPage = clampParam(url.searchParams.get("per_page"), 1, 100, 100);
    const sort = url.searchParams.get("sort") || "updated";

    const res = await fetch(
      `https://api.github.com/user/repos?page=${encodeURIComponent(page)}&per_page=${encodeURIComponent(perPage)}&sort=${encodeURIComponent(sort)}&type=all`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("GitHub repos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
