import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

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

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.error?.message || errData?.error || `Failed to list Vercel projects: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();

    // Normalize the response to a consistent format
    const projects = (data.projects || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      url: (p.alias as string[] | undefined)?.[0] || (p.targets as Record<string, Record<string, string>>)?.production?.url || `https://${p.name}-vercel.app`,
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Vercel projects list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
