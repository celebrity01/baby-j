import { ProviderType } from './types';

export interface ProjectAnalysis {
  type: 'nextjs' | 'vite' | 'static' | 'node' | 'unknown';
  recommendedProvider: ProviderType;
  configFiles: string[];
  suggestedBuildCommand: string;
  suggestedPublishDir: string;
}

export async function analyzeRepository(
  githubToken: string,
  owner: string,
  repo: string
): Promise<ProjectAnalysis> {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
  };

  try {
    const res = await fetch(apiBase, { headers });
    if (!res.ok) throw new Error('Failed to fetch repo contents');
    const contents = await res.json();
    const files = contents.map((f: any) => f.name);

    if (files.includes('next.config.js') || files.includes('next.config.ts') || files.includes('next.config.mjs')) {
      return {
        type: 'nextjs',
        recommendedProvider: 'vercel',
        configFiles: ['vercel.json'],
        suggestedBuildCommand: 'npm run build',
        suggestedPublishDir: '.next',
      };
    }

    if (files.includes('vite.config.js') || files.includes('vite.config.ts')) {
      return {
        type: 'vite',
        recommendedProvider: 'netlify',
        configFiles: ['netlify.toml'],
        suggestedBuildCommand: 'npm run build',
        suggestedPublishDir: 'dist',
      };
    }

    if (files.includes('package.json')) {
      return {
        type: 'node',
        recommendedProvider: 'render',
        configFiles: ['render.yaml'],
        suggestedBuildCommand: 'npm install && npm run build',
        suggestedPublishDir: 'dist',
      };
    }

    return {
      type: 'static',
      recommendedProvider: 'github-pages',
      configFiles: ['.github/workflows/deploy-pages.yml'],
      suggestedBuildCommand: 'npm run build',
      suggestedPublishDir: 'out',
    };
  } catch (error) {
    console.warn('Analysis failed:', error);
    return {
      type: 'unknown',
      recommendedProvider: 'vercel',
      configFiles: [],
      suggestedBuildCommand: 'npm run build',
      suggestedPublishDir: 'out',
    };
  }
}
