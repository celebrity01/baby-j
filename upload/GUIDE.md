# Jules Super Agent — Complete Web Application Guide

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Application Flow: Step by Step](#application-flow-step-by-step)
6. [Screens & Views](#screens--views)
7. [Core Features](#core-features)
8. [API Routes Reference](#api-routes-reference)
9. [State Management](#state-management)
10. [Deployment System](#deployment-system)
11. [Authentication & API Keys](#authentication--api-keys)
12. [Configuration](#configuration)

---

## Overview

Jules Super Agent (marketed as "Jules Lite") is a pro developer messenger that connects to Google's Jules AI agent for code generation, repository management, and one-tap deployment across four hosting platforms. It is a single-page application built with Next.js 16 that serves as a control center for interacting with the Jules API, managing GitHub repositories, and deploying projects to Vercel, Netlify, Render, or GitHub Pages.

The app has no traditional backend database for user accounts — it stores API keys in the browser's localStorage and proxies all API requests through Next.js API routes to avoid CORS issues and keep tokens secure on the client side. The Jules AI agent does the actual coding work on your repositories, and the webapp provides the interface to create missions (coding tasks), chat with the agent, review plans, approve execution, and deploy the results.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Server-side rendering, API routes, RSC |
| Language | TypeScript | Type safety across the codebase |
| UI Library | React 19 | Component-based UI |
| Styling | Tailwind CSS 4 | Utility-first CSS with glassmorphism design |
| Components | shadcn/ui (Radix UI) | Accessible, composable UI primitives |
| Animations | Framer Motion | Smooth transitions and micro-interactions |
| Icons | Lucide React | Consistent icon system |
| Fonts | Space Grotesk + JetBrains Mono | Display and monospace fonts |
| State | React useState + useCallback | Local component state (no global store in use) |
| Data Fetching | Native fetch | Client-side API calls through proxy routes |
| Package Manager | Bun | Fast JavaScript runtime and package manager |
| Build Tool | Next.js built-in (Turbopack) | Development and production builds |

---

## Project Structure

```
jules-super-agent/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, dark theme, Toaster)
│   │   ├── page.tsx                # Main single-page application entry
│   │   ├── globals.css             # Global styles, glass effects, animations
│   │   └── api/
│   │       ├── jules/
│   │       │   ├── sources/route.ts              # List Jules sources (repos)
│   │       │   ├── sessions/route.ts             # List/create sessions
│   │       │   ├── sessions/[sessionId]/route.ts  # Get single session
│   │       │   ├── sessions/[sessionId]/activities/route.ts  # Get session activities
│   │       │   ├── sessions/[sessionId]/approve/route.ts     # Approve agent plan
│   │       │   └── sessions/[sessionId]/message/route.ts     # Send message to agent
│   │       ├── github/
│   │       │   ├── user/route.ts                  # Get authenticated GitHub user
│   │       │   ├── repos/route.ts                 # List user's GitHub repos
│   │       │   ├── create-repo/route.ts           # Create a new GitHub repo
│   │       │   └── repos/[owner]/[repo]/
│   │       │       ├── route.ts                   # Get repo details
│   │       │       └── branches/route.ts          # List repo branches
│   │       ├── github-pages/
│   │       │   ├── sites/route.ts                 # List repos with Pages enabled
│   │       │   └── deploy/route.ts                # Enable/deploy GitHub Pages
│   │       ├── vercel/
│   │       │   ├── projects/route.ts              # List Vercel projects
│   │       │   ├── projects/create/route.ts       # Create Vercel project
│   │       │   └── deploy/route.ts                # Trigger Vercel deployment
│   │       ├── netlify/
│   │       │   ├── sites/route.ts                 # List Netlify sites
│   │       │   ├── sites/create/route.ts          # Create Netlify site
│   │       │   └── deploy/route.ts                # Trigger Netlify deployment
│   │       ├── render/
│   │       │   ├── deploy/route.ts                # Trigger Render deployment
│   │       │   ├── services/                      # Full Render service CRUD
│   │       │   ├── owners/                        # Render workspace/owner info
│   │       │   ├── projects/                      # Render projects
│   │       │   ├── postgres/                      # Render PostgreSQL databases
│   │       │   ├── key-value/                     # Render Redis key-value stores
│   │       │   ├── disks/                         # Render persistent disks
│   │       │   └── users/                         # Render user info
│   │       └── agent/
│   │           └── execute/route.ts               # Cross-service agent commands
│   ├── components/
│   │   ├── api-key-setup.tsx        # Jules API key onboarding screen
│   │   ├── glass-new-mission-modal.tsx  # New Mission creation modal
│   │   ├── glass-chat-view.tsx      # Chat/session view with agent
│   │   ├── glass-threads-view.tsx   # Threads list (sessions dashboard)
│   │   ├── glass-agents-view.tsx    # Agent connections management
│   │   ├── glass-mcp-view.tsx       # MCP (sources) view
│   │   ├── glass-pings-view.tsx     # System event notifications
│   │   ├── glass-add-repo-modal.tsx # Add repository modal
│   │   ├── glass-deploy-notification.tsx  # Deploy wizard modal
│   │   └── ui/                      # shadcn/ui component library
│   ├── lib/
│   │   ├── jules-client.ts         # Jules & GitHub API client functions
│   │   ├── render-api.ts           # Render API client functions
│   │   ├── agent-commands.ts       # Cross-service command system
│   │   ├── db.ts                   # Database client (Prisma)
│   │   └── utils.ts                # Utility functions
│   └── hooks/
│       ├── use-mobile.ts           # Mobile device detection hook
│       └── use-toast.ts            # Toast notification hook
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── prisma/
    └── schema.prisma               # Database schema
```

---

## Getting Started

### Prerequisites

- **Bun** runtime installed (`curl -fsSL https://bun.sh/install | bash`)
- A **Jules API key** from [jules.google](https://jules.google) Settings
- A **GitHub Personal Access Token** (optional, for repo features) with `repo` scope
- Optional: API keys for **Vercel**, **Netlify**, or **Render** (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/celebrity01/jules-super-agent.git
cd jules-super-agent

# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build
```

The app starts on `http://localhost:3000`.

---

## Application Flow: Step by Step

### Step 1: Initial Launch & API Key Entry

When you first open the app, you see the **API Key Setup** screen (`api-key-setup.tsx`). This is a glassmorphism-styled onboarding card with:

- A large Jules Zap icon with pulsing animation
- A password input field for your Jules API key or Google OAuth token
- The app auto-detects the key type:
  - If it starts with `ya29.` → it's a Google OAuth access token
  - Otherwise → it's a Jules API key
- On clicking "Initialize Agent", the app calls `listSources(apiKey)` to verify the key
- If valid, the key is stored in `localStorage` under the key `jules-api-key`
- The app transitions to the **Dashboard**

### Step 2: Dashboard (Threads View)

After authentication, the app loads the **Threads View** (`glass-threads-view.tsx`) as the default view. This is the main hub that shows:

- **Header**: App title "Jules Lite", refresh button, search button, add repo button, and a three-dot deploy menu
- **Quick Action Grid**: Three cards showing counts of Sessions, Repos, and Sources
- **Search Bar**: Filter sessions by title or prompt text
- **Thread List**: All Jules sessions displayed as cards showing:
  - Session title
  - First 80 characters of the prompt
  - State badge (RUNNING, COMPLETED, FAILED, AWAITING, CANCELLED)
  - Relative timestamp (e.g., "5m ago", "2d ago")
- **Floating Action Button (FAB)**: Cyan "+" button at bottom-right to create a New Mission
- **Deploy Menu**: Three-dot menu opens a dropdown with Vercel, Render, Netlify, and GitHub Pages options

On load, the app fetches both sources and sessions from the Jules API via the proxy routes.

### Step 3: Creating a New Mission

Clicking the FAB or "New Mission" opens the **New Mission Modal** (`glass-new-mission-modal.tsx`). This is a full-featured mission creation form with:

1. **Mission Identifier**: An optional title for the session (e.g., "matrix-auth-hardening")
2. **Objective Parameters** (required): A textarea for describing what the AI agent should accomplish
3. **Context Target** (required): A dropdown to select which GitHub repository the agent will work on
   - Shows registered Jules sources first (with a "Connected" badge)
   - Then shows all your GitHub repos (if GitHub token is connected)
   - Searchable with a filter input
   - Selecting a repo automatically fetches its branches
4. **Branch Vector**: A dropdown to select which branch the agent should start from
   - Auto-populated with branches from the selected repo
   - Shows which branch is the default
   - Shows protected branches with a badge
   - You can also manually type a branch name
5. **Mode**: Choose between "Manual" (default) and "Auto PR" (automatically creates a pull request)
6. **Deployment Config**: Four checkboxes for deployment platforms:
   - **Vercel** — includes `vercel.json` in generated code
   - **Netlify** — includes `netlify.toml` in generated code
   - **Render** — includes `render.yaml` in generated code
   - **GitHub Pages** — includes `.github/workflows/deploy.yml` in generated code
   - When checked, the `buildDeployInstructions()` function appends detailed deployment config specs to the Jules prompt, so the AI agent includes those files when generating code
7. **Require Plan Approval**: Toggle switch (default ON) — when enabled, the agent must get your approval before executing its plan

When you click "Launch Mission", the app calls `createSession()` which sends a POST request to `/api/jules/sessions` with the full prompt (including any deployment config instructions), source context, branch, and automation mode. The app then navigates to the Chat View.

### Step 4: Chatting with the Agent (Chat View)

The **Chat View** (`glass-chat-view.tsx`) is a messaging-style interface for interacting with a Jules session. It includes:

- **Header**: Shows session title, current state (with colored indicator), and action buttons:
  - **Approve Plan** button (appears when agent is awaiting approval)
  - **Pull Request** link (appears when a PR is created)
  - **External Link** to view on Jules web
  - **Add Repo** button
  - **Deploy Dropdown** (three-dot menu) with Vercel, Render, Netlify, GitHub Pages options
- **Message Stream**: Activities from the Jules API rendered as chat bubbles:
  - **AGENT_MESSAGED**: Agent's text responses (left-aligned, with Bot icon)
  - **USER_MESSAGED**: Your messages (right-aligned)
  - **PLAN_GENERATED**: Expandable plan card showing step-by-step plan with approval button
  - **PLAN_APPROVED**: Confirmation that the plan was approved
  - **PROGRESS_UPDATED**: Agent's progress updates with spinner
  - **SESSION_COMPLETED**: Mission completed with sparkle icon
  - **SESSION_FAILED**: Mission failed with error details
  - **Bash Output**: Expandable terminal card showing commands and output
  - **Code Changes**: Expandable diff view showing git patches with green/red syntax highlighting
- **Approval Banner**: Fixed at the bottom when plan needs approval, with a prominent "Approve" button
- **Message Input**: Textarea at the bottom for sending messages to the agent. Press Enter to send, Shift+Enter for newline
- **Auto-Refresh**: The view polls for new activities every 5 seconds while the session is in an active state

### Step 5: Deploying Your Project

From the Chat View's deploy dropdown, the Threads View's deploy menu, or the Pings view, you can trigger a deployment using the **Deploy Wizard** (`glass-deploy-notification.tsx`). This is a multi-step modal:

**Step 1 — Select Provider**: Choose from Vercel, Netlify, Render, or GitHub Pages. Each shows a "Connected" badge if you've previously saved an API key.

**Step 2 — API Key** (if not saved): Enter your provider's API key. The modal shows:
- How to get the key for that provider
- A link to the provider's dashboard
- A reminder to connect the provider to GitHub
- The key is saved to localStorage for future use

**Step 3 — Select Source**: Two tabs:
- **Host Projects**: Existing projects/sites/services on the provider
- **GitHub Repos**: Your GitHub repositories (requires GitHub token)
  - Searchable with a filter input
  - Shows repo name, description, and privacy status

**Step 4 — Select Branch** (GitHub repos only): If deploying from a GitHub repo, you can select which branch to deploy. Shows:
- All branches with search/filter
- Default and protected branch badges
- Short commit SHA

**Step 5 — Confirm**: Review the deployment details before triggering

**Step 6 — Deploying**: The app sends the deploy request to the appropriate API route

**Step 7 — Result**: Shows success/failure with the deployed site URL (clickable link)

For GitHub Pages specifically, the deploy flow:
1. Checks if Pages is already enabled on the repo
2. If enabled: Updates the source branch if different, then triggers a rebuild
3. If not enabled: Enables GitHub Pages with the specified branch
4. Returns the Pages URL (e.g., `https://owner.github.io/repo/`)

### Step 6: Managing Agent Connections (Agents View)

The **Agents View** (`glass-agents-view.tsx`) lets you manage your service connections:

- **GitHub Connection**:
  - If not connected: Enter your GitHub Personal Access Token
  - The app verifies the token by calling `getGitHubUser()`
  - If connected: Shows your GitHub avatar, name, and username
  - You can disconnect at any time
  - The token is stored in localStorage under `github-token`

- **Jules Agent**:
  - Shows "Active" status when connected
  - Provides a "Disconnect Agent" button that clears the Jules API key and returns to the onboarding screen

### Step 7: Viewing Sources (MCP View)

The **MCP View** (`glass-mcp-view.tsx`) displays all connected Jules sources:

- An "Active Context Map" card showing source count and status
- A list of all indexed sources (GitHub repositories registered with Jules)
- Each source card shows:
  - Repository name (e.g., `owner/repo`)
  - Default branch name
  - A link to open the repo on GitHub

### Step 8: Monitoring Events (Pings View)

The **Pings View** (`glass-pings-view.tsx`) shows a timeline of system events derived from session states:

- **SYS_OK** (green): Completed missions
- **CRIT_FAIL** (red): Failed or cancelled missions
- **WARN_ALERT** (purple): Sessions awaiting approval
- **SYS_INFO** (cyan): Active/running missions

Each ping shows a timestamp, severity level, and description.

---

## Screens & Views

### Navigation

The app uses a fixed **bottom navigation bar** (visible on all views except Chat) with four tabs:

| Tab | Icon | View | Description |
|-----|------|------|-------------|
| Threads | MessageSquare | GlassThreadsView | Session list and dashboard |
| Agents | Bot | GlassAgentsView | Service connection management |
| MCP | Cpu | GlassMCPView | Source repository index |
| Pings | Bell | GlassPingsView | System event notifications |

The active tab has a cyan indicator bar and glow effect. The navigation bar uses a glass-morphism style with blur backdrop.

### Modals

The app uses two main modals:

1. **New Mission Modal** (`glass-new-mission-modal.tsx`): Full mission creation form
2. **Add Repository Modal** (`glass-add-repo-modal.tsx`): Three-tab modal:
   - **Browse**: Search and select from your GitHub repos
   - **Create**: Create a new GitHub repository (name, description, public/private, README init)
   - **Connect**: Connect an existing repo by URL
3. **Deploy Wizard** (`glass-deploy-notification.tsx`): Multi-step deployment flow

All modals use a fixed overlay with glass-morphism styling and slide-up animations.

---

## Core Features

### 1. Jules AI Session Management

The core of the app is managing sessions (called "missions") with the Jules AI agent. The Jules API (`https://jules.googleapis.com/v1alpha`) supports:

- **Listing sessions**: GET `/sessions` with pagination
- **Creating sessions**: POST `/sessions` with prompt, source context, branch, and automation mode
- **Getting session details**: GET `/sessions/{id}`
- **Listing activities**: GET `/sessions/{id}/activities` — returns all events (messages, plans, progress, etc.)
- **Approving plans**: POST `/sessions/{id}/approve`
- **Sending messages**: POST `/sessions/{id}/message`

All Jules API calls go through Next.js API proxy routes to avoid CORS issues and handle authentication server-side.

### 2. GitHub Repository Management

The app integrates with the GitHub API for:

- **Getting user info**: Verifies GitHub token and shows profile
- **Listing repositories**: Fetches all user repos for selection in missions and deployment
- **Creating repositories**: Creates new repos directly from the app
- **Fetching branches**: Gets all branches for a repo with pagination
- **Verifying repos**: Checks if a repo URL is accessible

All GitHub API calls use the user's Personal Access Token passed via the `X-GitHub-Token` header through proxy routes.

### 3. Deployment System

The app supports four deployment providers with a unified wizard interface:

#### Vercel
- **Projects**: List existing projects, create new ones linked to GitHub repos
- **Deploy**: Trigger deployments via the Vercel API or deploy hooks
- **Token**: Saved in localStorage as `vercel-token`
- **API**: `https://api.vercel.com` with Bearer token auth

#### Netlify
- **Sites**: List existing sites, create new ones linked to GitHub repos
- **Deploy**: Trigger deployments via the Netlify API
- **Token**: Saved in localStorage as `netlify-token`
- **API**: `https://api.netlify.com/api/v1` with Bearer token auth

#### Render
- **Services**: Full CRUD — list, create, update, delete, suspend, resume, restart
- **Deploys**: List, trigger, cancel, rollback deployments
- **Environment Variables**: List and set env vars for services
- **PostgreSQL**: List, create, delete, get connection info, suspend, resume
- **Key-Value Stores**: List, create, delete, get connection info
- **Disks**: List, create, delete persistent disks
- **Owners/Projects**: List workspaces and projects
- **Token**: Saved in localStorage as `render-api-key`
- **API**: `https://api.render.com/v1` with Bearer token auth

#### GitHub Pages
- **Sites**: List repos with GitHub Pages enabled
- **Deploy**: Enable Pages on a repo or trigger a rebuild
- **Branch**: Set which branch Pages deploys from
- **Token**: Uses the GitHub token (same as GitHub integration)
- **API**: `https://api.github.com` with Bearer token auth

### 4. Deployment Config Auto-Generation

When creating a New Mission, checking deployment host checkboxes causes the app to append detailed deployment configuration instructions to the Jules prompt. This ensures the AI agent includes the necessary deployment files in its generated code:

- **Vercel**: Generates `vercel.json` with framework preset, build commands, and output directory
- **Netlify**: Generates `netlify.toml` with build command, publish directory, and redirects
- **Render**: Generates `render.yaml` blueprint with service definition, runtime, and build/start commands
- **GitHub Pages**: Generates `.github/workflows/deploy.yml` with GitHub Actions workflow for Pages deployment

This feature bridges the gap between code generation and deployment — the agent creates deployment-ready code that can be deployed with one tap from the app.

### 5. Cross-Service Agent Commands

The `agent-commands.ts` module provides a command layer for cross-service operations:

- **Deploy to Render**: Trigger a Render deploy after Jules makes code changes
- **Check Render Status**: Query the health of a Render service
- **Restart Render Service**: Restart a service if needed
- **Service Mesh Context**: Build a unified view of connected services (Jules + Render)
- **System Prompt Generation**: `buildAgentSystemPrompt()` creates a context string describing available services

These commands are designed for future automation where the agent can trigger deployments and manage services autonomously.

---

## API Routes Reference

### Jules API Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/jules/sources` | GET | List all registered Jules sources (GitHub repos) |
| `/api/jules/sessions` | GET | List sessions with pagination |
| `/api/jules/sessions` | POST | Create a new session (mission) |
| `/api/jules/sessions/[sessionId]` | GET | Get session details |
| `/api/jules/sessions/[sessionId]/activities` | GET | Get all activities for a session |
| `/api/jules/sessions/[sessionId]/approve` | POST | Approve a plan that's awaiting approval |
| `/api/jules/sessions/[sessionId]/message` | POST | Send a message to the agent |

All routes require the `X-Jules-Api-Key` header. The server auto-detects whether to use `X-Goog-Api-Key` or `Authorization: Bearer` based on the key format.

### GitHub API Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/github/user` | GET | Get authenticated GitHub user profile |
| `/api/github/repos` | GET | List user's GitHub repositories |
| `/api/github/create-repo` | POST | Create a new GitHub repository |
| `/api/github/repos/[owner]/[repo]` | GET | Get repository details |
| `/api/github/repos/[owner]/[repo]/branches` | GET | List all branches for a repository |

All routes require the `X-GitHub-Token` header.

### GitHub Pages Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/github-pages/sites` | GET | List repos with GitHub Pages enabled |
| `/api/github-pages/deploy` | POST | Enable Pages or trigger a rebuild |

### Vercel Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/vercel/projects` | GET | List Vercel projects |
| `/api/vercel/projects/create` | POST | Create a Vercel project linked to GitHub |
| `/api/vercel/deploy` | POST | Trigger a Vercel deployment |

### Netlify Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/netlify/sites` | GET | List Netlify sites |
| `/api/netlify/sites/create` | POST | Create a Netlify site linked to GitHub |
| `/api/netlify/deploy` | POST | Trigger a Netlify deployment |

### Render Proxies

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/render/services` | GET | List Render services |
| `/api/render/services` | POST | Create a new service |
| `/api/render/services/create` | POST | Create a web service linked to GitHub |
| `/api/render/services/[serviceId]` | GET/PATCH/DELETE | Get/update/delete a service |
| `/api/render/services/[serviceId]/suspend` | POST | Suspend a service |
| `/api/render/services/[serviceId]/resume` | POST | Resume a service |
| `/api/render/services/[serviceId]/restart` | POST | Restart a service |
| `/api/render/services/[serviceId]/deploys` | GET/POST | List/trigger deployments |
| `/api/render/services/[serviceId]/deploys/[deployId]` | GET | Get deploy details |
| `/api/render/services/[serviceId]/deploys/[deployId]/cancel` | POST | Cancel a deployment |
| `/api/render/services/[serviceId]/rollback` | POST | Rollback to a previous deploy |
| `/api/render/services/[serviceId]/env-vars` | GET/PUT | List/set environment variables |
| `/api/render/deploy` | POST | Trigger a deployment |
| `/api/render/owners` | GET | List workspaces/owners |
| `/api/render/owners/[ownerId]` | GET | Get owner details |
| `/api/render/projects` | GET | List Render projects |
| `/api/render/postgres` | GET/POST | List/create PostgreSQL databases |
| `/api/render/postgres/[postgresId]` | GET/DELETE | Get/delete a Postgres instance |
| `/api/render/postgres/[postgresId]/connection-info` | GET | Get connection string |
| `/api/render/postgres/[postgresId]/suspend` | POST | Suspend Postgres |
| `/api/render/postgres/[postgresId]/resume` | POST | Resume Postgres |
| `/api/render/key-value` | GET/POST | List/create key-value stores |
| `/api/render/key-value/[keyValueId]` | GET/DELETE | Get/delete a key-value store |
| `/api/render/key-value/[keyValueId]/connection-info` | GET | Get connection info |
| `/api/render/disks` | GET/POST | List/create disks |
| `/api/render/disks/[diskId]` | GET/DELETE | Get/delete a disk |
| `/api/render/users` | GET | Get current Render user |

### Agent Commands

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/execute` | POST | Execute cross-service agent commands |

---

## State Management

The app uses React's built-in state management (no external state library like Zustand is actively used in the current codebase, despite being listed as a dependency). All state lives in the root `page.tsx` component:

### Root State (`page.tsx`)

| State Variable | Type | Purpose |
|---------------|------|---------|
| `step` | `"api-key" \| "dashboard"` | Current app step |
| `apiKey` | `string \| null` | Jules API key |
| `githubToken` | `string \| null` | GitHub Personal Access Token |
| `sources` | `JulesSource[]` | List of Jules sources |
| `sessions` | `JulesSession[]` | List of Jules sessions |
| `isLoadingSources` | `boolean` | Loading state for sources |
| `isLoadingSessions` | `boolean` | Loading state for sessions |
| `selectedSessionId` | `string \| null` | Currently selected session |
| `view` | `"threads" \| "chat" \| "agents" \| "mcp" \| "pings"` | Current view |
| `isNewMissionOpen` | `boolean` | New Mission modal visibility |
| `isAddRepoOpen` | `boolean` | Add Repo modal visibility |

### Persistence

All API keys are stored in the browser's localStorage:

| Key | Purpose |
|-----|---------|
| `jules-api-key` | Jules API key or OAuth token |
| `github-token` | GitHub Personal Access Token |
| `vercel-token` | Vercel API token |
| `netlify-token` | Netlify access token |
| `render-api-key` | Render API key |
| `github-pages-token` | GitHub Pages token (usually same as github-token) |

---

## Deployment System

### Deploy Wizard Flow

The deploy wizard (`glass-deploy-notification.tsx`) follows these steps:

```
select-provider → api-key → select-item → select-branch → confirm → deploying → result
```

1. **select-provider**: User picks Vercel, Netlify, Render, or GitHub Pages
2. **api-key**: If no saved token, user enters one (saved to localStorage)
3. **select-item**: User picks an existing host project or a GitHub repo
4. **select-branch**: (GitHub repos only) User selects which branch to deploy
5. **confirm**: User reviews and confirms the deployment
6. **deploying**: The app makes the API call to the provider
7. **result**: Success/failure with the deployed site URL

### Deploy by Provider

When deploying from a **GitHub repo** (as opposed to an existing host project), the app creates a new project/site/service on the provider linked to the repo:

- **Vercel**: Creates a new Vercel project via POST `/api/vercel/projects/create` with repo owner, name, and branch
- **Netlify**: Creates a new Netlify site via POST `/api/netlify/sites/create` with repo details and URL
- **Render**: Creates a new Render web service via POST `/api/render/services/create` with repo info
- **GitHub Pages**: Enables Pages on the repo via POST `/api/github-pages/deploy` with repo owner, name, and branch

When deploying an **existing host project**, the app triggers a redeploy:

- **Vercel**: Creates a new deployment via POST `/api/vercel/deploy` with project ID
- **Netlify**: Triggers a site build via POST `/api/netlify/deploy` with site ID
- **Render**: Triggers a service deploy via POST `/api/render/deploy` with service ID
- **GitHub Pages**: Triggers a Pages rebuild via POST `/api/github-pages/deploy` with repo owner/name

---

## Authentication & API Keys

### Jules Authentication

The app supports two Jules authentication methods:

1. **API Key**: Generated from jules.google Settings. Sent as `X-Goog-Api-Key` header.
2. **OAuth Token**: Google OAuth access token (starts with `ya29.`). Sent as `Authorization: Bearer` header.

The server-side proxy routes auto-detect which method to use based on the key format.

### GitHub Authentication

GitHub uses a Personal Access Token (PAT) with `repo` scope. The token is:
- Stored in localStorage as `github-token`
- Passed as `X-GitHub-Token` header through proxy routes
- Used for: browsing repos, creating repos, fetching branches, and GitHub Pages deployment

### Provider Authentication

Each deployment provider requires its own API key:

| Provider | Key Storage | Auth Method | Where to Get Key |
|----------|------------|-------------|-----------------|
| Vercel | `vercel-token` | `X-Vercel-Token` header → `Authorization: Bearer` | vercel.com/account/tokens |
| Netlify | `netlify-token` | `X-Netlify-Token` header → `Authorization: Bearer` | app.netlify.com/user/applications/personal |
| Render | `render-api-key` | `X-Render-Api-Key` header → `Authorization: Bearer` | dashboard.render.com/y/account/api-keys |
| GitHub Pages | `github-pages-token` | `X-GitHub-Token` header → `Authorization: Bearer` | github.com/settings/tokens |

All tokens are sanitized using `sanitizeHeaderValue()` to remove non-ISO-8859-1 characters before being sent in HTTP headers, preventing browser fetch errors.

---

## Configuration

### next.config.ts

```typescript
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};
```

- TypeScript build errors are ignored for faster development
- React strict mode is disabled

### Design System

The app uses a dark cyberpunk-inspired design system:

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#03080a` | Main background |
| Text Primary | `#E0F7FA` | Headings and body text |
| Text Secondary | `#547B88` | Labels, descriptions, metadata |
| Accent Cyan | `#00E5FF` | Active states, primary actions |
| Success Green | `#00E676` | Connected, completed states |
| Warning Purple | `#B388FF` | Approval, plan states |
| Error Red | `#FF2A5F` | Errors, failed states |
| Glass Surface | `rgba(255,255,255,0.03)` | Card backgrounds with blur |

### Animations

- **Liquid Blobs**: Three animated background blobs for ambient visual effect
- **Slide Up**: Modal entry animation (`animate-slide-up`)
- **Fade In**: Content appearance animation (`animate-fade-in`)
- **Pulse**: Active state indicator (`animate-pulse`, `animate-subtle-pulse`)
- **Skeleton Shimmer**: Loading placeholder animation (`skeleton-shimmer`)

### Responsive Design

The app is designed mobile-first with a max width of `768px` (`md:max-w-3xl`) centered on desktop. Bottom navigation is optimized for mobile use with safe-area padding (`pb-safe`).
