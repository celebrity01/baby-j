# Jules Deployment System v2.0

The Jules Deployment System is a modular, provider-agnostic engine designed to handle application deployments across various cloud platforms. It features a unified interface for project management, automated repository analysis, and "one-click" smart deployments.

## Architecture

The system is built around a central `DeploymentEngine` that manages a registry of `DeploymentProvider` implementations.

### Core Components

1.  **DeploymentEngine (`src/lib/deployment/engine.ts`)**: The main orchestrator. It handles provider registration and exposes high-level methods for listing projects, creating projects, and triggering deployments.
2.  **DeploymentProviders (`src/lib/deployment/providers/`)**: Modular classes that implement the `DeploymentProvider` interface for specific platforms (Vercel, Netlify, Render, GitHub Pages, Cloudflare Pages).
3.  **Repository Analyzer (`src/lib/deployment/analyzer.ts`)**: Analyzes GitHub repositories to detect the framework (Next.js, Vite, Node, Static) and recommends the best deployment path.

## Supported Providers

-   **Vercel**: Optimized for Next.js applications.
-   **Netlify**: Great for Vite and other static/SPA projects.
-   **Render**: Best for Node.js backends and full-stack apps.
-   **GitHub Pages**: Simple static hosting via GitHub Actions.
-   **Cloudflare Pages**: High-performance static and JAMstack hosting.

## API Specification

### Unified Interface

All providers must implement the following interface:

```typescript
interface DeploymentProvider {
  type: ProviderType;
  listProjects(token: string): Promise<DeploymentProject[]>;
  createProject(token: string, params: DeployParams, githubToken?: string): Promise<DeploymentResult>;
  deploy(token: string, params: DeployParams): Promise<DeploymentResult>;
  getStatus(token: string, projectId: string, deploymentId?: string): Promise<DeploymentResult>;
}
```

### API Endpoints

#### `POST /api/deploy/smart`
Triggers a "one-click" deployment for a GitHub repository.
- **Body**: `{ owner: string, repo: string, branch?: string }`
- **Headers**: Requires provider-specific tokens (`X-Vercel-Token`, `X-Netlify-Token`, etc.) and `X-GitHub-Token`.
- **Flow**:
    1. Analyzes the repo.
    2. Selects the recommended provider.
    3. Creates a project/service on that provider.
    4. Returns the deployment result and analysis.

#### `POST /api/deploy/status`
Checks the status of a deployment.
- **Body**: `{ owner: string, repo: string, workflow_file: string }` (for GitHub Pages) or provider-specific IDs.

## UI Components

### Deployment Center
A consolidated view showing deployments across all platforms.
- **Location**: `src/components/glass-deployment-center.tsx`
- **Features**: Search, status monitoring, and quick visit/redeploy actions.

## One-Click Deployment Logic

The `analyzeRepository` function checks for key files in the repository root:
- `next.config.js` → Vercel (Next.js)
- `vite.config.js` → Netlify (Vite)
- `package.json` → Render (Node.js)
- Default → GitHub Pages (Static)

## Setup & Configuration

To use the deployment system, users must provide API tokens for their chosen platforms in the Settings/Agents view. Tokens are stored in `localStorage` and passed via custom headers to the backend proxies.
