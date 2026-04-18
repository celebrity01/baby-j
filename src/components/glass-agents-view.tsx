'use client';

import { useState } from 'react';
import {
  Github, Zap, LogOut, Loader2, ExternalLink, CheckCircle2, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import type { GitHubUser } from '@/lib/jules-client';
import { getGitHubUser } from '@/lib/jules-client';

interface GlassAgentsViewProps {
  githubToken: string | null;
  julesApiKey: string | null;
  githubUser: GitHubUser | null;
  onGitHubConnect: (token: string) => void;
  onGitHubDisconnect: () => void;
  onJulesDisconnect: () => void;
}

export default function GlassAgentsView({
  githubToken,
  julesApiKey,
  githubUser,
  onGitHubConnect,
  onGitHubDisconnect,
  onJulesDisconnect,
}: GlassAgentsViewProps) {
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleGitHubConnect = async () => {
    if (!ghTokenInput.trim()) {
      setError('Please enter a GitHub token');
      return;
    }
    setIsConnecting(true);
    setError('');
    try {
      const user = await getGitHubUser(ghTokenInput.trim());
      localStorage.setItem('github-token', ghTokenInput.trim());
      onGitHubConnect(ghTokenInput.trim());
    } catch {
      setError('Invalid GitHub token. Please check and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 py-4 space-y-4 pb-24"
    >
      <h2 className="text-sm font-semibold text-[#547B88] uppercase tracking-wider px-1">
        Connections
      </h2>

      {/* GitHub Connection */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Github className="w-4 h-4 text-[#E0F7FA]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#E0F7FA]">GitHub</h3>
              <p className="text-[10px] text-[#547B88]">Repository access & management</p>
            </div>
          </div>
          {githubUser && (
            <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
          )}
        </div>

        {githubToken && githubUser ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {githubUser.avatar_url && (
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-9 h-9 rounded-full border border-[#00E5FF]/20"
                />
              )}
              <div>
                <p className="text-sm font-medium text-[#E0F7FA]">
                  {githubUser.name || githubUser.login}
                </p>
                <p className="text-[10px] text-[#547B88]">@{githubUser.login}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGitHubDisconnect}
              className="text-[#FF2A5F] hover:text-[#FF2A5F] hover:bg-[#FF2A5F]/10 text-xs"
            >
              <LogOut className="w-3 h-3 mr-1" />
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={ghTokenInput}
              onChange={(e) => {
                setGhTokenInput(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleGitHubConnect()}
              className="glass-input h-10 text-sm font-mono"
            />
            {error && (
              <p className="text-[10px] text-[#FF2A5F]">{error}</p>
            )}
            <Button
              onClick={handleGitHubConnect}
              disabled={isConnecting || !ghTokenInput.trim()}
              size="sm"
              className="w-full h-9 bg-[#E0F7FA] hover:bg-[#E0F7FA]/90 text-[#03080a] text-xs rounded-lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Github className="w-3 h-3 mr-1.5" />
                  Connect GitHub
                </>
              )}
            </Button>
            <p className="text-[10px] text-[#547B88]">
              Requires a Personal Access Token with <code className="text-[#00E5FF]">repo</code> scope
            </p>
          </div>
        )}
      </div>

      {/* Jules Agent */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#E0F7FA]">Jules Agent</h3>
              <p className="text-[10px] text-[#547B88]">AI code generation</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-[#00E676]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
            Active
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-xs text-[#547B88]">Agent connected and ready</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onJulesDisconnect}
            className="text-[#FF2A5F] hover:text-[#FF2A5F] hover:bg-[#FF2A5F]/10 text-xs"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
