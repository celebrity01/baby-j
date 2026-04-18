import {
  DeploymentProvider,
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams
} from '../types';

export class NetlifyProvider implements DeploymentProvider {
  type: ProviderType = 'netlify';
  private apiBase = 'https://api.netlify.com/api/v1';

  async listProjects(token: string): Promise<DeploymentProject[]> {
    const res = await fetch(`${this.apiBase}/sites?per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Netlify error: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((s: any) => ({
      id: s.id,
      name: s.name || s.id,
      url: s.ssl_url || s.url || s.deploy_ssl_url,
      provider: this.type,
      status: s.state,
      lastUpdated: s.updated_at,
    }));
  }

  async createProject(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { name, repoOwner, repoName, branch } = params;
    const siteName = (name || "my-site")
      .replace(/[^a-zA-Z0-9\-]/g, "")
      .toLowerCase()
      .substring(0, 50);

    const createRes = await fetch(`${this.apiBase}/sites`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: siteName }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      return { success: false, message: errData.message || "Failed to create Netlify site" };
    }

    const site = await createRes.json();
    const siteId = site.id;
    const siteUrl = site.ssl_url || site.url || "";
    const adminUrl = site.admin_url || `https://app.netlify.com/sites/${siteName}`;

    let buildConfigured = false;
    if (repoOwner && repoName) {
      const siteBranch = branch || "main";
      const patchRes = await fetch(`${this.apiBase}/sites/${encodeURIComponent(siteId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          build_settings: {
            branch: siteBranch,
            cmd: "npm run build",
            dir: ".next",
            repo_url: `https://github.com/${repoOwner}/${repoName}`,
          },
        }),
      });
      buildConfigured = patchRes.ok;
    }

    return {
      success: true,
      projectId: siteId,
      url: siteUrl,
      message: buildConfigured
        ? `Site "${siteName}" created with build settings.`
        : `Site "${siteName}" created.`,
      dashboardLink: adminUrl,
      needsManualRepoLink: true,
      setupSteps: [
        { step: 1, text: "Site created on Netlify", done: true },
        { step: 2, text: buildConfigured ? "Build settings configured" : "Configure build settings manually", done: buildConfigured },
        { step: 3, text: "Connect GitHub repo in Netlify dashboard", done: false, link: adminUrl },
      ],
    };
  }

  async deploy(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { siteId } = params;
    if (!siteId) return { success: false, message: "Missing siteId" };

    const res = await fetch(`${this.apiBase}/sites/${encodeURIComponent(siteId)}/builds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Deployed from Baby J Engine" }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || "Netlify deploy failed" };

    return {
      success: true,
      projectId: siteId,
      url: data.ssl_url || data.url || data.deploy_ssl_url,
      message: "Build triggered successfully",
    };
  }

  async getStatus(token: string, projectId: string): Promise<DeploymentResult> {
    const res = await fetch(`${this.apiBase}/sites/${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, message: "Failed to fetch site status" };
    const data = await res.json();
    return {
      success: true,
      projectId,
      url: data.ssl_url || data.url,
      message: `Status: ${data.state}`,
    };
  }
}
