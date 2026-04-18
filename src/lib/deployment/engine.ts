import {
  ProviderType,
  DeploymentProject,
  DeploymentResult,
  DeployParams,
  DeploymentProvider
} from './types';

export class DeploymentEngine {
  private providers: Map<ProviderType, DeploymentProvider> = new Map();

  registerProvider(provider: DeploymentProvider) {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: ProviderType): DeploymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider ${type} not registered`);
    }
    return provider;
  }

  async listAllProjects(tokens: Record<string, string>): Promise<DeploymentProject[]> {
    const results = await Promise.allSettled(
      Array.from(this.providers.values()).map(async (provider) => {
        const token = tokens[provider.type];
        if (!token) return [];
        return provider.listProjects(token);
      })
    );

    const projects: DeploymentProject[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        projects.push(...result.value);
      }
    });

    return projects;
  }

  async deploy(
    type: ProviderType,
    token: string,
    params: DeployParams
  ): Promise<DeploymentResult> {
    return this.getProvider(type).deploy(token, params);
  }

  async createProject(
    type: ProviderType,
    token: string,
    params: DeployParams,
    githubToken?: string
  ): Promise<DeploymentResult> {
    return this.getProvider(type).createProject(token, params, githubToken);
  }

  async getStatus(
    type: ProviderType,
    token: string,
    projectId: string,
    deploymentId?: string
  ): Promise<DeploymentResult> {
    return this.getProvider(type).getStatus(token, projectId, deploymentId);
  }
}

export const deploymentEngine = new DeploymentEngine();

// Register default providers
import { VercelProvider } from './providers/vercel';
import { NetlifyProvider } from './providers/netlify';
import { RenderProvider } from './providers/render';
import { GitHubPagesProvider } from './providers/github-pages';
import { CloudflarePagesProvider } from './providers/cloudflare-pages';

deploymentEngine.registerProvider(new VercelProvider());
deploymentEngine.registerProvider(new NetlifyProvider());
deploymentEngine.registerProvider(new RenderProvider());
deploymentEngine.registerProvider(new GitHubPagesProvider());
deploymentEngine.registerProvider(new CloudflarePagesProvider());
