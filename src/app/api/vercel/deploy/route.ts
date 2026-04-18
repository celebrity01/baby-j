import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-Vercel-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-Vercel-Token header" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId in request body" }, { status: 400 });
    }

    // Step 1: Fetch the latest production deployment to use as a template
    const listRes = await fetch(
      `https://api.vercel.com/v13/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!listRes.ok) {
      const errData = await listRes.json().catch(() => ({}));
      const message = errData?.error?.message || errData?.error || `Failed to fetch deployments: ${listRes.status}`;
      return NextResponse.json({ error: message }, { status: listRes.status });
    }

    const listData = await listRes.json();
    const deployments = listData.deployments || [];

    if (deployments.length === 0) {
      // No production deployment exists yet — try to trigger a deployment via the project deploy hook
      // Fall back to creating a deployment using the project's git source
      const projectRes = await fetch(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (!projectRes.ok) {
        const errData = await projectRes.json().catch(() => ({}));
        const message = errData?.error?.message || `Failed to fetch project: ${projectRes.status}`;
        return NextResponse.json({ error: message }, { status: projectRes.status });
      }

      const project = await projectRes.json();
      const link = project.link;
      const repoName = link?.repo || project.name;

      // Create a new deployment using git source
      const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: project.name,
          project: projectId,
          target: "production",
          gitSource: link
            ? {
                type: "github",
                ref: link.branch || "main",
                repositoryId: link.type === "github" ? link.repoId : undefined,
              }
            : undefined,
        }),
      });

      const deployData = await deployRes.json();

      if (!deployRes.ok) {
        const message = deployData?.error?.message || deployData?.error || `Deploy failed: ${deployRes.status}`;
        return NextResponse.json({ error: message }, { status: deployRes.status });
      }

      return NextResponse.json(deployData);
    }

    // Step 2: Use the latest deployment as a template for a new deployment
    const latest = deployments[0];

    const deployPayload: Record<string, unknown> = {
      name: latest.name,
      project: projectId,
      target: "production",
      source: latest.source,
    };

    // Include gitSource if available (for git-linked projects)
    if (latest.gitSource) {
      deployPayload.gitSource = latest.gitSource;
    }

    // Include meta and project settings if available
    if (latest.meta) {
      deployPayload.meta = latest.meta;
    }
    if (latest.projectSettings) {
      deployPayload.projectSettings = latest.projectSettings;
    }

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deployPayload),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      const message = deployData?.error?.message || deployData?.error || `Deploy failed: ${deployRes.status}`;
      return NextResponse.json({ error: message }, { status: deployRes.status });
    }

    // Return the deployment data with the URL
    return NextResponse.json({
      ...deployData,
      // Vercel returns the URL in `alias` array or `url` field
      url: deployData.alias?.[0] || deployData.url || latest.url,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
