'use client';

import { useMemo } from 'react';
import {
  Bell, CheckCircle2, XCircle, AlertTriangle, Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { JulesSession } from '@/lib/jules-client';
import { relativeTime } from '@/lib/jules-client';

interface GlassPingsViewProps {
  sessions: JulesSession[];
}

interface PingEvent {
  id: string;
  type: 'SYS_OK' | 'CRIT_FAIL' | 'WARN_ALERT' | 'SYS_INFO';
  timestamp: string;
  description: string;
  sessionName: string;
}

const pingConfig = {
  SYS_OK: {
    icon: CheckCircle2,
    color: '#00E676',
    bgClass: 'bg-[#00E676]/10',
    borderClass: 'border-[#00E676]/20',
    textClass: 'text-[#00E676]',
    label: 'OK',
  },
  CRIT_FAIL: {
    icon: XCircle,
    color: '#FF2A5F',
    bgClass: 'bg-[#FF2A5F]/10',
    borderClass: 'border-[#FF2A5F]/20',
    textClass: 'text-[#FF2A5F]',
    label: 'FAIL',
  },
  WARN_ALERT: {
    icon: AlertTriangle,
    color: '#B388FF',
    bgClass: 'bg-[#B388FF]/10',
    borderClass: 'border-[#B388FF]/20',
    textClass: 'text-[#B388FF]',
    label: 'WARN',
  },
  SYS_INFO: {
    icon: Info,
    color: '#00E5FF',
    bgClass: 'bg-[#00E5FF]/10',
    borderClass: 'border-[#00E5FF]/20',
    textClass: 'text-[#00E5FF]',
    label: 'INFO',
  },
};

export default function GlassPingsView({ sessions }: GlassPingsViewProps) {
  const pings = useMemo<PingEvent[]>(() => {
    return sessions
      .map((session, index) => {
        let type: PingEvent['type'] = 'SYS_INFO';
        let description = '';

        switch (session.state) {
          case 'COMPLETED':
            type = 'SYS_OK';
            description = `Mission completed successfully`;
            break;
          case 'FAILED':
            type = 'CRIT_FAIL';
            description = `Mission failed`;
            break;
          case 'CANCELLED':
          case 'STOPPED':
            type = 'CRIT_FAIL';
            description = `Mission was cancelled`;
            break;
          case 'AWAITING':
            type = 'WARN_ALERT';
            description = `Awaiting plan approval`;
            break;
          case 'RUNNING':
            type = 'SYS_INFO';
            description = `Mission is currently running`;
            break;
          default:
            type = 'SYS_INFO';
            description = `Session state: ${session.state || 'unknown'}`;
        }

        return {
          id: `${index}-${session.sessionId}`,
          type,
          timestamp: session.createdTime || session.completedTime || '',
          description,
          sessionName: session.name || 'Untitled Mission',
        };
      })
      .sort(
        (a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        }
      );
  }, [sessions]);

  // Count by type
  const counts = useMemo(() => {
    return {
      ok: pings.filter((p) => p.type === 'SYS_OK').length,
      fail: pings.filter((p) => p.type === 'CRIT_FAIL').length,
      warn: pings.filter((p) => p.type === 'WARN_ALERT').length,
      info: pings.filter((p) => p.type === 'SYS_INFO').length,
    };
  }, [pings]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 py-4 space-y-4 pb-24"
    >
      <h2 className="text-sm font-semibold text-[#547B88] uppercase tracking-wider px-1">
        Event Timeline
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'OK', count: counts.ok, color: '#00E676' },
          { label: 'FAIL', count: counts.fail, color: '#FF2A5F' },
          { label: 'WARN', count: counts.warn, color: '#B388FF' },
          { label: 'INFO', count: counts.info, color: '#00E5FF' },
        ].map(({ label, count, color }) => (
          <div key={label} className="glass-card p-2.5 text-center">
            <span
              className="text-lg font-bold"
              style={{ color }}
            >
              {count}
            </span>
            <p className="text-[9px] text-[#547B88] uppercase tracking-wider mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {pings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Bell className="w-10 h-10 text-[#547B88] opacity-30 mx-auto mb-3" />
          <p className="text-sm text-[#547B88]">No events yet</p>
          <p className="text-xs text-[#547B88] mt-1 opacity-60">
            Events will appear when missions are created and processed
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#00E5FF]/10" />

          <div className="space-y-1">
            {pings.map((ping, index) => {
              const config = pingConfig[ping.type];
              const Icon = config.icon;

              return (
                <motion.div
                  key={ping.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex gap-3 items-start pl-1"
                >
                  {/* Dot */}
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${config.color}15` }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: config.color }}
                    />
                  </div>

                  {/* Content */}
                  <div className="glass-card p-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${config.color}15`,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </span>
                      <span className="text-[10px] text-[#547B88]">
                        {relativeTime(ping.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-[#E0F7FA]">{ping.description}</p>
                    <p className="text-[10px] text-[#547B88] mt-0.5 font-mono truncate">
                      {ping.sessionName}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
