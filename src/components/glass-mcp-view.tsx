'use client';

import { Cpu, ExternalLink, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import type { JulesSource } from '@/lib/jules-client';

interface GlassMCPViewProps {
  sources: JulesSource[];
  isLoading: boolean;
}

export default function GlassMCPView({ sources, isLoading }: GlassMCPViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 py-4 space-y-4 pb-24"
    >
      <h2 className="text-sm font-semibold text-[#547B88] uppercase tracking-wider px-1">
        Active Context Map
      </h2>

      {/* Status Card */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#00E676]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#E0F7FA]">Sources</h3>
              <p className="text-[10px] text-[#547B88]">GitHub repositories indexed by Jules</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="h-5 text-[10px] bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30"
          >
            {isLoading ? '...' : sources.length} active
          </Badge>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02]">
          <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span className="text-xs text-[#547B88]">
            {isLoading
              ? 'Loading sources...'
              : sources.length > 0
                ? `${sources.length} repositories connected to Jules agent`
                : 'No sources connected yet'}
          </span>
        </div>
      </div>

      {/* Sources List */}
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-4">
            <Skeleton className="h-4 w-2/3 mb-2 bg-white/5" />
            <Skeleton className="h-3 w-1/3 bg-white/5" />
          </div>
        ))
      ) : sources.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Cpu className="w-10 h-10 text-[#547B88] opacity-30 mx-auto mb-3" />
          <p className="text-sm text-[#547B88]">No sources connected</p>
          <p className="text-xs text-[#547B88] mt-1 opacity-60">
            Sources will appear when repositories are registered with Jules
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source, index) => {
            const repoName =
              source.repository?.uri?.replace('https://github.com/', '') ||
              source.repository?.name ||
              source.name ||
              'Unknown';
            const branch = source.repository?.defaultBranch || 'main';
            const repoUrl = source.repository?.uri || '';

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-[#E0F7FA] font-mono">
                      {repoName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="h-4 text-[9px] bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20 font-mono"
                      >
                        {branch}
                      </Badge>
                      <span className="text-[10px] text-[#00E676] flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#00E676]" />
                        Indexed
                      </span>
                    </div>
                  </div>
                  {repoUrl && (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#547B88] hover:text-[#00E5FF] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
