import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Jules Deployment Engine API",
    version: "2.0.0",
    providers: ["vercel", "netlify", "render", "github-pages", "cloudflare-pages"],
    endpoints: {
      smart_deploy: "/api/deploy/smart",
      status: "/api/deploy/status"
    }
  });
}
