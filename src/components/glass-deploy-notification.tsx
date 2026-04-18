'use client';

import { useState, useCallback } from 'react';
import {
  X, Globe, Server, CheckCircle2, Loader2, ArrowRight,
  ChevronRight, ExternalLink, Key, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { GitHubRepo } from '@/lib/jules-client';
import { listGitHubRepos, listBranches, deployVercel, deployNetlify, deployRender, deployPages, createVercelProject, createNetlifySite, createRenderService } from '@/lib/jules-client';

interface GlassDeployNotificationProps {
  githubToken: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type DeployStep = 'select-provider' | 'api-key' | 'select-item' | 'select-branch' | 'confirm' | 'deploying' | 'result';

interface ProviderConfig {
  id: string;
  name: string;
  icon: typeof Globe;
  color: string;
  storageKey: string;
  helpUrl: string;
  helpText: string;
}

const providers: ProviderConfig[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: Globe,
    color: '#E0F7FA',
    storageKey: 'vercel-token',
    helpUrl: 'https://vercel.com/account/tokens',
    helpText: 'Create a token at vercel.com/account/tokens with full account access.',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    icon: Globe,
    color: '#00E676',
    storageKey: 'netlify-token',
    helpUrl: 'https://app.netlify.com/user/applications/personal',
    helpText: 'Create a personal access token at app.netlify.com/user/applications.',
  },
  {
    id: 'render',
    name: 'Render',
    icon: Server,
    color: '#B388FF',
    storageKey: 'render-api-key',
    helpUrl: 'https://dashboard.render.com/y/account/api-keys',
    helpText: 'Create an API key at dashboard.render.com/y/account/api-keys.',
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    icon: Globe,
    color: '#E0F7FA',
    storageKey: 'github-token', // Reuse the main GitHub token
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Uses your connected GitHub token. Make sure it has the repo scope.',
  },
];

/** Extract a human-readable error message from API responses */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // Common API error patterns
    if (obj.error && typeof obj.error === 'string') return obj.error;
    if (obj.error && typeof obj.error === 'object') {
      const e = obj.error as Record<string, unknown>;
      return (e.message as string) || (e.code as string) || JSON.stringify(e);
    }
    if (obj.message && typeof obj.message === 'string') return obj.message;
    return JSON.stringify(obj);
  }
  return fallback;
}

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
  const [deployResult, setDeployResult] = useState<{ success: boolean; url?: string; error?: string; message?: string } | null>(null);
  const [itemTab, setItemTab] = useState<'host' | 'github'>('host');
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [loadItemsError, setLoadItemsError] = useState('');

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
    setItemTab('host');
    setIsLoadingItems(false);
    setLoadItemsError('');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectProvider = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    const stored = localStorage.getItem(provider.storageKey);
    if (stored) {
      setSavedToken(stored);
      setStep('select-item');
      loadItems(provider, stored);
    } else {
      setStep('api-key');
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim() || !selectedProvider) return;
    localStorage.setItem(selectedProvider.storageKey, tokenInput.trim());
    setSavedToken(tokenInput.trim());
    setStep('select-item');
    await loadItems(selectedProvider, tokenInput.trim());
  };

  const loadItems = async (provider: ProviderConfig, token: string) => {
    setIsLoadingItems(true);
    setLoadItemsError('');
    try {
      if (provider.id === 'vercel') {
        const res = await fetch('/api/vercel/projects', {
          headers: { 'X-Vercel-Token': token },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load Vercel projects (${res.status})`);
        }
        const data = await res.json();
        setHostItems((data || []).map((p: { id: string; name: string; url?: string }) => ({ id: p.id, name: p.name, url: p.url })));
      } else if (provider.id === 'netlify') {
        const res = await fetch('/api/netlify/sites', {
          headers: { 'X-Netlify-Token': token },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load Netlify sites (${res.status})`);
        }
        const data = await res.json();
        setHostItems((data || []).map((s: { id: string; name: string; url?: string }) => ({ id: s.id, name: s.name, url: s.url })));
      } else if (provider.id === 'render') {
        const res = await fetch('/api/render/services', {
          headers: { 'X-Render-Api-Key': token },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load Render services (${res.status})`);
        }
        const data = await res.json();
        setHostItems((data || []).map((s: { id: string; name: string; url?: string }) => ({
          id: s.id,
          name: s.name || s.id,
          url: s.url,
        })));
      } else if (provider.id === 'github-pages') {
        const res = await fetch('/api/github-pages/sites', {
          headers: { 'X-GitHub-Token': token },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load GitHub Pages sites (${res.status})`);
        }
        const data = await res.json();
        setHostItems((data || []).map((s: { html_url: string; repo_name: string; source?: { branch?: string } }) => {
          // Extract owner/repo from html_url (e.g. "https://github.com/owner/repo")
          const urlParts = (s.html_url || '').replace(/\/$/, '').split('/');
          const repoSlug = urlParts.length >= 2 ? `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}` : (s.repo_name || s.html_url);
          return {
            id: repoSlug,
            name: s.repo_name || repoSlug,
            url: s.html_url,
          };
        }));
      }

      // Load GitHub repos for GitHub Pages and other providers
      if (githubToken) {
        const ghRepos = await listGitHubRepos(githubToken);
        setRepos(ghRepos);
      }
    } catch (err) {
      setLoadItemsError(extractErrorMessage(err, 'Failed to load items. Check your token and try again.'));
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectRepo = async (fullName: string) => {
    setSelectedRepo(fullName);
    setSelectedBranch('');
    setSelectedHostItem('');
    setSelectedHostItemName('');
    if (!githubToken) {
      setLoadItemsError('GitHub token required to load branches. Connect GitHub in settings first.');
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
      setLoadItemsError('Failed to load branches. Check your GitHub token and try again.');
    }
  };

  const handleConfirm = async () => {
    if (!selectedProvider || !savedToken) return;
    setIsDeploying(true);
    setStep('deploying');

    try {
      let result: { success: boolean; url?: string; error?: string };

      if (selectedHostItem && itemTab === 'host') {
        // Redeploy existing project
        result = await triggerRedeploy(selectedProvider, savedToken, selectedHostItem);
      } else if (selectedRepo && selectedBranch) {
        // Create and deploy from GitHub repo
        result = await deployFromRepo(selectedProvider, savedToken, selectedRepo, selectedBranch);
      } else {
        result = { success: false, error: 'No deployment target selected. Select a project or GitHub repo.' };
      }

      setDeployResult(result);
      setStep('result');
    } catch (err) {
      setDeployResult({
        success: false,
        error: extractErrorMessage(err, 'Deployment failed with an unknown error. Please check your credentials and try again.'),
      });
      setStep('result');
    } finally {
      setIsDeploying(false);
    }
  };

  const triggerRedeploy = async (provider: ProviderConfig, token: string, itemId: string) => {
    if (provider.id === 'vercel') {
      const data = await deployVercel(token, { projectId: itemId }) as Record<string, unknown>;
      // Vercel returns url from our fixed route
      const url = (data.url as string) || (data.alias as string[])?.[0] || '';
      return { success: true, url };
    } else if (provider.id === 'netlify') {
      const data = await deployNetlify(token, { siteId: itemId }) as Record<string, unknown>;
      const url = (data.url as string) || (data.ssl_url as string) || '';
      return { success: true, url };
    } else if (provider.id === 'render') {
      const data = await deployRender(token, { serviceId: itemId }) as Record<string, unknown>;
      // For Render, the deploy endpoint may not return the service URL directly
      // Find the saved host item URL as fallback
      const savedItem = hostItems.find(h => h.id === itemId);
      const url = (data.url as string) || savedItem?.url || '';
      return { success: true, url };
    } else if (provider.id === 'github-pages') {
      const [owner, repo] = itemId.split('/');
      const data = await deployPages(token, { owner, repo, branch: selectedBranch }) as Record<string, unknown>;
      const url = (data.url as string) || `https://${owner}.github.io/${repo}/`;
      return { success: true, url };
    } else {
      return { success: false, error: 'Redeploy not supported for this provider' };
    }
  };

  const deployFromRepo = async (
    provider: ProviderConfig,
    token: string,
    repoFullName: string,
    branch: string
  ) => {
    const [owner, repo] = repoFullName.split('/');

    if (provider.id === 'vercel') {
      const data = await createVercelProject(token, {
        name: repo,
        repoOwner: owner,
        repoName: repo,
        branch,
      }) as Record<string, unknown>;
      const url = (data.url as string) || (data.alias as string[])?.[0] || `https://${repo}-vercel.app`;
      return { success: true, url };
    } else if (provider.id === 'netlify') {
      // Cross-system: pass githubToken so API can resolve repo to numeric ID
      const data = await createNetlifySite(token, {
        name: repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
        branch,
      }, githubToken) as Record<string, unknown>;
      const url = (data.url as string) || (data.ssl_url as string) || '';
      const message = data.message as string | undefined;
      return { success: true, url, message };
    } else if (provider.id === 'render') {
      const data = await createRenderService(token, {
        name: repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
        branch,
        runtime: 'node',
      }) as Record<string, unknown>;
      const url = (data.url as string) || (data.serviceDetails as Record<string, string>)?.url || '';
      return { success: true, url };
    } else if (provider.id === 'github-pages') {
      const data = await deployPages(token, { owner, repo, branch }) as Record<string, unknown>;
      const url = (data.url as string) || `https://${owner}.github.io/${repo}/`;
      const message = data.message as string | undefined;
      const success = !!(data.success);
      return { success, url, message, error: success ? undefined : (data.error as string) || 'GitHub Pages deployment failed' };
    }

    return { success: false, error: 'Unsupported provider' };
  };

  // currentProvider is always selectedProvider since it was set from the providers list
  const currentProvider = selectedProvider;

  // Determine if deploy button should be enabled
  const canDeploy = (itemTab === 'host' && selectedHostItem) || (itemTab === 'github' && selectedRepo && selectedBranch);

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 bg-[#0a1015] border-[#00E5FF]/15 overflow-hidden">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#00E5FF]/10 shrink-0">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-semibold text-[#E0F7FA]">Deploy</h2>
              {/* Step indicator */}
              <span className="text-[10px] text-[#547B88] ml-2">
                {step.replace(/-/g, ' ')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-[#547B88] hover:text-[#E0F7FA] hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Steps */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 overflow-y-auto"
            >
              {/* Select Provider */}
              {step === 'select-provider' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-[#547B88]">Select a deployment provider</p>
                  {providers.map((provider) => {
                    const hasToken = !!localStorage.getItem(provider.storageKey);
                    const Icon = provider.icon;
                    return (
                      <button
                        key={provider.id}
                        onClick={() => handleSelectProvider(provider)}
                        className="glass-card p-3.5 w-full flex items-center justify-between hover:border-[#00E5FF]/20 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: `${provider.color}15` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: provider.color }} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-[#E0F7FA]">{provider.name}</p>
                            <p className="text-[10px] text-[#547B88]">
                              {hasToken ? 'Connected' : 'Not connected'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasToken && (
                            <Badge className="h-4 text-[8px] bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30">
                              Connected
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-[#547B88]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* API Key */}
              {step === 'api-key' && currentProvider && (
                <div className="p-4 space-y-4">
                  <div className="glass-card p-3 flex items-start gap-2">
                    <Key className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[#E0F7FA] mb-1">{currentProvider.name} API Token</p>
                      <p className="text-[10px] text-[#547B88]">{currentProvider.helpText}</p>
                      <a
                        href={currentProvider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#00E5FF] hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Get token <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <Input
                    type="password"
                    placeholder={`Enter ${currentProvider.name} API token...`}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                    className="glass-input h-10 text-sm font-mono"
                  />
                  <Button
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim()}
                    className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl"
                  >
                    Save & Continue
                  </Button>
                </div>
              )}

              {/* Select Item */}
              {step === 'select-item' && currentProvider && (
                <div className="p-4 space-y-3">
                  {/* Tabs */}
                  <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03]">
                    <button
                      onClick={() => setItemTab('host')}
                      className={`flex-1 py-1.5 rounded-md text-xs transition-colors ${
                        itemTab === 'host'
                          ? 'bg-[#00E5FF]/15 text-[#00E5FF]'
                          : 'text-[#547B88] hover:text-[#E0F7FA]'
                      }`}
                    >
                      {currentProvider.name} Projects
                    </button>
                    <button
                      onClick={() => setItemTab('github')}
                      className={`flex-1 py-1.5 rounded-md text-xs transition-colors ${
                        itemTab === 'github'
                          ? 'bg-[#00E5FF]/15 text-[#00E5FF]'
                          : 'text-[#547B88] hover:text-[#E0F7FA]'
                      }`}
                    >
                      GitHub Repos
                    </button>
                  </div>

                  {isLoadingItems ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin mx-auto mb-2" />
                      <p className="text-xs text-[#547B88]">Loading projects...</p>
                    </div>
                  ) : loadItemsError ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-5 h-5 text-[#FF2A5F] mx-auto mb-2" />
                      <p className="text-xs text-[#FF2A5F]">{loadItemsError}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => savedToken && loadItems(currentProvider, savedToken)}
                        className="mt-2 text-[10px] text-[#00E5FF] hover:text-[#00E5FF]"
                      >
                        Retry
                      </Button>
                    </div>
                  ) : itemTab === 'host' ? (
                    hostItems.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-[#547B88]">No existing projects found</p>
                        <p className="text-[10px] text-[#547B88] mt-1">
                          Switch to &quot;GitHub Repos&quot; to deploy a new project
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {hostItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedHostItem(item.id);
                              setSelectedHostItemName(item.url || item.name);
                              setSelectedRepo('');
                              setSelectedBranch('');
                              setStep('confirm');
                            }}
                            className="glass-card p-3 w-full text-left flex items-center justify-between hover:border-[#00E5FF]/20 transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="text-xs text-[#E0F7FA] font-mono truncate block">{item.name}</span>
                              {item.url && (
                                <span className="text-[10px] text-[#547B88] truncate block mt-0.5">{item.url}</span>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-[#547B88] shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    repos.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-[#547B88]">
                          {githubToken ? 'No repos found' : 'Connect GitHub to browse repos'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                        {repos.slice(0, 20).map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => handleSelectRepo(repo.full_name)}
                            className="glass-card p-3 w-full text-left flex items-center justify-between hover:border-[#00E5FF]/20 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-[#E0F7FA] font-mono truncate">{repo.full_name}</p>
                              <p className="text-[10px] text-[#547B88] truncate">{repo.description || 'No description'}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-[#547B88] shrink-0" />
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Select Branch */}
              {step === 'select-branch' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-[#547B88]">
                    Select branch for <span className="text-[#E0F7FA] font-mono">{selectedRepo}</span>
                  </p>
                  {branches.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-[#547B88]">No branches found</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {branches.map((b) => (
                        <button
                          key={b.name}
                          onClick={() => {
                            setSelectedBranch(b.name);
                            setSelectedHostItem('');
                            setSelectedHostItemName('');
                            setStep('confirm');
                          }}
                          className={`glass-card p-3 w-full text-left flex items-center justify-between transition-colors ${
                            selectedBranch === b.name ? 'border-[#00E5FF]/30' : 'hover:border-[#00E5FF]/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#E0F7FA] font-mono">{b.name}</span>
                            {b.default && (
                              <Badge className="h-4 text-[8px] bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30">
                                default
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#547B88]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Confirm */}
              {step === 'confirm' && currentProvider && (
                <div className="p-4 space-y-4">
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-[#547B88] uppercase tracking-wider">
                      Deployment Summary
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-[#547B88]">Provider</span>
                        <span className="text-xs text-[#E0F7FA]">{currentProvider.name}</span>
                      </div>
                      {itemTab === 'host' && selectedHostItem && (
                        <div className="flex justify-between">
                          <span className="text-xs text-[#547B88]">Project</span>
                          <span className="text-xs text-[#E0F7FA] font-mono truncate max-w-[200px]">{selectedHostItemName || selectedHostItem}</span>
                        </div>
                      )}
                      {selectedRepo && (
                        <div className="flex justify-between">
                          <span className="text-xs text-[#547B88]">Repository</span>
                          <span className="text-xs text-[#E0F7FA] font-mono truncate max-w-[200px]">{selectedRepo}</span>
                        </div>
                      )}
                      {selectedBranch && (
                        <div className="flex justify-between">
                          <span className="text-xs text-[#547B88]">Branch</span>
                          <span className="text-xs text-[#E0F7FA] font-mono">{selectedBranch}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-xs text-[#547B88]">Action</span>
                        <span className="text-xs text-[#E0F7FA]">
                          {itemTab === 'host' ? 'Redeploy existing' : 'Create & deploy new'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleConfirm}
                    disabled={!canDeploy || isDeploying}
                    className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {itemTab === 'host' ? 'Redeploy Now' : 'Create & Deploy'}
                  </Button>
                </div>
              )}

              {/* Deploying */}
              {step === 'deploying' && (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin mx-auto mb-3" />
                  <p className="text-sm text-[#E0F7FA]">Deploying...</p>
                  <p className="text-xs text-[#547B88] mt-1">This may take a moment</p>
                </div>
              )}

              {/* Result */}
              {step === 'result' && deployResult && (
                <div className="p-6 text-center space-y-4">
                  {deployResult.success ? (
                    <>
                      <div className="w-14 h-14 rounded-full bg-[#00E676]/10 flex items-center justify-center mx-auto border border-[#00E676]/20">
                        <CheckCircle2 className="w-7 h-7 text-[#00E676]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#00E676]">Deployed Successfully!</h3>
                        {deployResult.url && (
                          <a
                            href={deployResult.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#00E5FF] hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            {deployResult.url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {deployResult.message && (
                          <p className="text-[10px] text-[#547B88] mt-1.5 max-w-[280px] mx-auto leading-relaxed">{deployResult.message}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-[#FF2A5F]/10 flex items-center justify-center mx-auto border border-[#FF2A5F]/20">
                        <X className="w-7 h-7 text-[#FF2A5F]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#FF2A5F]">Deployment Failed</h3>
                        <p className="text-xs text-[#547B88] mt-2 max-w-xs mx-auto leading-relaxed">{deployResult.error || 'Unknown error'}</p>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    {deployResult.success && (
                      <Button
                        onClick={handleClose}
                        className="flex-1 h-9 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-xs rounded-xl"
                      >
                        Done
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (deployResult.success) {
                          handleClose();
                        } else {
                          // Go back to confirm to retry
                          setDeployResult(null);
                          setStep('confirm');
                        }
                      }}
                      className={`${deployResult.success ? 'flex-1' : 'w-full'} h-9 bg-white/5 hover:bg-white/10 text-[#E0F7FA] text-xs rounded-xl`}
                    >
                      {deployResult.success ? 'Deploy Another' : 'Go Back & Retry'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Back button (not on first or last step) */}
          {step !== 'select-provider' && step !== 'result' && step !== 'deploying' && (
            <div className="px-5 py-3 border-t border-[#00E5FF]/10 shrink-0">
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === 'select-branch') setStep('select-item');
                  else if (step === 'confirm') {
                    if (selectedRepo && selectedBranch && itemTab === 'github') setStep('select-branch');
                    else setStep('select-item');
                  }
                  else if (step === 'select-item') {
                    if (savedToken) setStep('select-provider');
                    else setStep('api-key');
                  }
                  else setStep('select-provider');
                }}
                className="text-xs text-[#547B88] hover:text-[#E0F7FA]"
              >
                <ArrowRight className="w-3 h-3 mr-1 rotate-180" />
                Back
              </Button>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
