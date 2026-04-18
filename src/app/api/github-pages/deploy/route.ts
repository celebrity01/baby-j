import { NextRequest, NextResponse } from "next/server";
import { sanitizeHeaderValue } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-GitHub-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 });
    }

    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);

    // Check if Pages is already enabled
    const checkRes = await fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/pages`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    let result;
    if (checkRes.ok) {
      // Pages is enabled - update source branch if needed
      const currentPages = await checkRes.json();
      if (branch && currentPages.source?.branch !== branch) {
        const updateRes = await fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/pages`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: { branch: branch || currentPages.source?.branch, path: "/" },
          }),
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) {
          const message = updateData?.message || updateData?.error || "Failed to update Pages source";
          return NextResponse.json({ error: String(message) }, { status: updateRes.status });
        }
        result = updateData;
      } else {
        result = currentPages;
      }

      // Trigger rebuild
      const rebuildRes = await fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/pages/builds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!rebuildRes.ok) {
        const rebuildData = await rebuildRes.json().catch(() => ({}));
        const message = (rebuildData as Record<string, unknown>)?.message || "Failed to trigger rebuild";
        return NextResponse.json({ error: String(message) }, { status: rebuildRes.status });
      }
    } else {
      // Enable Pages
      const enableRes = await fetch(`https://api.github.com/repos/${encodedOwner}/${encodedRepo}/pages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: { branch: branch || "main", path: "/" },
        }),
      });
      const enableData = await enableRes.json();
      if (!enableRes.ok) {
        const message = enableData?.message || enableData?.error || "Failed to enable Pages";
        return NextResponse.json({ error: String(message) }, { status: enableRes.status });
      }
      result = enableData;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GitHub Pages deploy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
