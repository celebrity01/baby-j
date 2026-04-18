'use client';

import { useState, useEffect } from 'react';
import {
  Rocket, Globe, RefreshCw, ExternalLink,
  ChevronRight, Zap, CheckCircle2, Clock,
  Search, ShieldCheck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DeploymentCenterProps {
  githubToken: string | null;
  vercelToken: string | null;
  netlifyToken: string | null;
  renderToken: string | null;
  cloudflareToken: string | null;
}

export default function GlassDeploymentCenter({
  githubToken,
  vercelToken,
  netlifyToken,
  renderToken,
  cloudflareToken
}: DeploymentCenterProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmartDeploying, setIsSmartDeploying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/deploy/projects', {
        headers: {
          'X-GitHub-Token': githubToken || '',
          'X-Vercel-Token': vercelToken || '',
          'X-Netlify-Token': netlifyToken || '',
          'X-Render-Api-Key': renderToken || '',
          'X-Cloudflare-Token': cloudflareToken || '',
        }
      });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      toast.error('Failed to load deployments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmartDeploy = async () => {
    if (!githubToken) {
      toast.error('Connect GitHub to use Smart Deploy');
      return;
    }

    const repo = prompt('Enter repository (owner/name):');
    if (!repo) return;

    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      toast.error('Invalid repository format. Use owner/name');
      return;
    }

    setIsSmartDeploying(true);
    toast.promise(
      fetch('/api/deploy/smart', {
        method: 'POST',
        headers: {
          'X-GitHub-Token': githubToken,
          'X-Vercel-Token': vercelToken || '',
          'X-Netlify-Token': netlifyToken || '',
          'X-Render-Api-Key': renderToken || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo: name }),
      }).then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Deployment failed');
        return data;
      }),
      {
        loading: 'Analyzing repository and deploying...',
        success: (data) => {
          setIsSmartDeploying(false);
          fetchProjects();
          return `Deployed ${name} to ${data.provider}!`;
        },
        error: (err) => {
          setIsSmartDeploying(false);
          return err.message;
        }
      }
    );
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#03080a]">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center border border-[#00E5FF]/20">
              <Rocket className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#E0F7FA]">Deployment Center</h1>
              <p className="text-[10px] text-[#547B88] uppercase tracking-widest font-semibold">Engine v2.0</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchProjects}
            className="text-[#547B88] hover:text-[#00E5FF]"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-card p-3 border-[#00E5FF]/10">
            <div className="text-[10px] text-[#547B88] uppercase mb-1">Total</div>
            <div className="text-xl font-bold text-[#E0F7FA]">{isLoading ? '...' : projects.length}</div>
          </div>
          <div className="glass-card p-3 border-[#00E676]/10">
            <div className="text-[10px] text-[#547B88] uppercase mb-1">Active</div>
            <div className="text-xl font-bold text-[#00E676]">{isLoading ? '...' : projects.length}</div>
          </div>
          <div className="glass-card p-3 border-[#B388FF]/10">
            <div className="text-[10px] text-[#547B88] uppercase mb-1">Providers</div>
            <div className="text-xl font-bold text-[#B388FF]">5</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#547B88]" />
          <Input
            placeholder="Search deployments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-10 h-10 text-sm"
          />
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-10 h-10 text-[#547B88] mx-auto mb-3 opacity-30" />
            <p className="text-sm text-[#547B88]">No deployments found</p>
          </div>
        ) : (
          filteredProjects.map((project, idx) => (
            <motion.div
              key={project.id + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-4 group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <Globe className="w-5 h-5 text-[#E0F7FA]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#E0F7FA]">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] uppercase border-white/10 text-[#547B88] px-1.5 py-0 h-4">
                        {project.provider}
                      </Badge>
                      {project.lastUpdated && (
                        <span className="text-[10px] text-[#547B88] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(project.lastUpdated).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${project.status === 'live' || project.status === 'READY' || project.status === 'SUCCESS' ? 'bg-[#00E676] shadow-[0_0_8px_#00E676]' : 'bg-[#FFB74D] shadow-[0_0_8px_#FFB74D]'}`} />
                  <span className={`text-[10px] font-mono font-bold ${project.status === 'live' || project.status === 'READY' || project.status === 'SUCCESS' ? 'text-[#00E676]' : 'text-[#FFB74D]'}`}>{project.status || 'ACTIVE'}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {project.url && (
                  <Button
                    asChild
                    variant="ghost"
                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-[10px] text-[#E0F7FA] rounded-lg border border-white/5"
                  >
                    <a href={project.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1.5" /> Visit Site
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-8 h-8 p-0 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-[#547B88] hover:text-[#00E5FF]"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))
        )}

        <div className="pt-4 text-center">
          <Button
            onClick={handleSmartDeploy}
            disabled={isSmartDeploying}
            className="w-full h-11 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(0,229,255,0.1)]"
          >
            <Zap className={`w-4 h-4 mr-2 ${isSmartDeploying ? 'animate-pulse' : ''}`} />
            {isSmartDeploying ? 'Deploying...' : 'Smart Deploy New Project'}
          </Button>
        </div>
      </div>
    </div>
  );
}
