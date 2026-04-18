import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * DEPLOY STATUS — Monitor deployment progress API Route
 *
 * Checks GitHub Actions workflow run status for GitHub Pages deployments.
 * Returns user-friendly status messages.
 */
export async function POST(req: NextRequest) {
  try {
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!githubToken) {
      return NextResponse.json({ error: "GitHub token required." }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, workflow_file } = body;

    if (!owner || !repo || !workflow_file) {
      return NextResponse.json(
        { error: "owner, repo, and workflow_file are required." },
        { status: 400 }
      );
    }

    // Fetch latest run for the specified workflow
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow_file)}/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        status: "not_found",
        message: "Could not fetch workflow runs. The workflow may still be registering.",
      });
    }

    const data = (await res.json()) as Record<string, unknown>;
    const runs = (data.workflow_runs as Record<string, unknown>[]) || [];

    if (runs.length === 0) {
      return NextResponse.json({
        status: "not_found",
        message: "No workflow runs found yet. The workflow may still be registering.",
      });
    }

    const run = runs[0];
    const status = run.status as string || "unknown";
    const conclusion = run.conclusion as string || null;
    const htmlUrl = run.html_url as string || "";
    const runId = run.id as number;
    const createdAt = run.created_at as string || "";

    // Map to user-friendly status
    let displayStatus: string;
    let displayMessage: string;

    switch (status) {
      case "queued":
      case "waiting":
      case "pending":
      case "requested":
        displayStatus = "queued";
        displayMessage = "Deployment is queued and waiting to start...";
        break;
      case "in_progress":
        displayStatus = "running";
        displayMessage = "Deployment is in progress. Building and deploying your site...";
        break;
      case "completed":
        if (conclusion === "success") {
          displayStatus = "success";
          displayMessage = "Deployment completed successfully!";
        } else if (conclusion === "failure") {
          displayStatus = "failed";
          displayMessage = "Deployment failed. Check the workflow logs for details.";
        } else if (conclusion === "cancelled") {
          displayStatus = "cancelled";
          displayMessage = "Deployment was cancelled.";
        } else {
          displayStatus = conclusion || "unknown";
          displayMessage = `Deployment finished with status: ${conclusion}`;
        }
        break;
      default:
        displayStatus = status;
        displayMessage = `Deployment status: ${status}`;
    }

    return NextResponse.json({
      run_id: runId,
      status: displayStatus,
      conclusion,
      html_url: htmlUrl,
      message: displayMessage,
      created_at: createdAt,
    });
  } catch (error) {
    console.error("[Deploy Status] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
