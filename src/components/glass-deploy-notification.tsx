'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X, Globe, Server, CheckCircle2, Loader2,
  ChevronRight, ExternalLink, Key, AlertTriangle,
  Zap, Shield, RefreshCw, ChevronDown, ChevronUp, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { GitHubRepo, DeploymentStatus } from '@/lib/jules-client';
import {
  listGitHubRepos, listBranches, deployVercel, deployNetlify, deployRender, deployPages,
  createVercelProject, createNetlifySite, createRenderService, getDeploymentStatus,
} from '@/lib/jules-client';

// ===== Types =====

interface GlassDeployNotificationProps {
  githubToken: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type ProviderId = 'netlify' | 'vercel' | 'render' | 'github-pages';
type DeployPhase = 'idle' | 'deploying' | 'monitoring' | 'result';

interface SetupStep {
  step: number;
  text: string;
  done: boolean;
  link?: string;
}

interface DeployResult {
  success: boolean;
  url?: string;
  error?: string;
  message?: string;
  dashboard_link?: string;
  setup_steps?: SetupStep[];
  workflow_url?: string;
  hint?: string;
  needs_manual_repo_link?: boolean;
  git_linked?: boolean;
  pages_enabled?: boolean;
  workflow_triggered?: boolean;
}

interface HostItem {
  id: string;
  name: string;
  url?: string;
}

interface ProviderState {
  token: string | null;
  showTokenInput: boolean;
  tokenInput: string;
  hostItems: HostItem[];
  hostItemsLoading: boolean;
  hostItemsError: string;
  existingExpanded: boolean;
  // New deploy state
  repos: GitHubRepo[];
  reposLoading: boolean;
  selectedRepo: string;
  branches: { name: string; default?: boolean }[];
  branchesLoading: boolean;
  selectedBranch: string;
  phase: DeployPhase;
  isRedeploy: boolean;
  selectedHostItem: string;
  deployResult: DeployResult | null;
  deploymentStatus: DeploymentStatus | null;
  isMonitoring: boolean;
}

// ===== Provider Configs =====

const providerConfigs: { id: ProviderId; name: string; description: string; icon: typeof Globe; color: string; storageKey: string | null; headerKey: string; helpUrl: string; helpText: string; needsGitHubToken: boolean }[] = [
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Instant builds and deploys. Global CDN.',
    icon: Shield,
    color: '#00E676',
    storageKey: 'netlify-token',
    headerKey: 'X-Netlify-Token',
    helpUrl: 'https://app.netlify.com/user/applications/personal',
    helpText: 'Create a personal access token at app.netlify.com/user/applications.',
    needsGitHubToken: false,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Automatic deploys from Git. Zero-config for Next.js.',
    icon: Globe,
    color: '#ffffff',
    storageKey: 'vercel-token',
    headerKey: 'X-Vercel-Token',
    helpUrl: 'https://vercel.com/account/tokens',
    helpText: 'Create a token at vercel.com/account/tokens. Scope: Full Account.',
    needsGitHubToken: true,
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Modern cloud. Web services, static sites, cron jobs.',
    icon: Server,
    color: '#B388FF',
    storageKey: 'render-api-key',
    headerKey: 'X-Render-Api-Key',
    helpUrl: 'https://dashboard.render.com/account/api-keys',
    helpText: 'Create an API key at dashboard.render.com/account.',
    needsGitHubToken: false,
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    description: 'Free hosting directly from your GitHub repo.',
    icon: Globe,
    color: '#58A6FF',
    storageKey: null,
    headerKey: 'X-GitHub-Token',
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Uses your connected GitHub token. Needs repo + workflow scopes.',
    needsGitHubToken: true,
  },
];

// ===== Helpers =====

function createInitialState(): ProviderState {
  return {
    token: null,
    showTokenInput: false,
    tokenInput: '',
    hostItems: [],
    hostItemsLoading: false,
    hostItemsError: '',
    existingExpanded: true,
    repos: [],
    reposLoading: false,
    selectedRepo: '',
    branches: [],
    branchesLoading: false,
    selectedBranch: '',
    phase: 'idle',
    isRedeploy: false,
    selectedHostItem: '',
    deployResult: null,
    deploymentStatus: null,
    isMonitoring: false,
  };
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'string') return obj.error;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    return JSON.stringify(obj);
  }
  return fallback;
}

// ===== Component =====

export default function GlassDeployNotification({
  githubToken,
  isOpen,
  onClose,
}: GlassDeployNotificationProps) {
  const [activeTab, setActiveTab] = useState<ProviderId>('netlify');
  const [states, setStates] = useState<Record<ProviderId, ProviderState>>({
    netlify: createInitialState(),
    vercel: createInitialState(),
    render: createInitialState(),
    'github-pages': createInitialState(),
  });

  // Initialize tokens from localStorage
  useEffect(() => {
    if (!isOpen) return;
    setStates(prev => {
      const next = { ...prev };
      for (const cfg of providerConfigs) {
        if (cfg.storageKey) {
          const stored = localStorage.getItem(cfg.storageKey);
          if (stored && !next[cfg.id].token) {
            next[cfg.id] = { ...next[cfg.id], token: stored };
          }
        } else if (cfg.id === 'github-pages') {
          if (githubToken && !next[cfg.id].token) {
            next[cfg.id] = { ...next[cfg.id], token: githubToken };
          }
        }
      }
      return next;
    });
  }, [isOpen, githubToken]);

  // Monitoring intervals per provider
  const monitorIntervals = useRef<Record<ProviderId, ReturnType<typeof setInterval> | null>>({
    netlify: null, vercel: null, render: null, 'github-pages': null,
  });

  useEffect(() => {
    return () => {
      for (const key of Object.keys(monitorIntervals.current) as ProviderId[]) {
        if (monitorIntervals.current[key]) clearInterval(monitorIntervals.current[key]!);
      }
    };
  }, []);

  const s = states[activeTab];
  const cfg = providerConfigs.find(c => c.id === activeTab)!;

  const updateState = useCallback((pid: ProviderId, patch: Partial<ProviderState>) => {
    setStates(prev => ({ ...prev, [pid]: { ...prev[pid], ...patch } }));
  }, []);

  const handleClose = useCallback(() => {
    // Stop all monitoring
    for (const key of Object.keys(monitorIntervals.current) as ProviderId[]) {
      if (monitorIntervals.current[key]) {
        clearInterval(monitorIntervals.current[key]!);
        monitorIntervals.current[key] = null;
      }
    }
    setStates({
      netlify: createInitialState(),
      vercel: createInitialState(),
      render: createInitialState(),
      'github-pages': createInitialState(),
    });
    setActiveTab('netlify');
    onClose();
  }, [onClose]);

  // ── Load host items ──

  const loadHostItems = useCallback(async (pid: ProviderId) => {
    const config = providerConfigs.find(c => c.id === pid)!;
    const token = pid === 'github-pages' ? githubToken : states[pid].token;
    if (!token) return;

    updateState(pid, { hostItemsLoading: true, hostItemsError: '' });
    try {
      const headers: Record<string, string> = {};
      if (config.headerKey === 'X-GitHub-Token') {
        headers['X-GitHub-Token'] = token;
      } else {
        headers[config.headerKey] = token;
      }

      let url = '';
      if (pid === 'netlify') url = '/api/netlify/sites';
      else if (pid === 'vercel') url = '/api/vercel/projects';
      else if (pid === 'render') url = '/api/render/services';
      else if (pid === 'github-pages') url = '/api/github-pages/sites';

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();

      let items: HostItem[] = [];
      if (pid === 'netlify') {
        items = (data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string, name: s.name as string, url: (s.ssl_url as string) || (s.url as string),
        }));
      } else if (pid === 'vercel') {
        items = (data || []).map((p: Record<string, unknown>) => ({
          id: p.id as string, name: p.name as string, url: (p.alias as string[])?.[0] || (p.url as string),
        }));
      } else if (pid === 'render') {
        items = (data || []).map((sv: Record<string, unknown>) => ({
          id: sv.id as string, name: (sv.name as string) || sv.id, url: sv.url as string,
        }));
      } else if (pid === 'github-pages') {
        items = (data || []).map((pg: Record<string, unknown>) => {
          const htmlUrl = pg.html_url as string;
          const urlParts = (htmlUrl || '').replace(/\/$/, '').split('/');
          const repoSlug = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}` : htmlUrl;
          return { id: repoSlug, name: (pg.repo_name as string) || repoSlug, url: htmlUrl };
        });
      }
      updateState(pid, { hostItems: items, hostItemsLoading: false });
    } catch (err) {
      updateState(pid, { hostItemsError: extractErrorMessage(err, 'Failed to load.'), hostItemsLoading: false });
    }
  }, [githubToken, states, updateState]);

  // ── Load repos ──

  const loadRepos = useCallback(async (pid: ProviderId) => {
    if (!githubToken) return;
    updateState(pid, { reposLoading: true });
    try {
      const ghRepos = await listGitHubRepos(githubToken);
      updateState(pid, { repos: ghRepos, reposLoading: false });
    } catch (err) {
      updateState(pid, { reposLoading: false });
    }
  }, [githubToken, updateState]);

  // ── Load branches ──

  const loadBranches = useCallback(async (pid: ProviderId, fullName: string) => {
    if (!githubToken) return;
    updateState(pid, { branchesLoading: true, selectedBranch: '' });
    try {
      const [owner, repo] = fullName.split('/');
      const b = await listBranches(githubToken, owner, repo);
      const mapped = b.map((br) => ({ name: br.name, default: br.default }));
      const def = b.find((br) => br.default) || b[0];
      updateState(pid, { branches: mapped, selectedBranch: def?.name || '', branchesLoading: false });
    } catch {
      updateState(pid, { branchesLoading: false });
    }
  }, [githubToken, updateState]);

  // ── Token management ──

  const handleSaveToken = useCallback((pid: ProviderId) => {
    const config = providerConfigs.find(c => c.id === pid)!;
    const st = states[pid];
    if (!st.tokenInput.trim() || !config.storageKey) return;
    localStorage.setItem(config.storageKey, st.tokenInput.trim());
    updateState(pid, { token: st.tokenInput.trim(), tokenInput: '', showTokenInput: false });
    loadHostItems(pid);
    if (config.needsGitHubToken || githubToken) {
      loadRepos(pid);
    }
  }, [states, updateState, loadHostItems, loadRepos, githubToken]);

  const handleChangeToken = useCallback((pid: ProviderId) => {
    const config = providerConfigs.find(c => c.id === pid)!;
    if (config.storageKey) localStorage.removeItem(config.storageKey);
    updateState(pid, { token: null, showTokenInput: true, tokenInput: '', hostItems: [], deployResult: null });
  }, [updateState]);

  // ── Monitoring ──

  const startMonitoring = useCallback((pid: ProviderId, owner: string, repo: string) => {
    if (!githubToken) return;
    updateState(pid, { isMonitoring: true, deploymentStatus: { status: 'queued', message: 'Waiting for workflow to register...' } });
    let attempts = 0;

    monitorIntervals.current[pid] = setInterval(async () => {
      attempts++;
      if (attempts > 40) {
        if (monitorIntervals.current[pid]) clearInterval(monitorIntervals.current[pid]!);
        monitorIntervals.current[pid] = null;
        updateState(pid, {
          deploymentStatus: { status: 'timeout', message: 'Taking longer than expected. Check GitHub Actions tab.' },
          isMonitoring: false,
        });
        return;
      }
      try {
        const status = await getDeploymentStatus(githubToken, { owner, repo, workflow_file: 'deploy-pages.yml' });
        updateState(pid, { deploymentStatus: status });
        if (status.status === 'success' || status.status === 'failed' || status.status === 'cancelled') {
          if (monitorIntervals.current[pid]) clearInterval(monitorIntervals.current[pid]!);
          monitorIntervals.current[pid] = null;
          setTimeout(() => {
            const st = states[pid];
            updateState(pid, {
              phase: 'result',
              isMonitoring: false,
              deployResult: {
                success: status.status === 'success',
                url: status.status === 'success' ? st.deployResult?.url : undefined,
                message: status.message,
                workflow_url: status.html_url,
                error: status.status !== 'success' ? status.message : undefined,
              },
            });
          }, 1500);
        }
      } catch { /* retry */ }
    }, 10000);
  }, [githubToken, updateState, states]);

  // ── Deploy actions ──

  const handleRedeploy = useCallback(async (pid: ProviderId, itemId: string) => {
    const config = providerConfigs.find(c => c.id === pid)!;
    const token = pid === 'github-pages' ? (githubToken || '') : states[pid].token;
    if (!token) return;

    updateState(pid, { phase: 'deploying', isRedeploy: true, selectedHostItem: itemId, deployResult: null });

    try {
      let result: DeployResult;

      if (pid === 'vercel') {
        const data = await deployVercel(token, { projectId: itemId }) as Record<string, unknown>;
        result = { success: true, url: (data.url as string) || (data.alias as string[])?.[0] };
      } else if (pid === 'netlify') {
        const data = await deployNetlify(token, { siteId: itemId }) as Record<string, unknown>;
        // Handle "needs_manual_repo_link" error
        if (data.needs_manual_repo_link) {
          result = {
            success: false,
            error: data.error as string || 'Site has no linked repo.',
            hint: data.hint as string,
            dashboard_link: data.dashboard_link as string,
            needs_manual_repo_link: true,
          };
        } else {
          result = { success: true, url: (data.ssl_url as string) || (data.url as string) };
        }
      } else if (pid === 'render') {
        const data = await deployRender(token, { serviceId: itemId }) as Record<string, unknown>;
        const saved = states[pid].hostItems.find(h => h.id === itemId);
        result = { success: true, url: (data.url as string) || saved?.url };
      } else if (pid === 'github-pages') {
        const [owner, repo] = itemId.split('/');
        const data = await deployPages(token, { owner, repo }) as Record<string, unknown>;
        result = {
          success: !!(data.success),
          url: (data.url as string) || `https://${owner}.github.io/${repo}/`,
          message: data.message as string,
          workflow_url: data.workflow_url as string,
          pages_enabled: data.pages_enabled as boolean,
          workflow_triggered: data.workflow_triggered as boolean,
        };
      } else {
        result = { success: false, error: 'Unsupported provider.' };
      }

      updateState(pid, { deployResult: result });

      // Start monitoring for GitHub Pages
      if (result.workflow_triggered && result.pages_enabled) {
        const [owner, repo] = itemId.split('/');
        startMonitoring(pid, owner, repo);
      } else {
        updateState(pid, { phase: 'result' });
      }
    } catch (err) {
      updateState(pid, {
        phase: 'result',
        deployResult: { success: false, error: extractErrorMessage(err, 'Redeploy failed.') },
      });
    }
  }, [githubToken, states, updateState, startMonitoring]);

  const handleDeployFromRepo = useCallback(async (pid: ProviderId) => {
    const st = states[pid];
    const config = providerConfigs.find(c => c.id === pid)!;
    const token = pid === 'github-pages' ? (githubToken || '') : st.token;
    if (!token || !st.selectedRepo || !st.selectedBranch) return;

    updateState(pid, { phase: 'deploying', isRedeploy: false, deployResult: null });
    const [owner, repo] = st.selectedRepo.split('/');

    try {
      let result: DeployResult;

      if (pid === 'vercel') {
        const data = await createVercelProject(token, {
          name: repo, repoOwner: owner, repoName: repo, branch: st.selectedBranch,
        }) as Record<string, unknown>;
        result = {
          success: true,
          url: (data.url as string) || (data.alias as string[])?.[0] || `https://${repo}-vercel.app`,
          message: data.message as string,
          dashboard_link: data.dashboard_link as string,
          setup_steps: data.setup_steps as SetupStep[],
          git_linked: data.git_linked as boolean,
        };
      } else if (pid === 'netlify') {
        const data = await createNetlifySite(token, {
          name: repo, branch: st.selectedBranch,
        }, githubToken) as Record<string, unknown>;
        result = {
          success: true,
          url: (data.url as string) || (data.ssl_url as string),
          message: data.message as string,
          dashboard_link: data.dashboard_link as string,
          setup_steps: data.setup_steps as SetupStep[],
          needs_manual_repo_link: data.needs_manual_repo_link as boolean,
        };
      } else if (pid === 'render') {
        const data = await createRenderService(token, {
          name: repo,
          repoUrl: `https://github.com/${owner}/${repo}`,
          branch: st.selectedBranch,
          runtime: 'node',
        }) as Record<string, unknown>;
        result = {
          success: true,
          url: (data.url as string),
          message: data.message as string,
          dashboard_link: data.dashboard_link as string,
          setup_steps: data.setup_steps as SetupStep[],
        };
      } else if (pid === 'github-pages') {
        const data = await deployPages(githubToken || '', { owner, repo, branch: st.selectedBranch }) as Record<string, unknown>;
        result = {
          success: !!(data.success),
          url: (data.url as string) || `https://${owner}.github.io/${repo}/`,
          message: data.message as string,
          dashboard_link: data.dashboard_link as string,
          setup_steps: data.setup_steps as SetupStep[],
          workflow_url: data.workflow_url as string,
          pages_enabled: data.pages_enabled as boolean,
          workflow_triggered: data.workflow_triggered as boolean,
          error: data.success ? undefined : (data.error as string),
        };
      } else {
        result = { success: false, error: 'Unsupported provider.' };
      }

      updateState(pid, { deployResult: result });

      // Start monitoring for GitHub Pages
      if (result.workflow_triggered && result.pages_enabled) {
        startMonitoring(pid, owner, repo);
      } else {
        updateState(pid, { phase: 'result' });
      }
    } catch (err) {
      updateState(pid, {
        phase: 'result',
        deployResult: { success: false, error: extractErrorMessage(err, 'Deployment failed.') },
      });
    }
  }, [githubToken, states, updateState, startMonitoring]);

  const handleRetry = useCallback((pid: ProviderId) => {
    updateState(pid, { phase: 'idle', deployResult: null, deploymentStatus: null });
  }, [updateState]);

  const handleDone = useCallback((pid: ProviderId) => {
    updateState(pid, { phase: 'idle', deployResult: null, deploymentStatus: null, isRedeploy: false, selectedHostItem: '' });
    // Reload host items to show new site
    loadHostItems(pid);
  }, [updateState, loadHostItems]);

  // ── Tab switch ──

  const handleTabSwitch = useCallback((pid: ProviderId) => {
    setActiveTab(pid);
    const st = states[pid];
    const config = providerConfigs.find(c => c.id === pid)!;
    const hasToken = !config.storageKey ? !!githubToken : !!st.token;

    // Lazy load items on first tab visit
    if (hasToken && st.hostItems.length === 0 && !st.hostItemsLoading && !st.hostItemsError) {
      loadHostItems(pid);
    }
    if (githubToken && st.repos.length === 0 && !st.reposLoading) {
      loadRepos(pid);
    }
  }, [states, githubToken, loadHostItems, loadRepos]);

  // ── Render helper for a single provider tab ──

  const renderProviderContent = (pid: ProviderId) => {
    const config = providerConfigs.find(c => c.id === pid)!;
    const st = states[pid];
    const Icon = config.icon;
    const isActive = activeTab === pid;
    if (!isActive) return null;

    const hasToken = !config.storageKey ? !!githubToken : !!st.token;

    return (
      <motion.div
        key={pid}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-4 space-y-4">
          {/* ── Connection Bar ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${config.color}12` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-[#E0F7FA]">{config.name}</p>
                <p className="text-[10px] text-[#547B88]">{config.description}</p>
              </div>
            </div>
            {hasToken ? (
              <div className="flex items-center gap-2">
                <Badge className="h-5 text-[9px] bg-[#00E676]/10 text-[#00E676] border-[#00E676]/25 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] mr-1.5 inline-block" />
                  Connected
                </Badge>
                <button onClick={() => handleChangeToken(pid)}
                  className="text-[9px] text-[#547B88] hover:text-[#E0F7FA] transition-colors px-1.5 py-0.5 rounded hover:bg-white/5">
                  Change
                </button>
              </div>
            ) : (
              <button onClick={() => updateState(pid, { showTokenInput: true })}
                className="text-[10px] font-medium text-[#00E5FF] hover:text-[#00E5FF]/80 transition-colors px-2.5 py-1 rounded-lg bg-[#00E5FF]/10 hover:bg-[#00E5FF]/15 border border-[#00E5FF]/20">
                Connect
              </button>
            )}
          </div>

          {/* ── Token Input ── */}
          {st.showTokenInput && !st.token && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                <div className="flex items-start gap-2">
                  <Key className="w-3.5 h-3.5 text-[#00E5FF] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-[#E0F7FA] font-medium">{config.name} API Token</p>
                    <p className="text-[9px] text-[#547B88] mt-0.5 leading-relaxed">{config.helpText}</p>
                    <a href={config.helpUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-[#00E5FF] hover:underline inline-flex items-center gap-0.5 mt-1">
                      Get token <ExternalLink className="w-2 h-2" />
                    </a>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input type="password" placeholder="Enter token..."
                    value={st.tokenInput} onChange={(e) => updateState(pid, { tokenInput: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveToken(pid)}
                    className="h-8 text-[11px] font-mono bg-white/[0.03] border-white/[0.06] text-[#E0F7FA] placeholder:text-[#547B88]" />
                  <Button onClick={() => handleSaveToken(pid)} disabled={!st.tokenInput.trim()}
                    className="h-8 px-3 bg-[#00E5FF] hover:bg-[#00E5FF]/85 text-[#03080a] font-semibold text-[11px] rounded-lg shrink-0">
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Main Content ── */}
          {hasToken && st.phase !== 'deploying' && st.phase !== 'monitoring' && st.phase !== 'result' && (
            <div className="space-y-4">
              {/* ── Existing Resources (collapsible) ── */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
                <button onClick={() => updateState(pid, { existingExpanded: !st.existingExpanded })}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3 h-3 text-[#547B88]" />
                    <span className="text-[10px] font-medium text-[#547B88] uppercase tracking-wider">
                      Existing {config.name} Resources
                    </span>
                    {st.hostItems.length > 0 && (
                      <Badge className="h-4 text-[8px] bg-white/5 text-[#547B88] border-white/10 rounded-md">
                        {st.hostItems.length}
                      </Badge>
                    )}
                  </div>
                  {st.existingExpanded ? (
                    <ChevronUp className="w-3 h-3 text-[#547B88]" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-[#547B88]" />
                  )}
                </button>

                <AnimatePresence>
                  {st.existingExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t border-white/[0.04]">
                        {st.hostItemsLoading ? (
                          <div className="text-center py-6">
                            <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin mx-auto mb-1" />
                            <p className="text-[10px] text-[#547B88]">Loading...</p>
                          </div>
                        ) : st.hostItemsError ? (
                          <div className="text-center py-4">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#FF2A5F] mx-auto mb-1" />
                            <p className="text-[10px] text-[#FF2A5F]">{st.hostItemsError}</p>
                            <button onClick={() => loadHostItems(pid)}
                              className="text-[9px] text-[#00E5FF] hover:underline mt-1 inline-flex items-center gap-0.5">
                              <RefreshCw className="w-2.5 h-2.5" /> Retry
                            </button>
                          </div>
                        ) : st.hostItems.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-[10px] text-[#547B88]">No existing {config.name} resources</p>
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto">
                            {st.hostItems.map((item) => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.02] transition-colors">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] text-[#E0F7FA] font-mono truncate">{item.name}</p>
                                  {item.url && <p className="text-[9px] text-[#547B88] truncate">{item.url}</p>}
                                </div>
                                <button onClick={() => handleRedeploy(pid, item.id)}
                                  className="text-[9px] font-medium text-[#00E5FF] hover:text-[#00E5FF]/80 px-2 py-1 rounded-md hover:bg-[#00E5FF]/10 transition-colors shrink-0 ml-2 opacity-70 group-hover:opacity-100">
                                  Redeploy
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── New Deployment ── */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5">
                    <Rocket className="w-3 h-3 text-[#00E5FF]" />
                    <span className="text-[10px] font-medium text-[#547B88] uppercase tracking-wider">
                      New Deployment
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  {!githubToken && (config.needsGitHubToken || config.id === 'github-pages') ? (
                    <div className="text-center py-4">
                      <Key className="w-4 h-4 text-[#FFB74D] mx-auto mb-2" />
                      <p className="text-[11px] text-[#FFB74D] font-medium">GitHub token required</p>
                      <p className="text-[10px] text-[#547B88] mt-1">Connect GitHub in the Agents tab to deploy repos.</p>
                    </div>
                  ) : st.reposLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin mx-auto" />
                    </div>
                  ) : st.repos.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-[10px] text-[#547B88]">No GitHub repos found</p>
                    </div>
                  ) : (
                    <>
                      {/* Repo selector */}
                      <div>
                        <label className="text-[9px] text-[#547B88] uppercase tracking-wider font-medium mb-1 block">Repository</label>
                        <div className="max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02]">
                          {st.repos.slice(0, 20).map((repo) => (
                            <button key={repo.id} onClick={() => {
                              updateState(pid, { selectedRepo: repo.full_name, selectedBranch: '', branches: [] });
                              loadBranches(pid, repo.full_name);
                            }}
                              className={`w-full text-left px-2.5 py-2 border-b border-white/[0.03] last:border-0 transition-colors flex items-center justify-between group ${
                                st.selectedRepo === repo.full_name ? 'bg-[#00E5FF]/5 border-l-2 border-l-[#00E5FF]' : 'hover:bg-white/[0.03]'
                              }`}>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-[#E0F7FA] font-mono truncate">{repo.full_name}</p>
                                <p className="text-[9px] text-[#547B88] truncate">{repo.description || 'No description'}</p>
                              </div>
                              {st.selectedRepo === repo.full_name && (
                                <CheckCircle2 className="w-3 h-3 text-[#00E5FF] shrink-0 ml-2" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Branch selector */}
                      {st.selectedRepo && (
                        <div>
                          <label className="text-[9px] text-[#547B88] uppercase tracking-wider font-medium mb-1 block">Branch</label>
                          {st.branchesLoading ? (
                            <div className="text-center py-2">
                              <Loader2 className="w-3 h-3 text-[#00E5FF] animate-spin mx-auto" />
                            </div>
                          ) : st.branches.length > 0 ? (
                            <div className="max-h-24 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02]">
                              {st.branches.map((b) => (
                                <button key={b.name} onClick={() => updateState(pid, { selectedBranch: b.name })}
                                  className={`w-full text-left px-2.5 py-1.5 border-b border-white/[0.03] last:border-0 transition-colors flex items-center justify-between ${
                                    st.selectedBranch === b.name ? 'bg-[#00E5FF]/5 border-l-2 border-l-[#00E5FF]' : 'hover:bg-white/[0.03]'
                                  }`}>
                                  <span className="text-[11px] text-[#E0F7FA] font-mono">{b.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    {b.default && <Badge className="h-3.5 text-[7px] bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/25 rounded px-1">default</Badge>}
                                    {st.selectedBranch === b.name && <CheckCircle2 className="w-3 h-3 text-[#00E5FF]" />}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#547B88] text-center py-2">No branches found</p>
                          )}
                        </div>
                      )}

                      {/* Deploy button */}
                      <Button
                        onClick={() => handleDeployFromRepo(pid)}
                        disabled={!st.selectedRepo || !st.selectedBranch}
                        className="w-full h-9 bg-[#00E5FF] hover:bg-[#00E5FF]/85 text-[#03080a] font-semibold text-xs rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Rocket className="w-3.5 h-3.5 mr-1.5" />
                        Deploy to {config.name}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Deploying State ── */}
          {(st.phase === 'deploying' || st.phase === 'monitoring') && (
            <div className="text-center py-10 space-y-3">
              <Loader2 className="w-7 h-7 text-[#00E5FF] animate-spin mx-auto" />
              <p className="text-sm text-[#E0F7FA]">
                {st.isRedeploy ? 'Triggering redeploy...' : 'Creating deployment...'}
              </p>
              <p className="text-[10px] text-[#547B88]">Communicating with {config.name}</p>
              {st.isMonitoring && st.deploymentStatus && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#FFB74D] animate-pulse" />
                    <span className="text-[10px] font-medium text-[#FFB74D]">Monitoring workflow</span>
                  </div>
                  <p className="text-[10px] text-[#547B88]">{st.deploymentStatus.message}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Result State ── */}
          {st.phase === 'result' && st.deployResult && (
            <div className="space-y-3">
              {st.deployResult.success ? (
                <>
                  {/* Success */}
                  <div className="text-center py-4 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#00E676]/10 flex items-center justify-center mx-auto border border-[#00E676]/20">
                      <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
                    </div>
                    <h3 className="text-xs font-semibold text-[#00E676]">Deployment Created</h3>
                  </div>

                  {/* Setup Steps */}
                  {st.deployResult.setup_steps && st.deployResult.setup_steps.length > 0 && (
                    <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1.5">
                      <h4 className="text-[9px] font-semibold text-[#547B88] uppercase tracking-wider">Setup Progress</h4>
                      {st.deployResult.setup_steps.map((step) => (
                        <div key={step.step} className="flex items-center gap-2 text-[10px]">
                          {step.done ? (
                            <CheckCircle2 className="w-3 h-3 text-[#00E676] shrink-0" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-[#547B88]/40 shrink-0" />
                          )}
                          {step.link ? (
                            <a href={step.link} target="_blank" rel="noopener noreferrer"
                              className="text-[#E0F7FA] hover:text-[#00E5FF] hover:underline flex-1 flex items-center gap-0.5">
                              {step.text} <ExternalLink className="w-2 h-2 shrink-0" />
                            </a>
                          ) : (
                            <span className={step.done ? 'text-[#E0F7FA]' : 'text-[#547B88]'}>{step.text}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual repo link notice */}
                  {st.deployResult.needs_manual_repo_link && (
                    <div className="p-3 rounded-xl bg-[#FFB74D]/5 border border-[#FFB74D]/15 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-[#FFB74D]" />
                        <span className="text-[10px] font-medium text-[#FFB74D]">Manual step required</span>
                      </div>
                      <p className="text-[9px] text-[#547B88] leading-relaxed">
                        Connect your GitHub repo in the {config.name} dashboard to enable automatic builds on push.
                      </p>
                      {st.deployResult.dashboard_link && (
                        <a href={st.deployResult.dashboard_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[9px] text-[#00E5FF] hover:underline">
                          Open {config.name} Dashboard <ExternalLink className="w-2 h-2" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Message */}
                  {st.deployResult.message && !st.deployResult.needs_manual_repo_link && (
                    <p className="text-[10px] text-[#547B88] leading-relaxed text-center">{st.deployResult.message}</p>
                  )}

                  {/* URLs */}
                  <div className="space-y-1">
                    {st.deployResult.url && (
                      <a href={st.deployResult.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                        <Globe className="w-3 h-3 text-[#00E5FF] shrink-0" />
                        <span className="text-[10px] text-[#00E5FF] truncate flex-1 group-hover:underline">{st.deployResult.url}</span>
                        <ExternalLink className="w-2 h-2 text-[#547B88] shrink-0" />
                      </a>
                    )}
                    {st.deployResult.workflow_url && (
                      <a href={st.deployResult.workflow_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                        <Zap className="w-3 h-3 text-[#B388FF] shrink-0" />
                        <span className="text-[10px] text-[#B388FF] truncate flex-1 group-hover:underline">GitHub Actions</span>
                        <ExternalLink className="w-2 h-2 text-[#547B88] shrink-0" />
                      </a>
                    )}
                    {st.deployResult.dashboard_link && !st.deployResult.needs_manual_repo_link && (
                      <a href={st.deployResult.dashboard_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                        <ExternalLink className="w-3 h-3 text-[#547B88] shrink-0" />
                        <span className="text-[10px] text-[#547B88] truncate flex-1 group-hover:underline">{config.name} Dashboard</span>
                        <ExternalLink className="w-2 h-2 text-[#547B88] shrink-0" />
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => handleDone(pid)}
                      className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-[10px] rounded-lg">
                      Deploy Another
                    </Button>
                    <Button onClick={handleClose}
                      className="flex-1 h-8 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/15 text-[#00E5FF] text-[10px] rounded-lg border border-[#00E5FF]/20">
                      Done
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Failure */}
                  <div className="text-center py-4 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#FF2A5F]/10 flex items-center justify-center mx-auto border border-[#FF2A5F]/20">
                      <X className="w-5 h-5 text-[#FF2A5F]" />
                    </div>
                    <h3 className="text-xs font-semibold text-[#FF2A5F]">Deployment Failed</h3>
                    <p className="text-[10px] text-[#547B88] max-w-[280px] mx-auto leading-relaxed">{st.deployResult.error || 'Unknown error'}</p>
                    {st.deployResult.hint && (
                      <p className="text-[9px] text-[#FFB74D] max-w-[280px] mx-auto leading-relaxed">{st.deployResult.hint}</p>
                    )}
                    {st.deployResult.dashboard_link && st.deployResult.needs_manual_repo_link && (
                      <a href={st.deployResult.dashboard_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[9px] text-[#00E5FF] hover:underline">
                        Open {config.name} Dashboard <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleRetry(pid)}
                      className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-[10px] rounded-lg">
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry
                    </Button>
                    <Button onClick={() => handleDone(pid)}
                      className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-[10px] rounded-lg">
                      Back
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // ── Main render ──

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] p-0 bg-[#0a1015] border-[#00E5FF]/15 overflow-hidden">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-semibold text-[#E0F7FA]">Deploy</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}
              className="text-[#547B88] hover:text-[#E0F7FA] hover:bg-white/5 h-7 w-7">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Provider Tabs */}
          <div className="flex border-b border-white/[0.06] shrink-0 px-2 pt-2">
            {providerConfigs.map((pc) => {
              const Icon = pc.icon;
              const isActive = activeTab === pc.id;
              return (
                <button key={pc.id} onClick={() => handleTabSwitch(pc.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-[11px] font-medium rounded-t-lg transition-all relative ${
                    isActive
                      ? 'text-[#00E5FF] bg-white/[0.03]'
                      : 'text-[#547B88] hover:text-[#E0F7FA] hover:bg-white/[0.01]'
                  }`}>
                  <Icon className="w-3 h-3" style={{ color: isActive ? '#00E5FF' : pc.color }} />
                  <span className="hidden sm:inline">{pc.name}</span>
                  <span className="sm:hidden">{pc.id === 'github-pages' ? 'Pages' : pc.name.slice(0, 4)}</span>
                  {isActive && (
                    <motion.div layoutId="activeTab"
                      className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#00E5FF] rounded-full"
                      transition={{ duration: 0.2 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {renderProviderContent(activeTab)}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
