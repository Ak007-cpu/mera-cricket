import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { MatchTimerConfig } from '../../types/cricket';

interface MatchElapsedTimerProps {
  timer?: MatchTimerConfig | null;
  compact?: boolean;
}

export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function computeElapsedMs(timer?: MatchTimerConfig | null, nowMs: number = Date.now()): number {
  if (!timer) return 0;
  const base = Math.max(0, timer.accumulatedMs || 0);
  if (timer.active && timer.startedAt > 0) {
    return base + Math.max(0, nowMs - timer.startedAt);
  }
  return base;
}

export const MatchElapsedTimer: React.FC<MatchElapsedTimerProps> = ({ timer, compact = false }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const isActive = Boolean(timer?.active && timer.startedAt > 0);

  useEffect(() => {
    setNowMs(Date.now());
    if (!isActive) return;

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timer?.startedAt, timer?.accumulatedMs]);

  const elapsedMs = computeElapsedMs(timer, nowMs);
  const formatted = formatElapsedTime(elapsedMs);

  return (
    <div
      title={isActive ? 'Elapsed match time (Firebase active)' : 'Match timer paused / standby'}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-mono tabular-nums whitespace-nowrap shrink-0 ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm'
      } ${
        isActive
          ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500/45 dark:bg-emerald-950/35 dark:text-emerald-200'
          : 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-300'
      }`}
    >
      <Timer
        className={`w-3.5 h-3.5 shrink-0 ${
          isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
        }`}
      />
      <span className="font-bold tracking-wider">{formatted}</span>
      <span
        className={`text-[10px] font-sans font-bold uppercase tracking-wider ${
          isActive ? 'text-emerald-700 dark:text-emerald-300/80' : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {isActive ? 'ELAPSED' : 'PAUSED'}
      </span>
    </div>
  );
};
