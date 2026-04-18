import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Vercel-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { name, repoOwner, repoName, branch } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing project name" }, { status: 400 });
    }

    const res = await fetch("https://api.vercel.com/v9/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        gitRepository: repoOwner && repoName
          ? {
              type: "github",
              repo: `${repoOwner}/${repoName}`,
              branch: branch || "main",
            }
          : undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data?.error?.message || data?.error || `Failed to create project: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    // Vercel returns project URL in various formats — normalize it
    const url = data.alias?.[0] || data.url || `https://${data.name}-vercel.app`;

    return NextResponse.json({
      ...data,
      url,
    });
  } catch (error) {
    console.error("Vercel project create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
