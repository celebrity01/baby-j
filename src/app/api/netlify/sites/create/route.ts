import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Netlify-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Netlify-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { name, repoUrl, branch } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing site name" }, { status: 400 });
    }

    const res = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        repo: repoUrl
          ? {
              url: repoUrl,
              branch: branch || "main",
              cmd: "npm run build",
              dir: "out",
            }
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || data?.error || "Upstream request failed";
      return NextResponse.json({ error: String(message) }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Netlify site create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
