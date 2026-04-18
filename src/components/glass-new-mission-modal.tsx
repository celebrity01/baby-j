'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Rocket, Search, ChevronDown, Globe, Server,
  Github, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { JulesSource, GitHubRepo, GitHubBranch } from '@/lib/jules-client';
import {
  listGitHubRepos,
  listBranches,
  createSession,
  buildDeployInstructions,
} from '@/lib/jules-client';

interface GlassNewMissionModalProps {
  sources: JulesSource[];
  githubToken: string | null;
  apiKey: string;
  isOpen: boolean;
  onClose: () => void;
  onMissionCreated: (sessionId: string) => void;
}

export default function GlassNewMissionModal({
  sources,
  githubToken,
  apiKey,
  isOpen,
  onClose,
  onMissionCreated,
}: GlassNewMissionModalProps) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [mode, setMode] = useState<string>('MANUAL');
  const [requireApproval, setRequireApproval] = useState(true);
  const [deploy, setDeploy] = useState({
    vercel: false,
    netlify: false,
    render: false,
    githubPages: false,
  });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  // Load GitHub repos when modal opens
  useEffect(() => {
    if (isOpen && githubToken) {
      loadRepos();
    }
  }, [isOpen, githubToken]);

  const loadRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const r = await listGitHubRepos(githubToken!);
      setRepos(r);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Load branches when repo is selected
  useEffect(() => {
    if (!selectedRepo) {
      setBranches([]);
      setSelectedBranch('');
      return;
    }
    const loadBranches = async () => {
      setIsLoadingBranches(true);
      try {
        const [owner, repo] = selectedRepo.split('/');
        if (githubToken) {
          const b = await listBranches(githubToken, owner, repo);
          setBranches(b);
          const defaultBranch = b.find((br) => br.default) || b[0];
          if (defaultBranch) setSelectedBranch(defaultBranch.name);
          else if (b.length > 0) setSelectedBranch(b[0].name);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingBranches(false);
      }
    };
    loadBranches();
  }, [selectedRepo, githubToken]);

  const selectedRepoObj = repos.find((r) => r.full_name === selectedRepo);

  const handleLaunch = async () => {
    if (!objective.trim()) return;
    setIsLaunching(true);
    try {
      let prompt = objective.trim();

      // Add deployment instructions
      const deployInstructions = buildDeployInstructions(deploy);
      if (deployInstructions) {
        prompt += deployInstructions;
      }

      const params: Parameters<typeof createSession>[1] = {
        prompt,
        executionMode: requireApproval ? 'MANUAL' : 'AUTO_PR',
      };

      if (title.trim()) {
        params.sessionTitle = title.trim();
      }

      if (selectedRepo) {
        const [owner, repo] = selectedRepo.split('/');
        params.sourceContext = {
          sourceName: `${owner}/${repo}`,
          branch: selectedBranch || undefined,
        };
      }

      // Set automation mode based on approval toggle
      if (!requireApproval) {
        params.executionMode = 'AUTO_PR';
      }

      const session = await createSession(apiKey, params);
      onMissionCreated(session.sessionId || '');
      handleClose();
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setObjective('');
    setSelectedRepo('');
    setSelectedBranch('');
    setMode('MANUAL');
    setRequireApproval(true);
    setDeploy({ vercel: false, netlify: false, render: false, githubPages: false });
    setRepoSearch('');
    onClose();
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(repoSearch.toLowerCase())
  );

  // Combine sources (connected) and GitHub repos
  const sourceRepos = sources.map((s) => ({
    name: s.repository?.name || s.name || '',
    full_name: s.repository?.uri?.replace('https://github.com/', '') || '',
    description: '',
    private: false,
    html_url: s.repository?.uri || '',
    default_branch: s.repository?.defaultBranch || '',
    owner: { login: '' },
  }));

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 bg-[#0a1015] border-[#00E5FF]/15 overflow-hidden">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#00E5FF]/10">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-semibold text-[#E0F7FA]">New Mission</h2>
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

          <ScrollArea className="max-h-[calc(90vh-140px)]">
            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <Label className="text-xs text-[#547B88] mb-1.5 block">Mission Identifier (optional)</Label>
                <Input
                  placeholder="e.g. matrix-auth-hardening"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="glass-input h-10 text-sm"
                />
              </div>

              {/* Objective */}
              <div>
                <Label className="text-xs text-[#547B88] mb-1.5 block">Objective Parameters *</Label>
                <Textarea
                  placeholder="Describe what the agent should accomplish..."
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="glass-input min-h-[80px] text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* Context Target */}
              <div className="relative">
                <Label className="text-xs text-[#547B88] mb-1.5 block">Context Target *</Label>
                <button
                  onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                  className="glass-input w-full h-10 text-sm text-left px-3 flex items-center justify-between"
                >
                  <span className={selectedRepo ? 'text-[#E0F7FA]' : 'text-[#547B88]'}>
                    {selectedRepo || 'Select repository...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#547B88]" />
                </button>

                <AnimatePresence>
                  {showRepoDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 top-full left-0 right-0 mt-1 glass-strong rounded-xl overflow-hidden max-h-60"
                    >
                      <div className="p-2 border-b border-[#00E5FF]/10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#547B88]" />
                          <Input
                            placeholder="Search repos..."
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            className="glass-input h-8 text-xs pl-8"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-44 overflow-y-auto p-1">
                        {/* Sources first */}
                        {sourceRepos.length > 0 && (
                          <div className="px-2 py-1">
                            <span className="text-[10px] text-[#00E5FF] uppercase tracking-wider font-semibold">
                              Connected Sources
                            </span>
                          </div>
                        )}
                        {sourceRepos.map((s) => (
                          <button
                            key={`source-${s.full_name}`}
                            onClick={() => {
                              setSelectedRepo(s.full_name);
                              setShowRepoDropdown(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#00E5FF]/10 transition-colors flex items-center justify-between ${
                              selectedRepo === s.full_name ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'text-[#E0F7FA]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Github className="w-3 h-3 shrink-0" />
                              <span className="truncate">{s.full_name}</span>
                            </div>
                            <Badge className="h-4 text-[8px] bg-[#00E676]/15 text-[#00E676] border-[#00E676]/30 shrink-0">
                              Connected
                            </Badge>
                          </button>
                        ))}
                        {/* GitHub repos */}
                        {githubToken && filteredRepos.length > 0 && (
                          <div className="px-2 py-1 mt-1">
                            <span className="text-[10px] text-[#547B88] uppercase tracking-wider font-semibold">
                              GitHub Repos
                            </span>
                          </div>
                        )}
                        {filteredRepos.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelectedRepo(r.full_name);
                              setShowRepoDropdown(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#00E5FF]/10 transition-colors ${
                              selectedRepo === r.full_name ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'text-[#E0F7FA]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{r.full_name}</span>
                              {r.private && (
                                <Lock className="w-3 h-3 text-[#547B88] shrink-0 ml-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Branch */}
              {selectedRepo && (
                <div>
                  <Label className="text-xs text-[#547B88] mb-1.5 block">Branch Vector</Label>
                  {isLoadingBranches ? (
                    <div className="glass-input h-10 flex items-center px-3">
                      <Loader2 className="w-3 h-3 text-[#00E5FF] animate-spin" />
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                        className="glass-input w-full h-10 text-sm text-left px-3 flex items-center justify-between"
                      >
                        <span className="text-[#E0F7FA]">{selectedBranch || 'Select branch...'}</span>
                        <ChevronDown className="w-4 h-4 text-[#547B88]" />
                      </button>
                      {branches.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {branches.slice(0, 5).map((b) => (
                            <button
                              key={b.name}
                              onClick={() => setSelectedBranch(b.name)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors ${
                                selectedBranch === b.name
                                  ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                                  : 'glass-input text-[#547B88]'
                              }`}
                            >
                              {b.name}
                              {b.protected && (
                                <Badge className="ml-1 h-3 text-[7px] bg-[#B388FF]/15 text-[#B388FF] border-[#B388FF]/30">
                                  protected
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mode */}
              <div>
                <Label className="text-xs text-[#547B88] mb-1.5 block">Mode</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('MANUAL')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      mode === 'MANUAL'
                        ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                        : 'glass-input text-[#547B88]'
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => setMode('AUTO_PR')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      mode === 'AUTO_PR'
                        ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                        : 'glass-input text-[#547B88]'
                    }`}
                  >
                    Auto PR
                  </button>
                </div>
              </div>

              {/* Deployment Config */}
              <div>
                <Label className="text-xs text-[#547B88] mb-1.5 block">Deployment Config</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'vercel' as const, label: 'Vercel', icon: Globe },
                    { key: 'netlify' as const, label: 'Netlify', icon: Globe },
                    { key: 'render' as const, label: 'Render', icon: Server },
                    { key: 'githubPages' as const, label: 'GitHub Pages', icon: Github },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setDeploy((d) => ({ ...d, [key]: !d[key] }))}
                      className={`py-2 px-3 rounded-lg text-xs flex items-center gap-2 transition-all ${
                        deploy[key]
                          ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                          : 'glass-input text-[#547B88]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Require Plan Approval */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-[#E0F7FA]">Require Plan Approval</Label>
                  <p className="text-[10px] text-[#547B88]">Agent must get approval before executing</p>
                </div>
                <Switch
                  checked={requireApproval}
                  onCheckedChange={setRequireApproval}
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#00E5FF]/10">
            <Button
              onClick={handleLaunch}
              disabled={!objective.trim() || isLaunching}
              className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Launch Mission
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
