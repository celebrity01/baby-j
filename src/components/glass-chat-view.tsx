'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Bot, User, ThumbsUp, ExternalLink,
  GitPullRequest, Send, ChevronDown,
  ChevronUp, Loader2, Sparkles, FileCode,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import type { JulesSession, JulesActivity } from '@/lib/jules-client';

interface GlassChatViewProps {
  session: JulesSession | null;
  activities: JulesActivity[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onApprovePlan: () => void;
  onBack: () => void;
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

function ActivityBubble({ activity, onApprove }: { activity: JulesActivity; onApprove?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  switch (activity.type) {
    case 'AGENT_MESSAGED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2.5 items-start max-w-[90%]"
        >
          <div className="w-7 h-7 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center shrink-0 mt-1">
            <Bot className="w-3.5 h-3.5 text-[#00E5FF]" />
          </div>
          <div className="glass-card px-3.5 py-2.5">
            <p className="text-sm text-[#E0F7FA] whitespace-pre-wrap leading-relaxed">
              {activity.agentMessage}
            </p>
          </div>
        </motion.div>
      );

    case 'USER_MESSAGED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2.5 items-start max-w-[90%] ml-auto flex-row-reverse"
        >
          <div className="w-7 h-7 rounded-lg bg-[#B388FF]/10 flex items-center justify-center shrink-0 mt-1">
            <User className="w-3.5 h-3.5 text-[#B388FF]" />
          </div>
          <div className="glass-card px-3.5 py-2.5 bg-[#00E5FF]/5">
            <p className="text-sm text-[#E0F7FA] whitespace-pre-wrap leading-relaxed">
              {activity.userMessage}
            </p>
          </div>
        </motion.div>
      );

    case 'PLAN_GENERATED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2.5 items-start max-w-[95%]"
        >
          <div className="w-7 h-7 rounded-lg bg-[#B388FF]/10 flex items-center justify-center shrink-0 mt-1">
            <FileCode className="w-3.5 h-3.5 text-[#B388FF]" />
          </div>
          <div className="glass-card px-3.5 py-2.5 flex-1 border-[#B388FF]/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#B388FF] uppercase tracking-wider">
                Plan Generated
              </span>
              {onApprove && (
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="h-7 text-[10px] bg-[#B388FF] hover:bg-[#B388FF]/90 text-[#03080a] rounded-lg"
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  Approve
                </Button>
              )}
            </div>
            {activity.plan?.title && (
              <p className="text-sm font-medium text-[#E0F7FA] mb-2">{activity.plan.title}</p>
            )}
            {activity.plan?.steps && activity.plan.steps.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-[#547B88] hover:text-[#E0F7FA] transition-colors"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {activity.plan.steps.length} steps
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ol className="mt-2 space-y-1">
                        {activity.plan.steps.map((step, i) => (
                          <li key={`step-${i}-${step.description.substring(0, 32)}`} className="text-xs text-[#547B88] flex gap-2">
                            <span className="text-[#B388FF] font-mono shrink-0">{i + 1}.</span>
                            <span>{step.description}</span>
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      );

    case 'PLAN_APPROVED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E676]/10 border border-[#00E676]/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
            <span className="text-xs text-[#00E676] font-medium">Plan approved — executing...</span>
          </div>
        </motion.div>
      );

    case 'PROGRESS_UPDATED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2.5 items-start max-w-[90%]"
        >
          <div className="w-7 h-7 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center shrink-0 mt-1">
            <Loader2 className="w-3 h-3 text-[#00E5FF] animate-spin" />
          </div>
          <div className="glass-card px-3.5 py-2.5">
            <p className="text-xs text-[#547B88] mb-1">
              {activity.progressPercent !== undefined ? `${activity.progressPercent}%` : 'In progress'}
            </p>
            {activity.progressMessage && (
              <p className="text-sm text-[#E0F7FA]">{activity.progressMessage}</p>
            )}
          </div>
        </motion.div>
      );

    case 'SESSION_COMPLETED':
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center py-2"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E676]/10 border border-[#00E676]/20">
            <Sparkles className="w-4 h-4 text-[#00E676]" />
            <span className="text-sm text-[#00E676] font-medium">Mission completed</span>
          </div>
        </motion.div>
      );

    case 'SESSION_FAILED':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2.5 items-start max-w-[90%]"
        >
          <div className="w-7 h-7 rounded-lg bg-[#FF2A5F]/10 flex items-center justify-center shrink-0 mt-1">
            <XCircle className="w-3.5 h-3.5 text-[#FF2A5F]" />
          </div>
          <div className="glass-card px-3.5 py-2.5 border-[#FF2A5F]/20">
            <p className="text-xs font-semibold text-[#FF2A5F] mb-1">Mission Failed</p>
            {activity.errorMessage && (
              <p className="text-sm text-[#E0F7FA] opacity-80">{activity.errorMessage}</p>
            )}
          </div>
        </motion.div>
      );

    default:
      if (activity.bashCommand || activity.bashOutput) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[95%]"
          >
            <div className="terminal-card">
              <div className="terminal-header">
                <div className="terminal-dot bg-[#FF2A5F]" />
                <div className="terminal-dot bg-[#FFD740]" />
                <div className="terminal-dot bg-[#00E676]" />
                <span className="text-[10px] text-[#547B88] ml-2 font-mono">terminal</span>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto">
                {activity.bashCommand && (
                  <div className="mb-2">
                    <span className="text-[#00E5FF] text-xs font-mono">$ </span>
                    <span className="text-[#E0F7FA] text-xs font-mono">{activity.bashCommand}</span>
                  </div>
                )}
                {activity.bashOutput && (
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-[10px] text-[#547B88] hover:text-[#E0F7FA] transition-colors flex items-center gap-1 mb-1"
                  >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Output
                  </button>
                )}
                {expanded && activity.bashOutput && (
                  <pre className="text-[10px] text-[#547B88] font-mono whitespace-pre-wrap">
                    {activity.bashOutput}
                  </pre>
                )}
              </div>
            </div>
          </motion.div>
        );
      }

      if (activity.codeChanges?.patches) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[95%]"
          >
            <div className="glass-card p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-[#00E5FF]/10 hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-[#00E676]">
                  <FileCode className="w-3.5 h-3.5" />
                  {activity.codeChanges.patches.length} file(s) changed
                </span>
                {expanded ? <ChevronUp className="w-3 h-3 text-[#547B88]" /> : <ChevronDown className="w-3 h-3 text-[#547B88]" />}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden max-h-80 overflow-y-auto"
                  >
                    {activity.codeChanges.patches.map((patch, i) => (
                      <div key={`patch-${i}-${patch.filename}`} className="border-b border-[#00E5FF]/5 last:border-0">
                        <div className="px-3.5 py-1.5 bg-white/[0.02]">
                          <span className="text-[10px] text-[#547B88] font-mono">{patch.filename}</span>
                        </div>
                        <pre className="px-3.5 py-2 text-[10px] font-mono overflow-x-auto">
                          {patch.patch.split('\n').map((line, j) => (
                            <div
                              key={j}
                              className={line.startsWith('+') ? 'diff-add px-1' : line.startsWith('-') ? 'diff-remove px-1' : 'px-1'}
                            >
                              <span className={line.startsWith('+') ? 'text-[#00E676]' : line.startsWith('-') ? 'text-[#FF2A5F]' : 'text-[#547B88]'}>
                                {line}
                              </span>
                            </div>
                          ))}
                        </pre>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      }

      return null;
  }
}

export default function GlassChatView({
  session,
  activities,
  isLoading,
  onSendMessage,
  onApprovePlan,
  onBack,
}: GlassChatViewProps) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const isNearBottomRef = useRef(true);

  const isActive = session?.state === 'RUNNING' || session?.state === 'AWAITING';
  const needsApproval = session?.state === 'AWAITING';

  // Track if user is near bottom before auto-scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 100;
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto scroll only if user is near bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
      // Force scroll to bottom after sending
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } finally {
      setSendingMessage(false);
    }
  }, [message, sendingMessage, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-dvh"
    >
      {/* Header */}
      <div className="glass-nav sticky top-0 z-20 px-4 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Go back to threads"
              className="text-[#547B88] hover:text-[#E0F7FA] hover:bg-white/5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-[#E0F7FA] truncate">
                {session?.name || 'Mission'}
              </h2>
            </div>
            {session?.state && getStateBadge(session.state)}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {needsApproval && (
              <Button
                size="sm"
                onClick={onApprovePlan}
                className="h-7 text-[10px] bg-[#B388FF] hover:bg-[#B388FF]/90 text-[#03080a] rounded-lg"
              >
                <ThumbsUp className="w-3 h-3 mr-1" />
                Approve
              </Button>
            )}
            {session?.pullRequestUrl && (
              <a
                href={session.pullRequestUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open pull request"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#547B88] hover:text-[#00E676] hover:bg-[#00E676]/10 transition-colors"
              >
                <GitPullRequest className="w-4 h-4" />
              </a>
            )}
            {session?.sessionId && (
              <a
                href={`https://jules.google/sessions/${session.sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open session on Jules"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#547B88] hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Activities */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full space-y-3"
      >
        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <Skeleton className="w-7 h-7 rounded-lg bg-white/5 shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Bot className="w-12 h-12 text-[#547B88] opacity-30 mb-3" />
            <p className="text-sm text-[#547B88]">Waiting for agent activity...</p>
            {isActive && (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="w-3 h-3 text-[#00E5FF] animate-spin" />
                <span className="text-xs text-[#00E5FF]">Agent is working</span>
              </div>
            )}
          </div>
        ) : (
          activities.map((activity, index) => (
            <ActivityBubble
              key={`${activity.type}-${activity.timestamp || ''}-${index}`}
              activity={activity}
              onApprove={needsApproval ? onApprovePlan : undefined}
            />
          ))
        )}
      </div>

      {/* Approval Banner */}
      {needsApproval && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="glass-nav px-4 py-2.5"
        >
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#B388FF] animate-pulse shrink-0" />
              <span className="text-xs text-[#B388FF] truncate">Agent is awaiting plan approval</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={onApprovePlan}
                className="h-8 bg-[#B388FF] hover:bg-[#B388FF]/90 text-[#03080a] text-xs rounded-lg px-3"
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                Approve Plan
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Message Input */}
      <div className="glass-nav px-4 py-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <Textarea
            placeholder={needsApproval ? "Suggest changes to the plan, add or remove instructions..." : "Send a message to the agent..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass-input min-h-[40px] max-h-32 resize-none text-sm py-2.5"
            rows={1}
            aria-label="Chat message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendingMessage}
            size="icon"
            aria-label="Send message"
            className="w-10 h-10 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] shrink-0"
          >
            {sendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
