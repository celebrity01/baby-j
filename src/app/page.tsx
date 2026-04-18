'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Bot, Cpu, Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ApiKeySetup from '@/components/api-key-setup';
import GlassThreadsView from '@/components/glass-threads-view';
import GlassChatView from '@/components/glass-chat-view';
import GlassAgentsView from '@/components/glass-agents-view';
import GlassMCPView from '@/components/glass-mcp-view';
import GlassPingsView from '@/components/glass-pings-view';
import GlassNewMissionModal from '@/components/glass-new-mission-modal';
import GlassAddRepoModal from '@/components/glass-add-repo-modal';
import GlassDeployNotification from '@/components/glass-deploy-notification';
import type {
  JulesSource,
  JulesSession,
  JulesActivity,
  GitHubUser,
} from '@/lib/jules-client';
import {
  listSources,
  listSessions,
  getSession,
  getActivities,
  sendMessage,
  approvePlan,
  getGitHubUser,
} from '@/lib/jules-client';

type AppView = 'threads' | 'chat' | 'agents' | 'mcp' | 'pings';
type AppStep = 'api-key' | 'dashboard';

const navTabs: { id: AppView; label: string; icon: typeof MessageSquare }[] = [
  { id: 'threads', label: 'Threads', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'mcp', label: 'MCP', icon: Cpu },
  { id: 'pings', label: 'Pings', icon: Bell },
];

export default function Home() {
  // Core state
  const [step, setStep] = useState<AppStep>('api-key');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  // Data state
  const [sources, setSources] = useState<JulesSource[]>([]);
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<JulesSession | null>(null);
  const [activities, setActivities] = useState<JulesActivity[]>([]);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Loading state
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Navigation
  const [view, setView] = useState<AppView>('threads');

  // Modals
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false);
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);

  // Init - load tokens from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem('jules-api-key');
    const storedGhToken = localStorage.getItem('github-token');

    if (storedKey) {
      setApiKey(storedKey);
      setStep('dashboard');
      loadData(storedKey);
    }

    if (storedGhToken) {
      setGithubToken(storedGhToken);
      loadGitHubUser(storedGhToken);
    }
  }, []);

  // Auto-refresh activities for active sessions
  useEffect(() => {
    if (view !== 'chat' || !selectedSession || !apiKey) return;

    const isActive =
      selectedSession.state === 'RUNNING' || selectedSession.state === 'AWAITING';
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const [sessionData, activitiesData] = await Promise.all([
          getSession(apiKey, selectedSession.sessionId || ''),
          getActivities(apiKey, selectedSession.sessionId || ''),
        ]);
        setSelectedSession(sessionData);
        setActivities(activitiesData);

        // Update session in list too
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === sessionData.sessionId ? sessionData : s
          )
        );
      } catch {
        // silently fail
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [view, selectedSession, apiKey]);

  // ===== Data Loading =====

  const loadData = useCallback(async (key: string) => {
    setIsLoadingSources(true);
    setIsLoadingSessions(true);
    try {
      const [src, sess] = await Promise.allSettled([
        listSources(key),
        listSessions(key),
      ]);
      if (src.status === 'fulfilled') setSources(src.value);
      if (sess.status === 'fulfilled') setSessions(sess.value);
    } catch {
      // silently fail
    } finally {
      setIsLoadingSources(false);
      setIsLoadingSessions(false);
    }
  }, []);

  const loadGitHubUser = useCallback(async (token: string) => {
    try {
      const user = await getGitHubUser(token);
      setGithubUser(user);
    } catch {
      // silently fail
    }
  }, []);

  const refreshData = useCallback(() => {
    if (apiKey) loadData(apiKey);
  }, [apiKey, loadData]);

  // ===== Event Handlers =====

  const handleApiValidated = useCallback(
    (key: string) => {
      setApiKey(key);
      setStep('dashboard');
      loadData(key);
    },
    [loadData]
  );

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      if (!apiKey) return;
      setView('chat');
      setIsLoadingActivities(true);
      try {
        const [sessionData, activitiesData] = await Promise.all([
          getSession(apiKey, sessionId),
          getActivities(apiKey, sessionId),
        ]);
        setSelectedSession(sessionData);
        setActivities(activitiesData);
      } catch {
        // silently fail
      } finally {
        setIsLoadingActivities(false);
      }
    },
    [apiKey]
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!apiKey || !selectedSession) return;
      await sendMessage(apiKey, selectedSession.sessionId || '', message);
      // Refresh activities
      const acts = await getActivities(apiKey, selectedSession.sessionId || '');
      setActivities(acts);
    },
    [apiKey, selectedSession]
  );

  const handleApprovePlan = useCallback(async () => {
    if (!apiKey || !selectedSession) return;
    await approvePlan(apiKey, selectedSession.sessionId || '');
    // Refresh
    const [sessionData, activitiesData] = await Promise.all([
      getSession(apiKey, selectedSession.sessionId || ''),
      getActivities(apiKey, selectedSession.sessionId || ''),
    ]);
    setSelectedSession(sessionData);
    setActivities(activitiesData);
    setSessions((prev) =>
      prev.map((s) =>
        s.sessionId === sessionData.sessionId ? sessionData : s
      )
    );
  }, [apiKey, selectedSession]);

  const handleGitHubConnect = useCallback(
    (token: string) => {
      setGithubToken(token);
      loadGitHubUser(token);
    },
    [loadGitHubUser]
  );

  const handleGitHubDisconnect = useCallback(() => {
    localStorage.removeItem('github-token');
    setGithubToken(null);
    setGithubUser(null);
  }, []);

  const handleJulesDisconnect = useCallback(() => {
    localStorage.removeItem('jules-api-key');
    setApiKey(null);
    setStep('api-key');
    setView('threads');
    setSelectedSession(null);
    setSources([]);
    setSessions([]);
  }, []);

  const handleMissionCreated = useCallback(
    (sessionId: string) => {
      setIsNewMissionOpen(false);
      if (apiKey) loadData(apiKey);
      if (sessionId) {
        setTimeout(() => handleSelectSession(sessionId), 500);
      }
    },
    [apiKey, loadData, handleSelectSession]
  );

  const handleBack = useCallback(() => {
    setView('threads');
    setSelectedSession(null);
    setActivities([]);
    if (apiKey) loadData(apiKey);
  }, [apiKey, loadData]);

  // ===== Render =====

  if (step === 'api-key') {
    return <ApiKeySetup onApiValidated={handleApiValidated} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto">
      {/* Main Content */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {view === 'chat' ? (
            <GlassChatView
              key="chat"
              session={selectedSession}
              activities={activities}
              isLoading={isLoadingActivities}
              onSendMessage={handleSendMessage}
              onApprovePlan={handleApprovePlan}
              onBack={handleBack}
            />
          ) : (
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[calc(100vh-64px)]"
            >
              {view === 'threads' && (
                <GlassThreadsView
                  sessions={sessions}
                  sources={sources}
                  isLoadingSessions={isLoadingSessions}
                  isLoadingSources={isLoadingSources}
                  onSelectSession={handleSelectSession}
                  onNewMission={() => setIsNewMissionOpen(true)}
                  onOpenDeploy={() => setIsDeployOpen(true)}
                  onRefresh={refreshData}
                  githubToken={githubToken}
                />
              )}
              {view === 'agents' && (
                <GlassAgentsView
                  githubToken={githubToken}
                  julesApiKey={apiKey}
                  githubUser={githubUser}
                  onGitHubConnect={handleGitHubConnect}
                  onGitHubDisconnect={handleGitHubDisconnect}
                  onJulesDisconnect={handleJulesDisconnect}
                />
              )}
              {view === 'mcp' && (
                <GlassMCPView sources={sources} isLoading={isLoadingSources} />
              )}
              {view === 'pings' && <GlassPingsView sessions={sessions} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {view !== 'chat' && (
        <div className="glass-nav fixed bottom-0 left-0 right-0 z-40 pb-safe">
          <nav className="max-w-3xl mx-auto flex items-center justify-around h-16">
            {navTabs.map((tab) => {
              const isActive = view === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-[#00E5FF]'
                      : 'text-[#547B88] hover:text-[#E0F7FA]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#00E5FF]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]' : ''}`} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Modals */}
      <GlassNewMissionModal
        sources={sources}
        githubToken={githubToken}
        apiKey={apiKey || ''}
        isOpen={isNewMissionOpen}
        onClose={() => setIsNewMissionOpen(false)}
        onMissionCreated={handleMissionCreated}
      />
      <GlassAddRepoModal
        githubToken={githubToken}
        isOpen={isAddRepoOpen}
        onClose={() => setIsAddRepoOpen(false)}
      />
      <GlassDeployNotification
        githubToken={githubToken}
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
      />
    </div>
  );
}
