import {
  DeploymentProvider,
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams
} from '../types';

export class VercelProvider implements DeploymentProvider {
  type: ProviderType = 'vercel';
  private apiBase = 'https://api.vercel.com';

  async listProjects(token: string): Promise<DeploymentProject[]> {
    const res = await fetch(`${this.apiBase}/v9/projects?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Vercel error: ${res.status}`);
    const data = await res.json();
    return (data.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      url: p.alias?.[0] || p.targets?.production?.url || `https://${p.name}.vercel.app`,
      provider: this.type,
      lastUpdated: p.updatedAt,
    }));
  }

  async createProject(token: string, params: DeployParams, githubToken?: string): Promise<DeploymentResult> {
    const { name, repoOwner, repoName, branch } = params;
    const projBranch = branch || "main";
    let numericRepoId: number | null = null;

    if (repoOwner && repoName && githubToken) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          numericRepoId = ghData.id;
        }
      } catch (err) {
        console.warn("[Vercel] Could not resolve repo ID:", err);
      }
    }

    if (numericRepoId) {
      const createRes = await fetch(`${this.apiBase}/v9/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          framework: "nextjs",
          gitSource: { type: "github", repo: numericRepoId },
        }),
      });

      if (createRes.ok) {
        const data = await createRes.json();
        const projUrl = data.alias?.[0] || data.url || `https://${name}.vercel.app`;
        return {
          success: true,
          projectId: data.id,
          url: projUrl,
          message: `Project "${name}" created and linked to ${repoOwner}/${repoName}.`,
          setupSteps: [
            { step: 1, text: "Project created on Vercel", done: true },
            { step: 2, text: "GitHub repo linked", done: true },
            { step: 3, text: `Push to ${projBranch} — Vercel auto-deploys`, done: false },
          ],
        };
      }
    }

    const bareRes = await fetch(`${this.apiBase}/v9/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!bareRes.ok) {
      const errData = await bareRes.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error?.message || "Failed to create Vercel project"
      };
    }

    const data = await bareRes.json();
    const projUrl = data.alias?.[0] || data.url || `https://${name}.vercel.app`;
    return {
      success: true,
      projectId: data.id,
      url: projUrl,
      message: `Project "${name}" created (bare).`,
      dashboardLink: `https://vercel.com/dashboard`,
      setupSteps: [
        { step: 1, text: "Project created on Vercel", done: true },
        { step: 2, text: "Connect GitHub repo in Vercel dashboard", done: false },
      ],
    };
  }

  async deploy(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { projectId } = params;
    if (!projectId) return { success: false, message: "Missing projectId" };

    const listRes = await fetch(
      `${this.apiBase}/v13/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) return { success: false, message: "Failed to fetch latest deployment" };
    const listData = await listRes.json();
    const deployments = listData.deployments || [];

    let deployPayload: any;

    if (deployments.length === 0) {
      const projectRes = await fetch(`${this.apiBase}/v9/projects/${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!projectRes.ok) return { success: false, message: "Failed to fetch project" };
      const project = await projectRes.json();
      deployPayload = {
        name: project.name,
        project: projectId,
        target: "production",
        gitSource: project.link ? {
          type: "github",
          ref: project.link.branch || "main",
          repositoryId: project.link.type === "github" ? project.link.repoId : undefined,
        } : undefined,
      };
    } else {
      const latest = deployments[0];
      deployPayload = {
        name: latest.name,
        project: projectId,
        target: "production",
        source: latest.source,
        gitSource: latest.gitSource,
        meta: latest.meta,
        projectSettings: latest.projectSettings,
      };
    }

    const deployRes = await fetch(`${this.apiBase}/v13/deployments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deployPayload),
    });

    const deployData = await deployRes.json();
    if (!deployRes.ok) return { success: false, message: deployData.error?.message || "Deploy failed" };

    return {
      success: true,
      projectId,
      deploymentId: deployData.id,
      url: deployData.alias?.[0] || deployData.url,
      message: "Deployment triggered successfully",
    };
  }

  async getStatus(token: string, projectId: string, deploymentId?: string): Promise<DeploymentResult> {
    if (!deploymentId) return { success: false, message: "Missing deploymentId" };
    const res = await fetch(`${this.apiBase}/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, message: "Failed to fetch status" };
    const data = await res.json();

    return {
      success: true,
      projectId,
      deploymentId,
      url: data.url,
      message: `Status: ${data.status}`,
      // Map Vercel status to common ones if needed
    };
  }
}
