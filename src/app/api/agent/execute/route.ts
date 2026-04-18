import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, params } = body;

    if (!command) {
      return NextResponse.json({ error: "Missing command" }, { status: 400 });
    }

    const safeCommand = sanitizeHeaderValue(command);

    let result: Record<string, unknown>;

    switch (command) {
      case "deploy_to_render": {
        const renderApiKey = sanitizeHeaderValue(params?.renderApiKey || "");
        if (!renderApiKey) {
          return NextResponse.json({ error: "Missing renderApiKey" }, { status: 400 });
        }
        if (!params?.serviceId) {
          return NextResponse.json({ error: "Missing serviceId" }, { status: 400 });
        }
        const res = await fetch(
          `https://api.render.com/v1/services/${encodeURIComponent(params.serviceId)}/deploys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clearCache: "dont_clear" }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error || data?.message || "Upstream request failed";
          return NextResponse.json({ error: String(message) }, { status: res.status });
        }
        result = data;
        break;
      }
      case "check_render_status": {
        const renderApiKey = sanitizeHeaderValue(params?.renderApiKey || "");
        if (!renderApiKey) {
          return NextResponse.json({ error: "Missing renderApiKey" }, { status: 400 });
        }
        if (!params?.serviceId) {
          return NextResponse.json({ error: "Missing serviceId" }, { status: 400 });
        }
        const res = await fetch(
          `https://api.render.com/v1/services/${encodeURIComponent(params.serviceId)}`,
          {
            headers: { Authorization: `Bearer ${renderApiKey}` },
          }
        );
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error || data?.message || "Upstream request failed";
          return NextResponse.json({ error: String(message) }, { status: res.status });
        }
        result = data;
        break;
      }
      case "restart_render_service": {
        const renderApiKey = sanitizeHeaderValue(params?.renderApiKey || "");
        if (!renderApiKey) {
          return NextResponse.json({ error: "Missing renderApiKey" }, { status: 400 });
        }
        if (!params?.serviceId) {
          return NextResponse.json({ error: "Missing serviceId" }, { status: 400 });
        }
        const res = await fetch(
          `https://api.render.com/v1/services/${encodeURIComponent(params.serviceId)}/deploys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clearCache: "clear" }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error || data?.message || "Upstream request failed";
          return NextResponse.json({ error: String(message) }, { status: res.status });
        }
        result = data;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown command: ${safeCommand}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent execute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
