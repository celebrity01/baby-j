export type ProviderType = 'vercel' | 'netlify' | 'render' | 'github-pages' | 'cloudflare-pages';

export interface DeploymentProject {
  id: string;
  name: string;
  url?: string;
  provider: ProviderType;
  repoUrl?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  status?: string;
  lastUpdated?: string;
}

export interface DeploymentResult {
  success: boolean;
  projectId?: string;
  deploymentId?: string;
  url?: string;
  message: string;
  error?: string;
  dashboardLink?: string;
  setupSteps?: { step: number; text: string; done: boolean; link?: string }[];
  needsManualRepoLink?: boolean;
  hint?: string;
  workflow_url?: string;
}

export interface DeployParams {
  projectId?: string;
  siteId?: string;
  serviceId?: string;
  name?: string;
  repoOwner?: string;
  repoName?: string;
  repoUrl?: string;
  branch?: string;
  runtime?: string;
  buildCommand?: string;
  startCommand?: string;
  publishDir?: string;
  envVars?: Record<string, string>;
}

export interface DeploymentProvider {
  type: ProviderType;
  listProjects(token: string): Promise<DeploymentProject[]>;
  createProject(token: string, params: DeployParams, githubToken?: string): Promise<DeploymentResult>;
  deploy(token: string, params: DeployParams): Promise<DeploymentResult>;
  getStatus(token: string, projectId: string, deploymentId?: string): Promise<DeploymentResult>;
}
