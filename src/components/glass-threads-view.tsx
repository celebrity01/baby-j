'use client';

import { useState, useMemo } from 'react';
import {
  MessageSquare, RefreshCw, Search, Plus, MoreVertical,
  FolderGit2, Cpu, Zap, ChevronRight, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import type { JulesSession, JulesSource } from '@/lib/jules-client';
import { relativeTime } from '@/lib/jules-client';

interface GlassThreadsViewProps {
  sessions: JulesSession[];
  sources: JulesSource[];
  isLoadingSessions: boolean;
  isLoadingSources: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewMission: () => void;
  onOpenDeploy: () => void;
  onRefresh: () => void;
  githubToken: string | null;
}

function getStateBadge(state?: string) {
  const config: Record<string, { cls: string; label: string }> = {
    RUNNING: { cls: 'state-running', label: 'RUNNING' },
    COMPLETED: { cls: 'state-completed', label: 'COMPLETED' },
    FAILED: { cls: 'state-failed', label: 'FAILED' },
    AWAITING: { cls: 'state-awaiting', label: 'AWAITING' },
    CANCELLED: { cls: 'state-cancelled', label: 'CANCELLED' },
    STOPPED: { cls: 'state-cancelled', label: 'STOPPED' },
  };
  const c = config[state || ''] || config.RUNNING;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

export default function GlassThreadsView({
  sessions,
  sources,
  isLoadingSessions,
  isLoadingSources,
  onSelectSession,
  onNewMission,
  onOpenDeploy,
  onRefresh,
  githubToken,
}: GlassThreadsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.prompt || '').toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const activeSessions = sessions.filter(
    (s) => s.state === 'RUNNING' || s.state === 'AWAITING'
  ).length;

  const repoCount = sources.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-lg font-bold text-[#E0F7FA]">Jules Lite</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="text-[#547B88] hover:text-[#00E5FF] hover:bg-[#00E5FF]/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#547B88] hover:text-[#00E5FF] hover:bg-[#00E5FF]/10"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#0a1015] border-[#00E5FF]/15 text-[#E0F7FA]"
            >
              <DropdownMenuItem
                onClick={onOpenDeploy}
                className="hover:bg-[#00E5FF]/10 focus:bg-[#00E5FF]/10 cursor-pointer"
              >
                <Globe className="w-4 h-4 mr-2 text-[#00E5FF]" />
                Deploy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-lg font-bold text-[#E0F7FA]">
              {isLoadingSessions ? '...' : sessions.length}
            </span>
          </div>
          <span className="text-[10px] text-[#547B88] uppercase tracking-wider">Sessions</span>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <FolderGit2 className="w-3.5 h-3.5 text-[#B388FF]" />
            <span className="text-lg font-bold text-[#E0F7FA]">{repoCount}</span>
          </div>
          <span className="text-[10px] text-[#547B88] uppercase tracking-wider">Repos</span>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Cpu className="w-3.5 h-3.5 text-[#00E676]" />
            <span className="text-lg font-bold text-[#E0F7FA]">
              {isLoadingSources ? '...' : sources.length}
            </span>
          </div>
          <span className="text-[10px] text-[#547B88] uppercase tracking-wider">Sources</span>
        </div>
      </div>

      {/* Active indicator */}
      {activeSessions > 0 && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-[#00E5FF]/5 border border-[#00E5FF]/10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-xs text-[#00E5FF]">
            {activeSessions} active session{activeSessions > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#547B88]" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2">
        {isLoadingSessions ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-4">
              <Skeleton className="h-4 w-3/4 mb-2 bg-white/5" />
              <Skeleton className="h-3 w-1/2 bg-white/5" />
            </div>
          ))
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-[#547B88] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[#547B88]">
              {searchQuery ? 'No sessions match your search' : 'No missions yet'}
            </p>
            {!searchQuery && (
              <Button
                variant="ghost"
                onClick={onNewMission}
                className="mt-3 text-[#00E5FF] hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 text-sm"
              >
                Create your first mission
              </Button>
            )}
          </div>
        ) : (
          filteredSessions.map((session, index) => (
            <motion.div
              key={session.sessionId || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectSession(session.sessionId || '')}
              className="glass-card p-4 cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-medium text-[#E0F7FA] truncate flex-1">
                  {session.name || 'Untitled Mission'}
                </h3>
                <ChevronRight className="w-4 h-4 text-[#547B88] group-hover:text-[#00E5FF] transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="text-xs text-[#547B88] line-clamp-1 mb-2">
                {(session.prompt || '').substring(0, 80)}
                {(session.prompt || '').length > 80 ? '...' : ''}
              </p>
              <div className="flex items-center justify-between">
                {getStateBadge(session.state)}
                <span className="text-[10px] text-[#547B88]">
                  {relativeTime(session.createdTime)}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-30">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onNewMission}
            size="icon"
            className="w-12 h-12 rounded-full bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
