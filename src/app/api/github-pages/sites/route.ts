import { NextRequest, NextResponse } from "next/server";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeHeaderValue(req.headers.get("X-GitHub-Token") || "");
    if (!token) {
      return NextResponse.json({ error: "Missing X-GitHub-Token header" }, { status: 401 });
    }
    // List repos with Pages enabled
    const res = await fetch("https://api.github.com/user/repos?per_page=100", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    const repos = await res.json();

    // Check each repo for Pages status
    const pagesSites = await Promise.allSettled(
      (repos || [])
        .filter((r: { has_pages?: boolean }) => r.has_pages)
        .slice(0, 20)
        .map(async (repo: { name: string; owner: { login: string }; html_url: string }) => {
          const pagesRes = await fetch(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/pages`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
              },
              cache: "no-store",
            }
          );
          if (pagesRes.ok) {
            const pagesData = await pagesRes.json();
            return { ...pagesData, repo_name: repo.name, repo_url: repo.html_url };
          }
          return null;
        })
    );

    const sites = pagesSites
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => (r as { status: "fulfilled"; value: unknown }).value);

    return NextResponse.json(sites);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
