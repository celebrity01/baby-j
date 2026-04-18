import {
  DeploymentProvider,
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams
} from '../types';

export class RenderProvider implements DeploymentProvider {
  type: ProviderType = 'render';
  private apiBase = 'https://api.render.com/v1';

  async listProjects(token: string): Promise<DeploymentProject[]> {
    const res = await fetch(`${this.apiBase}/services?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Render error: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((s: any) => ({
      id: s.id,
      name: s.serviceDetails?.name || s.name || s.id,
      url: s.serviceDetails?.url || s.url,
      provider: this.type,
      status: s.currentState,
      lastUpdated: s.updatedAt,
    }));
  }

  async createProject(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { name, repoUrl, branch, runtime } = params;

    // Get ownerId (workspace ID)
    const profileRes = await fetch(`${this.apiBase}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileRes.ok) return { success: false, message: "Could not fetch Render user profile" };
    const profileData = await profileRes.json();
    const users = Array.isArray(profileData) ? profileData : [profileData];
    const ownerId = users[0]?.id || users[0]?.uid;
    if (!ownerId) return { success: false, message: "Could not determine ownerId" };

    const servicePayload = {
      type: "web_service",
      name,
      ownerId,
      serviceDetails: {
        repo: repoUrl || "",
        branch: branch || "main",
        runtime: runtime || "NODE",
        buildCommand: "npm install && npm run build",
        startCommand: "npm start",
        plan: "free",
        envVars: [{ key: "NODE_ENV", value: "production" }],
      },
    };

    const createRes = await fetch(`${this.apiBase}/services`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(servicePayload),
    });

    const data = await createRes.json();
    if (!createRes.ok) return { success: false, message: data.message || "Failed to create Render service" };

    const service = data.service || data;
    const serviceId = service.id;
    const serviceUrl = service.serviceDetails?.url || service.url || "";

    return {
      success: true,
      projectId: serviceId,
      url: serviceUrl,
      message: `Service "${name}" created.`,
      dashboardLink: `https://dashboard.render.com/web/${serviceId}`,
      setupSteps: [
        { step: 1, text: "Service created on Render", done: true },
        { step: 2, text: repoUrl ? "GitHub repo linked" : "Connect GitHub repo in Render dashboard", done: !!repoUrl },
      ],
    };
  }

  async deploy(token: string, params: DeployParams): Promise<DeploymentResult> {
    const { serviceId } = params;
    if (!serviceId) return { success: false, message: "Missing serviceId" };

    const res = await fetch(`${this.apiBase}/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clearCache: "dont_clear" }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || "Render deploy failed" };

    return {
      success: true,
      projectId: serviceId,
      deploymentId: data.id,
      url: data.liveUrl || data.deploy?.liveUrl,
      message: "Deployment triggered successfully",
    };
  }

  async getStatus(token: string, projectId: string, deploymentId?: string): Promise<DeploymentResult> {
    const url = deploymentId
      ? `${this.apiBase}/services/${projectId}/deploys/${deploymentId}`
      : `${this.apiBase}/services/${projectId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, message: "Failed to fetch status" };
    const data = await res.json();

    return {
      success: true,
      projectId,
      message: `Status: ${data.status || data.currentState}`,
    };
  }
}
