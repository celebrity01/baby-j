'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X, Globe, Server, CheckCircle2, Loader2, ArrowRight,
  ChevronRight, ExternalLink, Key, AlertTriangle, Clock,
  Zap, FileCode, Shield, ArrowLeft, RefreshCw,
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

type DeployStep =
  | 'select-provider'
  | 'api-key'
  | 'select-item'
  | 'select-branch'
  | 'confirm'
  | 'deploying'
  | 'result';

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: typeof Globe;
  color: string;
  storageKey: string;
  helpUrl: string;
  helpText: string;
  needsProviderToken: boolean;
  needsGitHubToken: boolean;
}

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

// ===== Provider Configs =====

const providers: ProviderConfig[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Automatic deploys from Git. Zero-config for Next.js.',
    icon: Globe,
    color: '#ffffff',
    storageKey: 'vercel-token',
    helpUrl: 'https://vercel.com/account/tokens',
    helpText: 'Create a token at vercel.com/account/tokens. Scope: Full Account.',
    needsProviderToken: true,
    needsGitHubToken: true,
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Instant builds and deploys. Global CDN.',
    icon: Shield,
    color: '#00E676',
    storageKey: 'netlify-token',
    helpUrl: 'https://app.netlify.com/user/applications/personal',
    helpText: 'Create a personal access token at app.netlify.com/user/applications.',
    needsProviderToken: true,
    needsGitHubToken: false,
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Modern cloud. Web services, static sites, cron jobs.',
    icon: Server,
    color: '#B388FF',
    storageKey: 'render-api-key',
    helpUrl: 'https://dashboard.render.com/account/api-keys',
    helpText: 'Create an API key at dashboard.render.com/account (team plan required).',
    needsProviderToken: true,
    needsGitHubToken: false,
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    description: 'Free hosting directly from your GitHub repo.',
    icon: Globe,
    color: '#58A6FF',
    storageKey: 'github-token',
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Uses your connected GitHub token. Needs repo + workflow scopes.',
    needsProviderToken: false,
    needsGitHubToken: true,
  },
];

// ===== Error Extractor =====

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
  const [step, setStep] = useState<DeployStep>('select-provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<{ name: string; default?: boolean }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [hostItems, setHostItems] = useState<{ id: string; name: string; url?: string }[]>([]);
  const [selectedHostItem, setSelectedHostItem] = useState('');
  const [selectedHostItemName, setSelectedHostItemName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [itemTab, setItemTab] = useState<'host' | 'github'>('github');
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [loadItemsError, setLoadItemsError] = useState('');

  // Monitoring state (for GitHub Pages workflow)
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const monitorInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    return () => {
      if (monitorInterval.current) clearInterval(monitorInterval.current);
    };
  }, []);

  const reset = useCallback(() => {
    setStep('select-provider');
    setSelectedProvider(null);
    setTokenInput('');
    setSavedToken(null);
    setRepos([]);
    setBranches([]);
    setSelectedRepo('');
    setSelectedBranch('');
    setHostItems([]);
    setSelectedHostItem('');
    setSelectedHostItemName('');
    setIsDeploying(false);
    setDeployResult(null);
    setItemTab('github');
    setIsLoadingItems(false);
    setLoadItemsError('');
    setDeploymentStatus(null);
    setIsMonitoring(false);
    if (monitorInterval.current) clearInterval(monitorInterval.current);
    monitorInterval.current = null;
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // ── Provider Selection ──

  const handleSelectProvider = (provider: ProviderConfig) => {
    setSelectedProvider(provider);

    if (!provider.needsProviderToken) {
      // GitHub Pages — uses existing GitHub token
      if (!githubToken) {
        setLoadItemsError('Connect GitHub first to use GitHub Pages.');
        return;
      }
      setSavedToken(githubToken);
      setStep('select-item');
      loadItems(provider, githubToken);
    } else {
      const stored = localStorage.getItem(provider.storageKey);
      if (stored) {
        setSavedToken(stored);
        setStep('select-item');
        loadItems(provider, stored);
      } else {
        setStep('api-key');
      }
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim() || !selectedProvider) return;
    localStorage.setItem(selectedProvider.storageKey, tokenInput.trim());
    setSavedToken(tokenInput.trim());
    setStep('select-item');
    await loadItems(selectedProvider, tokenInput.trim());
  };

  // ── Load Items ──

  const loadItems = async (provider: ProviderConfig, token: string) => {
    setIsLoadingItems(true);
    setLoadItemsError('');
    try {
      // Load existing projects from provider
      if (provider.id === 'vercel') {
        const res = await fetch('/api/vercel/projects', { headers: { 'X-Vercel-Token': token } });
        if (!res.ok) throw new Error(`Failed to load Vercel projects (${res.status})`);
        const data = await res.json();
        setHostItems((data || []).map((p: Record<string, unknown>) => ({
          id: p.id as string, name: p.name as string, url: (p.alias as string[])?.[0] || (p.url as string),
        })));
      } else if (provider.id === 'netlify') {
        const res = await fetch('/api/netlify/sites', { headers: { 'X-Netlify-Token': token } });
        if (!res.ok) throw new Error(`Failed to load Netlify sites (${res.status})`);
        const data = await res.json();
        setHostItems((data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string, name: s.name as string, url: (s.ssl_url as string) || (s.url as string),
        })));
      } else if (provider.id === 'render') {
        const res = await fetch('/api/render/services', { headers: { 'X-Render-Api-Key': token } });
        if (!res.ok) throw new Error(`Failed to load Render services (${res.status})`);
        const data = await res.json();
        setHostItems((data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string, name: s.name as string || s.id, url: s.url as string,
        })));
      } else if (provider.id === 'github-pages') {
        const res = await fetch('/api/github-pages/sites', { headers: { 'X-GitHub-Token': token } });
        if (res.ok) {
          const data = await res.json();
          setHostItems((data || []).map((s: Record<string, unknown>) => {
            const htmlUrl = s.html_url as string;
            const urlParts = (htmlUrl || '').replace(/\/$/, '').split('/');
            const repoSlug = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}` : htmlUrl;
            return { id: repoSlug, name: (s.repo_name as string) || repoSlug, url: htmlUrl };
          }));
        }
      }

      // Always load GitHub repos
      if (githubToken) {
        const ghRepos = await listGitHubRepos(githubToken);
        setRepos(ghRepos);
      }
    } catch (err) {
      setLoadItemsError(extractErrorMessage(err, 'Failed to load items.'));
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectRepo = async (fullName: string) => {
    setSelectedRepo(fullName);
    setSelectedBranch('');
    if (!githubToken) {
      setLoadItemsError('GitHub token required for branch loading.');
      return;
    }
    try {
      const [owner, repo] = fullName.split('/');
      const b = await listBranches(githubToken, owner, repo);
      setBranches(b.map((br) => ({ name: br.name, default: br.default })));
      const def = b.find((br) => br.default) || b[0];
      if (def) setSelectedBranch(def.name);
      setStep('select-branch');
    } catch {
      setLoadItemsError('Failed to load branches.');
    }
  };

  // ── Monitoring ──

  const startMonitoring = (owner: string, repo: string) => {
    if (!githubToken) return;
    setIsMonitoring(true);
    setDeploymentStatus({ status: 'queued', message: 'Waiting for workflow to register...' });
    let attempts = 0;

    monitorInterval.current = setInterval(async () => {
      attempts++;
      if (attempts > 40) {
        if (monitorInterval.current) clearInterval(monitorInterval.current);
        setDeploymentStatus({ status: 'timeout', message: 'Taking longer than expected. Check GitHub Actions tab.' });
        setIsMonitoring(false);
        return;
      }
      try {
        const status = await getDeploymentStatus(githubToken, {
          owner, repo, workflow_file: 'deploy-pages.yml',
        });
        setDeploymentStatus(status);
        if (status.status === 'success' || status.status === 'failed' || status.status === 'cancelled') {
          if (monitorInterval.current) clearInterval(monitorInterval.current);
          setIsMonitoring(false);
          setTimeout(() => {
            setDeployResult({
              success: status.status === 'success',
              url: status.status === 'success' ? deployResult?.url : undefined,
              message: status.message,
              workflow_url: status.html_url,
              error: status.status !== 'success' ? status.message : undefined,
            });
            setStep('result');
          }, 1500);
        }
      } catch { /* retry */ }
    }, 10000);
  };

  // ── Deploy ──

  const canDeploy = (itemTab === 'host' && selectedHostItem) || (itemTab === 'github' && selectedRepo && selectedBranch);

  const handleConfirm = async () => {
    if (!selectedProvider || !canDeploy) return;
    const providerToken = selectedProvider.needsProviderToken ? savedToken : (githubToken || '');
    if (!providerToken && selectedProvider.needsProviderToken) return;

    setIsDeploying(true);
    setStep('deploying');

    try {
      let result: DeployResult;

      if (!providerToken) {
        result = { success: false, error: 'Provider token is missing.' };
      } else if (selectedHostItem && itemTab === 'host') {
        result = await triggerRedeploy(selectedProvider, providerToken, selectedHostItem);
      } else if (selectedRepo && selectedBranch) {
        result = await deployFromRepo(selectedProvider, providerToken, selectedRepo, selectedBranch);
      } else {
        result = { success: false, error: 'No deployment target selected.' };
      }

      setDeployResult(result);

      // Start monitoring for GitHub Pages
      if (result.workflow_triggered && result.pages_enabled && selectedRepo) {
        const [owner, repo] = selectedRepo.split('/');
        startMonitoring(owner, repo);
        return;
      }

      setStep('result');
    } catch (err) {
      setDeployResult({
        success: false,
        error: extractErrorMessage(err, 'Deployment failed. Check credentials and try again.'),
      });
      setStep('result');
    } finally {
      setIsDeploying(false);
    }
  };

  const triggerRedeploy = async (provider: ProviderConfig, token: string, itemId: string): Promise<DeployResult> => {
    if (provider.id === 'vercel') {
      const data = await deployVercel(token, { projectId: itemId }) as Record<string, unknown>;
      return { success: true, url: (data.url as string) || (data.alias as string[])?.[0] };
    } else if (provider.id === 'netlify') {
      const data = await deployNetlify(token, { siteId: itemId }) as Record<string, unknown>;
      return { success: true, url: (data.ssl_url as string) || (data.url as string) };
    } else if (provider.id === 'render') {
      const data = await deployRender(token, { serviceId: itemId }) as Record<string, unknown>;
      const saved = hostItems.find(h => h.id === itemId);
      return { success: true, url: (data.url as string) || saved?.url };
    } else if (provider.id === 'github-pages') {
      const [owner, repo] = itemId.split('/');
      const data = await deployPages(token, { owner, repo, branch: selectedBranch }) as Record<string, unknown>;
      return {
        success: !!(data.success),
        url: (data.url as string) || `https://${owner}.github.io/${repo}/`,
        message: data.message as string,
        workflow_url: data.workflow_url as string,
        pages_enabled: data.pages_enabled as boolean,
        workflow_triggered: data.workflow_triggered as boolean,
      };
    }
    return { success: false, error: 'Redeploy not supported for this provider.' };
  };

  const deployFromRepo = async (
    provider: ProviderConfig, token: string, repoFullName: string, branch: string
  ): Promise<DeployResult> => {
    const [owner, repo] = repoFullName.split('/');

    if (provider.id === 'vercel') {
      const data = await createVercelProject(token, {
        name: repo, repoOwner: owner, repoName: repo, branch,
      }) as Record<string, unknown>;
      return {
        success: true,
        url: (data.url as string) || (data.alias as string[])?.[0] || `https://${repo}-vercel.app`,
        message: data.message as string,
        dashboard_link: data.dashboard_link as string,
        setup_steps: data.setup_steps as SetupStep[],
        git_linked: data.git_linked as boolean,
      };
    } else if (provider.id === 'netlify') {
      const data = await createNetlifySite(token, {
        name: repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
        branch,
      }, githubToken) as Record<string, unknown>;
      return {
        success: true,
        url: (data.url as string) || (data.ssl_url as string),
        message: data.message as string,
        dashboard_link: data.dashboard_link as string,
        setup_steps: data.setup_steps as SetupStep[],
        needs_manual_repo_link: data.needs_manual_repo_link as boolean,
      };
    } else if (provider.id === 'render') {
      const data = await createRenderService(token, {
        name: repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
        branch,
        runtime: 'node',
      }) as Record<string, unknown>;
      return {
        success: true,
        url: (data.url as string),
        message: data.message as string,
        dashboard_link: data.dashboard_link as string,
        setup_steps: data.setup_steps as SetupStep[],
      };
    } else if (provider.id === 'github-pages') {
      const data = await deployPages(githubToken || '', { owner, repo, branch }) as Record<string, unknown>;
      return {
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
    }
    return { success: false, error: 'Unsupported provider.' };
  };

  // ── Render ──

  const currentProvider = selectedProvider;

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[88vh] p-0 bg-[#0a1015] border-[#00E5FF]/15 overflow-hidden">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-semibold text-[#E0F7FA]">Deploy</h2>
              {currentProvider && (
                <Badge className="h-4 text-[9px] px-1.5 rounded-md" style={{
                  background: `${currentProvider.color}15`,
                  color: currentProvider.color,
                  borderColor: `${currentProvider.color}30`,
                }}>
                  {currentProvider.name}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}
              className="text-[#547B88] hover:text-[#E0F7FA] hover:bg-white/5">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto">

              {/* ═══ SELECT PROVIDER ═══ */}
              {step === 'select-provider' && (
                <div className="p-4 space-y-2.5">
                  <p className="text-xs text-[#547B88] mb-3">Choose where to deploy your project</p>
                  {providers.map((provider) => {
                    const hasToken = !provider.needsProviderToken || !!localStorage.getItem(provider.storageKey);
                    const hasGitHub = !provider.needsGitHubToken || !!githubToken;
                    const Icon = provider.icon;
                    const isReady = hasToken && hasGitHub;
                    return (
                      <button key={provider.id} onClick={() => handleSelectProvider(provider)}
                        className="group w-full text-left p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${provider.color}12` }}>
                              <Icon className="w-4 h-4" style={{ color: provider.color }} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#E0F7FA]">{provider.name}</p>
                              <p className="text-[11px] text-[#547B88] mt-0.5 leading-relaxed">{provider.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {isReady ? (
                              <Badge className="h-4 text-[8px] bg-[#00E676]/10 text-[#00E676] border-[#00E676]/25">Ready</Badge>
                            ) : (
                              <Badge className="h-4 text-[8px] bg-[#FFB74D]/10 text-[#FFB74D] border-[#FFB74D]/25">Setup</Badge>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-[#547B88] group-hover:text-[#E0F7FA] transition-colors" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ═══ API KEY ═══ */}
              {step === 'api-key' && currentProvider && (
                <div className="p-4 space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <Key className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[#E0F7FA] font-medium">{currentProvider.name} API Token</p>
                      <p className="text-[11px] text-[#547B88] mt-1 leading-relaxed">{currentProvider.helpText}</p>
                      <a href={currentProvider.helpUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-[#00E5FF] hover:underline inline-flex items-center gap-1 mt-1.5">
                        Get token <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <Input type="password" placeholder={`Enter ${currentProvider.name} API token...`}
                    value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                    className="h-10 text-sm font-mono bg-white/[0.03] border-white/[0.06] text-[#E0F7FA] placeholder:text-[#547B88]" />
                  <Button onClick={handleSaveToken} disabled={!tokenInput.trim()}
                    className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/85 text-[#03080a] font-semibold text-sm rounded-xl">
                    Save & Continue
                  </Button>
                </div>
              )}

              {/* ═══ SELECT ITEM ═══ */}
              {step === 'select-item' && currentProvider && (
                <div className="p-4 space-y-3">
                  <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
                    <button onClick={() => setItemTab('host')}
                      className={`flex-1 py-1.5 rounded-md text-xs transition-colors ${itemTab === 'host' ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-medium' : 'text-[#547B88] hover:text-[#E0F7FA]'}`}>
                      Existing {currentProvider.name} Projects
                    </button>
                    <button onClick={() => setItemTab('github')}
                      className={`flex-1 py-1.5 rounded-md text-xs transition-colors ${itemTab === 'github' ? 'bg-[#00E5FF]/15 text-[#00E5FF] font-medium' : 'text-[#547B88] hover:text-[#E0F7FA]'}`}>
                      GitHub Repos
                    </button>
                  </div>

                  {isLoadingItems ? (
                    <div className="text-center py-12"><Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin mx-auto mb-2" /><p className="text-xs text-[#547B88]">Loading...</p></div>
                  ) : loadItemsError ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-5 h-5 text-[#FF2A5F] mx-auto mb-2" />
                      <p className="text-xs text-[#FF2A5F]">{loadItemsError}</p>
                      <Button variant="ghost" size="sm" onClick={() => savedToken && loadItems(currentProvider, savedToken)}
                        className="mt-2 text-[10px] text-[#00E5FF]"><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button>
                    </div>
                  ) : itemTab === 'host' ? (
                    hostItems.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-[#547B88]">No existing {currentProvider.name} projects found</p>
                        <p className="text-[10px] text-[#547B88] mt-1">Switch to &quot;GitHub Repos&quot; to create a new deployment</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {hostItems.map((item) => (
                          <button key={item.id} onClick={() => { setSelectedHostItem(item.id); setSelectedHostItemName(item.url || item.name); setSelectedRepo(''); setStep('confirm'); }}
                            className="w-full text-left p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all flex items-center justify-between group">
                            <div className="min-w-0">
                              <p className="text-xs text-[#E0F7FA] font-mono truncate">{item.name}</p>
                              {item.url && <p className="text-[10px] text-[#547B88] truncate mt-0.5">{item.url}</p>}
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#547B88] group-hover:text-[#E0F7FA] shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    repos.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-[#547B88]">{githubToken ? 'No repos found' : 'Connect GitHub to browse repos'}</p>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                        {repos.slice(0, 25).map((repo) => (
                          <button key={repo.id} onClick={() => handleSelectRepo(repo.full_name)}
                            className="w-full text-left p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all flex items-center justify-between group">
                            <div className="min-w-0">
                              <p className="text-xs text-[#E0F7FA] font-mono truncate">{repo.full_name}</p>
                              <p className="text-[10px] text-[#547B88] truncate">{repo.description || 'No description'}</p>
                            </div>
                            <ChevronRight className="w-3 h-3 text-[#547B88] group-hover:text-[#E0F7FA] shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* ═══ SELECT BRANCH ═══ */}
              {step === 'select-branch' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-[#547B88]">
                    Select branch for <span className="text-[#E0F7FA] font-mono">{selectedRepo}</span>
                  </p>
                  <div className="space-y-1">
                    {branches.map((b) => (
                      <button key={b.name} onClick={() => { setSelectedBranch(b.name); setSelectedHostItem(''); setStep('confirm'); }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                          selectedBranch === b.name ? 'border-[#00E5FF]/25 bg-[#00E5FF]/5' : 'border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04]'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#E0F7FA] font-mono">{b.name}</span>
                          {b.default && <Badge className="h-4 text-[8px] bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/25">default</Badge>}
                        </div>
                        <ChevronRight className="w-3 h-3 text-[#547B88]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ CONFIRM ═══ */}
              {step === 'confirm' && currentProvider && (
                <div className="p-4 space-y-4">
                  <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2.5">
                    <h3 className="text-[10px] font-semibold text-[#547B88] uppercase tracking-wider">Deployment Summary</h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-[#547B88]">Provider</span><span className="text-[#E0F7FA]">{currentProvider.name}</span></div>
                      {itemTab === 'host' && <div className="flex justify-between"><span className="text-[#547B88]">Project</span><span className="text-[#E0F7FA] font-mono truncate max-w-[200px]">{selectedHostItemName || selectedHostItem}</span></div>}
                      {selectedRepo && <div className="flex justify-between"><span className="text-[#547B88]">Repository</span><span className="text-[#E0F7FA] font-mono truncate max-w-[200px]">{selectedRepo}</span></div>}
                      {selectedBranch && <div className="flex justify-between"><span className="text-[#547B88]">Branch</span><span className="text-[#E0F7FA] font-mono">{selectedBranch}</span></div>}
                      <div className="flex justify-between"><span className="text-[#547B88]">Action</span><span className="text-[#E0F7FA]">{itemTab === 'host' ? 'Redeploy' : 'Create & Deploy'}</span></div>
                    </div>
                    {currentProvider.id === 'netlify' && itemTab === 'github' && (
                      <div className="mt-2 p-2 rounded-lg bg-[#FFB74D]/5 border border-[#FFB74D]/10">
                        <p className="text-[10px] text-[#FFB74D] leading-relaxed">
                          Netlify will create a bare site. Connect your repo in the Netlify dashboard to enable auto-deploys.
                        </p>
                      </div>
                    )}
                    {currentProvider.id === 'github-pages' && itemTab === 'github' && (
                      <div className="mt-2 p-2 rounded-lg bg-[#00E5FF]/5 border border-[#00E5FF]/10">
                        <p className="text-[10px] text-[#00E5FF] leading-relaxed">
                          Deploys via GitHub Actions — workflow file will be pushed to your repo automatically.
                        </p>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleConfirm} disabled={!canDeploy || isDeploying}
                    className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/85 text-[#03080a] font-semibold text-sm rounded-xl disabled:opacity-30 disabled:cursor-not-allowed">
                    <Globe className="w-4 h-4 mr-2" />
                    {itemTab === 'host' ? 'Redeploy Now' : 'Create & Deploy'}
                  </Button>
                </div>
              )}

              {/* ═══ DEPLOYING ═══ */}
              {step === 'deploying' && (
                <div className="p-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin mx-auto" />
                  <p className="text-sm text-[#E0F7FA]">Creating deployment...</p>
                  <p className="text-xs text-[#547B88]">Communicating with {currentProvider?.name}</p>
                  {isMonitoring && deploymentStatus && (
                    <div className="mt-4 text-left">
                      <p className="text-[10px] text-[#547B88]">{deploymentStatus.message}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ RESULT ═══ */}
              {step === 'result' && deployResult && (
                <div className="p-5 space-y-4">
                  {deployResult.success ? (
                    <>
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-[#00E676]/10 flex items-center justify-center mx-auto border border-[#00E676]/20">
                          <CheckCircle2 className="w-6 h-6 text-[#00E676]" />
                        </div>
                        <h3 className="text-sm font-semibold text-[#00E676]">Deployment Created</h3>
                      </div>

                      {/* Setup Steps */}
                      {deployResult.setup_steps && deployResult.setup_steps.length > 0 && (
                        <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                          <h4 className="text-[10px] font-semibold text-[#547B88] uppercase tracking-wider">Setup Progress</h4>
                          {deployResult.setup_steps.map((s) => (
                            <div key={s.step} className="flex items-center gap-2 text-xs">
                              {s.done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-[#547B88]/40 shrink-0" />
                              )}
                              {s.link ? (
                                <a href={s.link} target="_blank" rel="noopener noreferrer"
                                  className="text-[#E0F7FA] hover:text-[#00E5FF] hover:underline flex-1 flex items-center gap-1">
                                  {s.text} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              ) : (
                                <span className={s.done ? 'text-[#E0F7FA]' : 'text-[#547B88]'}>{s.text}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Manual repo link notice */}
                      {deployResult.needs_manual_repo_link && (
                        <div className="p-3 rounded-xl bg-[#FFB74D]/5 border border-[#FFB74D]/15 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#FFB74D]" />
                            <span className="text-[11px] font-medium text-[#FFB74D]">Manual step required</span>
                          </div>
                          <p className="text-[10px] text-[#547B88] leading-relaxed">
                            Connect your GitHub repo in the Netlify dashboard to enable automatic builds on push.
                          </p>
                          {deployResult.dashboard_link && (
                            <a href={deployResult.dashboard_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-[#00E5FF] hover:underline">
                              Open Netlify Dashboard <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Message */}
                      {deployResult.message && !deployResult.needs_manual_repo_link && (
                        <p className="text-[11px] text-[#547B88] leading-relaxed text-center">{deployResult.message}</p>
                      )}

                      {/* URLs */}
                      <div className="space-y-1.5">
                        {deployResult.url && (
                          <a href={deployResult.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                            <Globe className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                            <span className="text-[11px] text-[#00E5FF] truncate flex-1 group-hover:underline">{deployResult.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#547B88] shrink-0" />
                          </a>
                        )}
                        {deployResult.workflow_url && (
                          <a href={deployResult.workflow_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                            <Zap className="w-3.5 h-3.5 text-[#B388FF] shrink-0" />
                            <span className="text-[11px] text-[#B388FF] truncate flex-1 group-hover:underline">GitHub Actions</span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#547B88] shrink-0" />
                          </a>
                        )}
                        {deployResult.dashboard_link && !deployResult.needs_manual_repo_link && (
                          <a href={deployResult.dashboard_link} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group">
                            <ExternalLink className="w-3.5 h-3.5 text-[#547B88] shrink-0" />
                            <span className="text-[11px] text-[#547B88] truncate flex-1 group-hover:underline">{currentProvider?.name} Dashboard</span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#547B88] shrink-0" />
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-[#FF2A5F]/10 flex items-center justify-center mx-auto border border-[#FF2A5F]/20">
                          <X className="w-6 h-6 text-[#FF2A5F]" />
                        </div>
                        <h3 className="text-sm font-semibold text-[#FF2A5F]">Deployment Failed</h3>
                        <p className="text-xs text-[#547B88] max-w-xs mx-auto leading-relaxed">{deployResult.error || 'Unknown error'}</p>
                        {deployResult.hint && (
                          <p className="text-[10px] text-[#FFB74D] max-w-xs mx-auto leading-relaxed">{deployResult.hint}</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {deployResult.success ? (
                      <Button onClick={handleClose}
                        className="flex-1 h-9 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-xs rounded-xl">Done</Button>
                    ) : (
                      <Button onClick={() => { setDeployResult(null); setStep('confirm'); }}
                        className="w-full h-9 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-xs rounded-xl">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Go Back & Retry
                      </Button>
                    )}
                    <Button onClick={handleClose}
                      className={`${deployResult.success ? 'flex-1' : 'w-full'} h-9 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-xs rounded-xl`}>
                      {deployResult.success ? 'Deploy Another' : 'Close'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Back Button */}
          {step !== 'select-provider' && step !== 'result' && step !== 'deploying' && (
            <div className="px-5 py-2.5 border-t border-white/[0.06] shrink-0">
              <Button variant="ghost" onClick={() => {
                if (step === 'select-branch') setStep('select-item');
                else if (step === 'confirm') setStep(selectedRepo && selectedBranch && itemTab === 'github' ? 'select-branch' : 'select-item');
                else if (step === 'select-item') setStep(selectedProvider?.needsProviderToken && !localStorage.getItem(selectedProvider.storageKey) ? 'api-key' : 'select-provider');
              }} className="text-xs text-[#547B88] hover:text-[#E0F7FA]">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
