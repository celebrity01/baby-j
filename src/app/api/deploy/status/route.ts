import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

/**
 * Check deployment status by monitoring GitHub Actions workflow runs.
 *
 * Accepts either:
 * - workflow_run_id: Direct workflow run ID
 * - owner + repo + workflow_file: Find latest run for a specific workflow
 *
 * Returns the run status, conclusion, and relevant URLs.
 */
export async function POST(req: NextRequest) {
  try {
    const githubToken = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { workflow_run_id, owner, repo, workflow_file } = body;

    if (workflow_run_id) {
      // Direct run ID lookup
      const run = await getWorkflowRun(githubToken, workflow_run_id);
      if (!run) {
        return NextResponse.json(
          { error: "Workflow run not found." },
          { status: 404 }
        );
      }
      return NextResponse.json(formatRunResponse(run));
    }

    if (owner && repo && workflow_file) {
      // Find latest run for a specific workflow file
      const run = await getLatestRunForWorkflow(githubToken, owner, repo, workflow_file);
      if (!run) {
        return NextResponse.json({
          status: "not_found",
          message: "No workflow runs found yet. The workflow may still be registering.",
        });
      }
      return NextResponse.json(formatRunResponse(run));
    }

    return NextResponse.json(
      { error: "Provide either workflow_run_id or (owner, repo, workflow_file)." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Deploy Status] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getWorkflowRun(
  token: string,
  runId: string | number
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `https://api.github.com/repos/---placeholder/actions/runs/${encodeURIComponent(String(runId))}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!res.ok) return null;
  return res.json();
}

async function getLatestRunForWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflowFile: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, unknown>;
  const runs = (data.workflow_runs as Record<string, unknown>[]) || [];
  return runs[0] || null;
}

function formatRunResponse(run: Record<string, unknown>): Record<string, unknown> {
  const status = run.status as string || "unknown";
  const conclusion = run.conclusion as string || null;
  const htmlUrl = run.html_url as string || "";
  const runId = run.id as number;
  const runNumber = run.run_number as number;
  const createdAt = run.created_at as string || "";
  const updatedAt = run.updated_at as string || "";

  // Map GitHub Actions statuses to user-friendly messages
  let displayStatus: string;
  let displayMessage: string;

  switch (status) {
    case "queued":
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

  return {
    run_id: runId,
    run_number: runNumber,
    status: displayStatus,
    conclusion,
    html_url: htmlUrl,
    message: displayMessage,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}
