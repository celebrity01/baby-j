// Agent Commands - Cross-service command system for autonomous agent operations

interface ServiceMeshContext {
  jules: {
    active: boolean;
    sourcesCount: number;
    activeSessions: number;
  };
  render: {
    connected: boolean;
    servicesCount: number;
  };
  github: {
    connected: boolean;
    reposCount: number;
  };
}

/**
 * Build a system prompt describing available services for the AI agent
 */
export function buildAgentSystemPrompt(context: ServiceMeshContext): string {
  const services: string[] = [];

  if (context.jules.active) {
    services.push(
      `- Jules AI Agent: Active with ${context.jules.sourcesCount} source(s) connected and ${context.jules.activeSessions} active session(s)`
    );
  }

  if (context.render.connected) {
    services.push(
      `- Render: Connected with ${context.render.servicesCount} service(s). Can deploy, restart, and check status.`
    );
  }

  if (context.github.connected) {
    services.push(
      `- GitHub: Connected with access to ${context.github.reposCount} repository(s). Can create repos, manage branches, and deploy to GitHub Pages.`
    );
  }

  if (services.length === 0) {
    return "No external services are currently connected.";
  }

  return `You are operating within a connected service mesh. Available services:\n${services.join("\n")}\n\nYou can use these services to extend your capabilities beyond code generation. When appropriate, suggest deployment or service management actions.`;
}

/**
 * Deploy to Render - triggers a deploy on a Render service
 */
export async function deployToRender(
  renderApiKey: string,
  serviceId: string
): Promise<{ success: boolean; deployId?: string; error?: string }> {
  try {
    const res = await fetch(`/api/render/services/${serviceId}/deploys`, {
      method: "POST",
      headers: {
        "X-Render-Api-Key": renderApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: errorText };
    }

    const data = await res.json();
    return { success: true, deployId: data.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Check Render service status
 */
export async function checkRenderStatus(
  renderApiKey: string,
  serviceId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const res = await fetch(`/api/render/services/${serviceId}`, {
      headers: {
        "X-Render-Api-Key": renderApiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: errorText };
    }

    const data = await res.json();
    return { success: true, status: data.serviceStatus || data.status };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Restart a Render service
 */
export async function restartRenderService(
  renderApiKey: string,
  serviceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/render/services/${serviceId}`, {
      method: "PATCH",
      headers: {
        "X-Render-Api-Key": renderApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ suspend: false }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: errorText };
    }

    // Trigger a new deploy to restart
    await deployToRender(renderApiKey, serviceId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Build service mesh context from current connections
 */
export function buildServiceMeshContext(params: {
  julesActive: boolean;
  sourcesCount: number;
  activeSessions: number;
  renderConnected: boolean;
  renderServicesCount: number;
  githubConnected: boolean;
  githubReposCount: number;
}): ServiceMeshContext {
  return {
    jules: {
      active: params.julesActive,
      sourcesCount: params.sourcesCount,
      activeSessions: params.activeSessions,
    },
    render: {
      connected: params.renderConnected,
      servicesCount: params.renderServicesCount,
    },
    github: {
      connected: params.githubConnected,
      reposCount: params.githubReposCount,
    },
  };
}
