import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * RENDER — List & Create Services API Route
 *
 * Based on official Render API documentation:
 * https://api-docs.render.com/reference/create-service
 *
 * KEY REQUIREMENTS FROM DOCS:
 * - `ownerId` (workspace/team ID) is REQUIRED for service creation
 * - Must first fetch user profile to get the workspace ID
 * - Service creation requires the Render GitHub App to be installed for repo linking
 * - The API key needs team/professional plan permissions
 *
 * APPROACH:
 * GET: List existing services (proxy)
 * POST:
 *   1. Fetch user profile to get ownerId
 *   2. Create web service with proper fields
 *   3. Return service URL with next steps
 */
export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Render-Api-Key header" }, { status: 401 });
    }

    const res = await fetch("https://api.render.com/v1/services?limit=100", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.message || errData?.error || `Failed to list Render services: ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();
    const services = (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: (s.serviceDetails as Record<string, unknown>)?.name || s.name || s.id,
      url: (s.serviceDetails as Record<string, unknown>)?.url || s.url,
      type: s.type,
      state: s.currentState,
    }));

    return NextResponse.json(services);
  } catch (error) {
    console.error("[Render] List error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Render-Api-Key") || "");
    if (!token) {
      return NextResponse.json({ error: "Render API key required. Add your key in Settings." }, { status: 401 });
    }

    const body = await req.json();
    const { name, repoUrl, branch, runtime } = body;

    if (!name) {
      return NextResponse.json({ error: "Service name is required." }, { status: 400 });
    }

    const serviceBranch = branch || "main";

    // ─────────────────────────────────────────────
    // Step 1: Get user's workspace ID (ownerId)
    // This is REQUIRED by the Render API for service creation
    // ─────────────────────────────────────────────
    console.log("[Render] Fetching user profile for workspace ID...");

    const profileRes = await fetch("https://api.render.com/v1/users", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text().catch(() => "");
      console.error(`[Render] Profile fetch failed (${profileRes.status}):`, errText.substring(0, 200));
      return NextResponse.json({
        error: `Could not fetch Render user profile (${profileRes.status}). Check your API key permissions.`,
        hint: "Render API keys require team or professional plan. Create one at dashboard.render.com.",
      }, { status: profileRes.status });
    }

    const profileData = await profileRes.json();
    // The API returns either an array of users or a single user object
    const users = Array.isArray(profileData) ? profileData : [profileData];
    const firstUser = users[0] as Record<string, unknown> | undefined;
    const ownerId = (firstUser?.uid as string) || (firstUser?.id as string) || "";

    if (!ownerId) {
      console.error("[Render] No workspace ID found in profile:", JSON.stringify(profileData).substring(0, 200));
      return NextResponse.json({
        error: "Could not determine your Render workspace ID from the API response.",
        hint: "Make sure your Render API key has the correct permissions for your team.",
      }, { status: 422 });
    }

    console.log(`[Render] Workspace ID: ${ownerId}`);

    // ─────────────────────────────────────────────
    // Step 2: Create web service
    // ─────────────────────────────────────────────
    const servicePayload: Record<string, unknown> = {
      type: "web_service",
      name,
      ownerId,
      serviceDetails: {
        repo: repoUrl || "",
        branch: serviceBranch,
        runtime: runtime || "NODE",
        buildCommand: "npm install && npm run build",
        startCommand: "npm start",
        plan: "free",
        envVars: [
          { key: "NODE_ENV", value: "production" },
        ],
      },
    };

    console.log(`[Render] Creating service "${name}"...`);

    const createRes = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(servicePayload),
    });

    const responseData = await createRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!createRes.ok) {
      const errMsg = (responseData?.message as string) || (responseData?.error as string) || `Failed to create service (${createRes.status})`;
      console.error(`[Render] Service creation failed (${createRes.status}):`, errMsg);

      // Provide specific guidance for common errors
      let hint = "";
      if (createRes.status === 401) {
        hint = "Your Render API key may be invalid or expired. Create a new one at dashboard.render.com.";
      } else if (createRes.status === 403) {
        hint = "Your API key doesn't have permission to create services. Upgrade to a team plan.";
      } else if (createRes.status === 422) {
        hint = "Check that your Render account has GitHub connected. Go to dashboard.render.com to verify.";
      }

      return NextResponse.json({ error: errMsg, hint }, { status: createRes.status });
    }

    // Extract service URL from nested response
    const service = (responseData.service as Record<string, unknown>) || responseData;
    const serviceUrl = (service.serviceDetails as Record<string, unknown>)?.url || service.url || "";
    const serviceId = (service.id as string) || "";
    const serviceState = (service.currentState as string) || "created";

    console.log(`[Render] Service created: id=${serviceId}, url=${serviceUrl}, state=${serviceState}`);

    // ─────────────────────────────────────────────
    // Step 3: Return result
    // ─────────────────────────────────────────────
    return NextResponse.json({
      id: serviceId,
      name,
      url: serviceUrl,
      state: serviceState,
      success: true,
      message: repoUrl
        ? `Service "${name}" created and linked to ${repoUrl}. Render will auto-deploy on push to ${serviceBranch}.`
        : `Service "${name}" created. Go to the Render dashboard to connect your GitHub repo.`,
      dashboard_link: serviceId ? `https://dashboard.render.com/web/${serviceId}` : "https://dashboard.render.com",
      setup_steps: [
        { step: 1, text: "Service created on Render", done: true },
        { step: 2, text: repoUrl ? "GitHub repo linked" : "Connect GitHub repo in Render dashboard", done: !!repoUrl },
        { step: 3, text: `Push to ${serviceBranch} — Render auto-deploys`, done: false },
      ],
    });
  } catch (error) {
    console.error("[Render] Create error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Render error: ${msg}` }, { status: 500 });
  }
}
