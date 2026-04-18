'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Github, Plus, FolderGit2, Globe, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import type { GitHubRepo } from '@/lib/jules-client';
import { listGitHubRepos, createGitHubRepo } from '@/lib/jules-client';

interface GlassAddRepoModalProps {
  githubToken: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function GlassAddRepoModal({
  githubToken,
  isOpen,
  onClose,
}: GlassAddRepoModalProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('browse');

  // Create repo form
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Connect URL
  const [connectUrl, setConnectUrl] = useState('');

  useEffect(() => {
    if (isOpen && githubToken) {
      loadRepos();
    }
  }, [isOpen, githubToken]);

  const loadRepos = async () => {
    setIsLoading(true);
    try {
      const r = await listGitHubRepos(githubToken!);
      setRepos(r);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [repos, search]);

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setIsCreating(true);
    try {
      await createGitHubRepo(githubToken!, {
        name: newRepoName.trim(),
        description: newRepoDesc.trim() || undefined,
        private: newRepoPrivate,
        autoInit: true,
      });
      await loadRepos();
      setActiveTab('browse');
      setNewRepoName('');
      setNewRepoDesc('');
      setNewRepoPrivate(false);
    } catch (err) {
      console.error('Failed to create repo:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setActiveTab('browse');
    setNewRepoName('');
    setNewRepoDesc('');
    setConnectUrl('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 bg-[#0a1015] border-[#00E5FF]/15 overflow-hidden">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#00E5FF]/10">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-semibold text-[#E0F7FA]">Add Repository</h2>
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-5 pt-3">
              <TabsList className="bg-transparent h-9 p-0 border-b border-[#00E5FF]/10 w-full justify-start gap-4 rounded-none">
                <TabsTrigger
                  value="browse"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-[#00E5FF] data-[state=active]:border-b-2 data-[state=active]:border-[#00E5FF] text-[#547B88] rounded-none h-9 px-0 pb-2 text-xs transition-all"
                >
                  Browse
                </TabsTrigger>
                <TabsTrigger
                  value="create"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-[#00E5FF] data-[state=active]:border-b-2 data-[state=active]:border-[#00E5FF] text-[#547B88] rounded-none h-9 px-0 pb-2 text-xs transition-all"
                >
                  Create
                </TabsTrigger>
                <TabsTrigger
                  value="connect"
                  className="data-[state=active]:bg-transparent data-[state=active]:text-[#00E5FF] data-[state=active]:border-b-2 data-[state=active]:border-[#00E5FF] text-[#547B88] rounded-none h-9 px-0 pb-2 text-xs transition-all"
                >
                  Connect
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="browse" className="mt-0">
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#547B88]" />
                  <Input
                    placeholder="Search repositories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="glass-input pl-9 h-9 text-sm"
                  />
                </div>
                <ScrollArea className="max-h-[50vh]">
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="glass-card p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-2/3 bg-white/5 rounded animate-pulse" />
                            <div className="h-2 w-1/3 bg-white/5 rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-[#547B88]">
                        {search ? 'No repos match your search' : 'No repos found'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredRepos.map((repo) => (
                        <a
                          key={repo.id}
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-card p-3 flex items-center gap-3 block hover:border-[#00E5FF]/20 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            <Github className="w-4 h-4 text-[#547B88]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[#E0F7FA] truncate font-mono">
                              {repo.full_name}
                            </p>
                            <p className="text-[10px] text-[#547B88] truncate">
                              {repo.description || 'No description'}
                            </p>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              repo.private
                                ? 'bg-[#B388FF]/10 text-[#B388FF]'
                                : 'bg-[#00E676]/10 text-[#00E676]'
                            }`}
                          >
                            {repo.private ? 'Private' : 'Public'}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="create" className="mt-0">
              <div className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-[#547B88] mb-1.5 block">Repository Name *</Label>
                  <Input
                    placeholder="my-awesome-repo"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className="glass-input h-10 text-sm font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#547B88] mb-1.5 block">Description</Label>
                  <Textarea
                    placeholder="What is this repo about?"
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    className="glass-input min-h-[60px] text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[#E0F7FA]">Private Repository</Label>
                  <Switch
                    checked={newRepoPrivate}
                    onCheckedChange={setNewRepoPrivate}
                  />
                </div>
                <Button
                  onClick={handleCreateRepo}
                  disabled={!newRepoName.trim() || isCreating}
                  className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Repository
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="connect" className="mt-0">
              <div className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-[#547B88] mb-1.5 block">Repository URL</Label>
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={connectUrl}
                    onChange={(e) => setConnectUrl(e.target.value)}
                    className="glass-input h-10 text-sm font-mono"
                  />
                </div>
                <div className="glass-card p-3 flex items-start gap-2">
                  <InfoIcon className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#547B88]">
                    The repository will be added as a Jules source. Make sure the repo is accessible
                    and the Jules agent has permission to write to it.
                  </p>
                </div>
                <Button
                  disabled={!connectUrl.trim()}
                  onClick={() => {
                    // Store the connected URL and notify the parent
                    localStorage.setItem('jules-connected-repo', connectUrl.trim());
                    handleClose();
                  }}
                  className="w-full h-10 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Connect Repository
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
