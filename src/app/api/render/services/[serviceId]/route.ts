import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

const RENDER_BASE = "https://api.render.com/v1";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const res = await fetch(`${RENDER_BASE}/services/${serviceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const body = await req.json();
    const res = await fetch(`${RENDER_BASE}/services/${serviceId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }
    const res = await fetch(`${RENDER_BASE}/services/${serviceId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    return NextResponse.json({}, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
