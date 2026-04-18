'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Bot, Cpu, Bell, Rocket,
  Zap, Plus, RefreshCw, MoreVertical, Globe, FolderGit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ApiKeySetup from '@/components/api-key-setup';
import GlassThreadsView from '@/components/glass-threads-view';
import GlassChatView from '@/components/glass-chat-view';
import GlassAgentsView from '@/components/glass-agents-view';
import GlassMCPView from '@/components/glass-mcp-view';
import GlassPingsView from '@/components/glass-pings-view';
import GlassDeploymentCenter from '@/components/glass-deployment-center';
import GlassNewMissionModal from '@/components/glass-new-mission-modal';
import GlassAddRepoModal from '@/components/glass-add-repo-modal';
import GlassDeployNotification from '@/components/glass-deploy-notification';

import {
  listSources, listSessions, getSession, getActivities,
  sendMessage, approvePlan, getGitHubUser
} from '@/lib/jules-client';
import type {
  JulesSource, JulesSession, JulesActivity, GitHubUser
} from '@/lib/jules-client';

type AppStep = 'api-key' | 'dashboard';
type AppView = 'threads' | 'chat' | 'agents' | 'mcp' | 'pings' | 'deploy';

const navTabs = [
  { id: 'threads' as AppView, label: 'Threads', icon: MessageSquare },
  { id: 'deploy' as AppView, label: 'Deploy', icon: Rocket },
  { id: 'agents' as AppView, label: 'Agents', icon: Bot },
  { id: 'mcp' as AppView, label: 'MCP', icon: Cpu },
  { id: 'pings' as AppView, label: 'Pings', icon: Bell },
];

export default function Home() {
  const [step, setStep] = useState<AppStep>('api-key');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  // Provider tokens
  const [vercelToken, setVercelToken] = useState<string | null>(null);
  const [netlifyToken, setNetlifyToken] = useState<string | null>(null);
  const [renderToken, setRenderToken] = useState<string | null>(null);
  const [cloudflareToken, setCloudflareToken] = useState<string | null>(null);

  const [sources, setSources] = useState<JulesSource[]>([]);
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<JulesSession | null>(null);
  const [activities, setActivities] = useState<JulesActivity[]>([]);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const [view, setView] = useState<AppView>('threads');
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false);
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('jules-api-key');
    const storedGhToken = localStorage.getItem('github-token');
    setVercelToken(localStorage.getItem('vercel-token'));
    setNetlifyToken(localStorage.getItem('netlify-token'));
    setRenderToken(localStorage.getItem('render-api-key'));
    setCloudflareToken(localStorage.getItem('cloudflare-token'));

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
    } catch {} finally {
      setIsLoadingSources(false);
      setIsLoadingSessions(false);
    }
  }, []);

  const loadGitHubUser = useCallback(async (token: string) => {
    try {
      const user = await getGitHubUser(token);
      setGithubUser(user);
    } catch {}
  }, []);

  const handleApiValidated = (key: string) => {
    setApiKey(key);
    setStep('dashboard');
    loadData(key);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!apiKey || !sessionId) return;
    setView('chat');
    setIsLoadingActivities(true);
    try {
      const [sessionData, activitiesData] = await Promise.all([
        getSession(apiKey, sessionId),
        getActivities(apiKey, sessionId),
      ]);
      setSelectedSession(sessionData);
      setActivities(activitiesData);
    } catch {} finally {
      setIsLoadingActivities(false);
    }
  };

  if (step === 'api-key') {
    return <ApiKeySetup onApiValidated={handleApiValidated} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto bg-[#03080a] text-[#E0F7FA]">
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {view === 'chat' ? (
            <GlassChatView
              key="chat"
              session={selectedSession}
              activities={activities}
              isLoading={isLoadingActivities}
              onSendMessage={async (msg) => {
                if (apiKey && selectedSession) {
                  await sendMessage(apiKey, selectedSession.sessionId!, msg);
                  setActivities(await getActivities(apiKey, selectedSession.sessionId!));
                }
              }}
              onApprovePlan={async () => {
                if (apiKey && selectedSession) {
                  await approvePlan(apiKey, selectedSession.sessionId!);
                  const [s, a] = await Promise.all([
                    getSession(apiKey, selectedSession.sessionId!),
                    getActivities(apiKey, selectedSession.sessionId!)
                  ]);
                  setSelectedSession(s);
                  setActivities(a);
                }
              }}
              onBack={() => setView('threads')}
            />
          ) : (
            <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              {view === 'threads' && (
                <GlassThreadsView
                  sessions={sessions}
                  sources={sources}
                  isLoadingSessions={isLoadingSessions}
                  isLoadingSources={isLoadingSources}
                  onSelectSession={handleSelectSession}
                  onNewMission={() => setIsNewMissionOpen(true)}
                  onOpenDeploy={() => setView('deploy')}
                  onRefresh={() => apiKey && loadData(apiKey)}
                  onOpenAddRepo={() => setIsAddRepoOpen(true)}
                />
              )}
              {view === 'deploy' && (
                <GlassDeploymentCenter
                  githubToken={githubToken}
                  vercelToken={vercelToken}
                  netlifyToken={netlifyToken}
                  renderToken={renderToken}
                  cloudflareToken={cloudflareToken}
                />
              )}
              {view === 'agents' && <GlassAgentsView githubToken={githubToken} julesApiKey={apiKey} githubUser={githubUser} onGitHubConnect={(t) => { setGithubToken(t); loadGitHubUser(t); }} onGitHubDisconnect={() => { setGithubToken(null); setGithubUser(null); }} onJulesDisconnect={() => { setApiKey(null); setStep('api-key'); }} />}
              {view === 'mcp' && <GlassMCPView sources={sources} isLoading={isLoadingSources} />}
              {view === 'pings' && <GlassPingsView sessions={sessions} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {view !== 'chat' && (
        <div className="glass-nav fixed bottom-0 left-0 right-0 z-40 pb-safe bg-[#03080a]/80 backdrop-blur-lg border-t border-white/5">
          <nav className="max-w-3xl mx-auto flex items-center justify-around h-16">
            {navTabs.map((tab) => {
              const isActive = view === tab.id;
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setView(tab.id)} className={`relative flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all ${isActive ? 'text-[#00E5FF]' : 'text-[#547B88] hover:text-[#E0F7FA]'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]' : ''}`} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                  {isActive && <motion.div layoutId="nav-indicator" className="absolute -top-px w-8 h-0.5 bg-[#00E5FF] rounded-full" />}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <GlassNewMissionModal sources={sources} githubToken={githubToken} apiKey={apiKey || ''} isOpen={isNewMissionOpen} onClose={() => setIsNewMissionOpen(false)} onMissionCreated={(id) => { setIsNewMissionOpen(false); if (apiKey) loadData(apiKey); if (id) handleSelectSession(id); }} />
      <GlassAddRepoModal githubToken={githubToken} isOpen={isAddRepoOpen} onClose={() => setIsAddRepoOpen(false)} onRepoConnected={() => apiKey && loadData(apiKey)} />
      <GlassDeployNotification githubToken={githubToken} isOpen={isDeployOpen} onClose={() => setIsDeployOpen(false)} />
    </div>
  );
}
