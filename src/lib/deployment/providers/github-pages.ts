import {
  DeploymentProvider,
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams
} from '../types';

export class GitHubPagesProvider implements DeploymentProvider {
  type: ProviderType = 'github-pages';
  private apiBase = 'https://api.github.com/repos';

  async listProjects(token: string): Promise<DeploymentProject[]> {
    // This is tricky as GitHub Pages are per-repo.
    // Usually we list repos and check if Pages is enabled, but for brevity:
    const res = await fetch(`https://api.github.com/user/repos?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
    const repos = await res.json();

    // In a real app, we might filter or fetch /pages for each,
    // but here we'll return all repos as potential Pages targets.
    return repos.map((r: any) => ({
      id: r.full_name,
      name: r.name,
      url: `https://${r.owner.login}.github.io/${r.name}/`,
      provider: this.type,
      repoOwner: r.owner.login,
      repoName: r.name,
    }));
  }

  async createProject(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { repoOwner, repoName, branch } = params;
    if (!repoOwner || !repoName) return { success: false, message: "Missing repo info" };

    const siteBranch = branch || "main";
    const pagesUrl = repoOwner.toLowerCase() === repoName.toLowerCase()
      ? `https://${repoOwner}.github.io/`
      : `https://${repoOwner}.github.io/${repoName}/`;

    // Enable Pages
    const enableRes = await fetch(`${this.apiBase}/${repoOwner}/${repoName}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        build_type: "workflow",
        source: { branch: siteBranch, path: "/" },
      }),
    });

    const pagesEnabled = enableRes.ok || enableRes.status === 201 || enableRes.status === 409;

    return {
      success: true,
      projectId: `${repoOwner}/${repoName}`,
      url: pagesUrl,
      message: pagesEnabled
        ? "GitHub Pages configured with workflow source."
        : "Could not enable Pages automatically, manual setup may be required.",
      setupSteps: [
        { step: 1, text: "Pages configuration updated", done: pagesEnabled },
        { step: 2, text: "Push to branch to trigger deployment", done: false },
      ],
    };
  }

  async deploy(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { repoOwner, repoName, branch } = params;
    if (!repoOwner || !repoName) return { success: false, message: "Missing repo info" };

    // Trigger workflow dispatch for deploy-pages.yml
    const res = await fetch(`${this.apiBase}/${repoOwner}/${repoName}/actions/workflows/deploy-pages.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: branch || "main" }),
    });

    if (!res.ok) return { success: false, message: "Failed to trigger workflow" };

    return {
      success: true,
      projectId: `${repoOwner}/${repoName}`,
      message: "GitHub Actions workflow triggered",
    };
  }

  async getStatus(token: string, projectId: string): Promise<DeploymentResult> {
    const [owner, repo] = projectId.split('/');
    const res = await fetch(`${this.apiBase}/${owner}/${repo}/actions/runs?per_page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, message: "Failed to fetch runs" };
    const data = await res.json();
    const run = data.workflow_runs?.[0];

    return {
      success: true,
      projectId,
      message: run ? `Last run: ${run.status} (${run.conclusion})` : "No runs found",
      workflow_url: run?.html_url,
    };
  }
}
