import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, params } = body;

    if (!command) {
      return NextResponse.json({ error: "Missing command" }, { status: 400 });
    }

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
          `https://api.render.com/v1/services/${params.serviceId}/deploys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clearCache: "dont_clear" }),
          }
        );
        result = await res.json();
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
          `https://api.render.com/v1/services/${params.serviceId}`,
          {
            headers: { Authorization: `Bearer ${renderApiKey}` },
          }
        );
        result = await res.json();
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
          `https://api.render.com/v1/services/${params.serviceId}/deploys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clearCache: "clear" }),
          }
        );
        result = await res.json();
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
