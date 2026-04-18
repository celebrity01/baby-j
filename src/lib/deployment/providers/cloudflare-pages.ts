import {
  DeploymentProvider,
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams
} from '../types';

export class CloudflarePagesProvider implements DeploymentProvider {
  type: ProviderType = 'cloudflare-pages';
  private apiBase = 'https://api.cloudflare.com/client/v4';

  async listProjects(token: string): Promise<DeploymentProject[]> {
    // Note: Cloudflare usually requires accountId in the URL.
    // Format: "accountId:apiKey"
    const [accountId, apiKey] = token.split(':');
    if (!accountId || !apiKey) return [];

    const res = await fetch(`${this.apiBase}/accounts/${accountId}/pages/projects`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Cloudflare error: ${res.status}`);
    const data = await res.json();
    return (data.result || []).map((p: any) => ({
      id: p.name,
      name: p.name,
      url: p.subdomain,
      provider: this.type,
      lastUpdated: p.latest_deployment?.modified_on,
    }));
  }

  async createProject(token: string, params: DeployParams): Promise<DeploymentResult> {
    const [accountId, apiKey] = token.split(':');
    const { name, repoOwner, repoName, branch } = params;
    if (!accountId || !apiKey) return { success: false, message: "Missing Cloudflare Account ID or API Key (format: accountId:apiKey)" };

    const res = await fetch(`${this.apiBase}/accounts/${accountId}/pages/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        production_branch: branch || "main",
        build_config: {
          build_command: "npm run build",
          destination_dir: "out",
        },
        source: {
          type: "github",
          config: {
            owner: repoOwner,
            repo_name: repoName,
            production_branch: branch || "main",
            pr_comments_enabled: true,
            deployments_enabled: true,
          }
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, message: data.errors?.[0]?.message || "Failed to create Cloudflare Pages project" };

    return {
      success: true,
      projectId: data.result.name,
      url: data.result.subdomain,
      message: `Project "${name}" created on Cloudflare Pages.`,
      dashboardLink: `https://dash.cloudflare.com/${accountId}/pages/view/${name}`,
      setupSteps: [
        { step: 1, text: "Project created on Cloudflare Pages", done: true },
        { step: 2, text: "GitHub repo linked", done: true },
      ],
    };
  }

  async deploy(token: string, params: DeployParams): Promise<DeploymentResult> {
    const [accountId, apiKey] = token.split(':');
    const { name } = params;
    if (!accountId || !apiKey || !name) return { success: false, message: "Missing parameters" };

    const res = await fetch(`${this.apiBase}/accounts/${accountId}/pages/projects/${name}/deployments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok) return { success: false, message: data.errors?.[0]?.message || "Cloudflare deploy failed" };

    return {
      success: true,
      projectId: name,
      deploymentId: data.result.id,
      url: data.result.url,
      message: "Deployment triggered successfully",
    };
  }

  async getStatus(token: string, projectId: string, deploymentId?: string): Promise<DeploymentResult> {
    const [accountId, apiKey] = token.split(':');
    if (!accountId || !apiKey || !deploymentId) return { success: false, message: "Missing parameters" };

    const res = await fetch(`${this.apiBase}/accounts/${accountId}/pages/projects/${projectId}/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { success: false, message: "Failed to fetch status" };
    const data = await res.json();

    return {
      success: true,
      projectId,
      deploymentId,
      message: `Status: ${data.result.latest_stage.status}`,
    };
  }
}
