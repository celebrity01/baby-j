import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-GitHub-Token header" }, { status: 401 });
    }
    const body = await req.json();
    const { owner, repo, branch } = body;

    // Check if Pages is already enabled
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
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
        const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
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
        result = await updateRes.json();
      } else {
        result = currentPages;
      }

      // Trigger rebuild
      await fetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
    } else {
      // Enable Pages
      const enableRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
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
      result = await enableRes.json();
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
