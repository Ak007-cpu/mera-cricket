import React from 'react';
import { MatchState } from '../../types/cricket';
import { getTargetChaseMetrics } from '../../utils/matchAnalytics';
import { Target } from 'lucide-react';

interface TargetChasePanelProps {
  match: MatchState | null | undefined;
  variant?: 'broadcast' | 'obs';
}

export const TargetChasePanel: React.FC<TargetChasePanelProps> = ({
  match,
  variant = 'broadcast'
}) => {
  const metrics = getTargetChaseMetrics(match);
  if (!metrics) return null;

  const isObs = variant === 'obs';

  if (isObs) {
    return (
      <div
        aria-label="Target Chase Panel"
        className="max-w-5xl mx-auto w-full bg-[#050c1d]/95 border border-sky-400/30 rounded-xl px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs"
      >
        <div className="flex items-center gap-2 font-score font-black text-white">
          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-slate-300 font-semibold">Target:</span>
          <span className="text-amber-300 text-sm">{metrics.target}</span>
        </div>

        <div className="font-sans font-bold text-slate-100 text-xs sm:text-sm">
          Need <span className="font-score text-sky-300 font-black">{metrics.neededRuns}</span> runs in{' '}
          <span className="font-score text-white font-black">{metrics.oversDisplay}</span>
        </div>

        <div className="font-score font-bold text-slate-300 text-xs">
          Required Run Rate:{' '}
          <span className="text-amber-300 font-black text-sm">{metrics.requiredRunRate.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Target Chase Panel"
      className="bg-white dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-sm dark:shadow-xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        {/* Left: Target */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-400/15 border border-amber-400/70 dark:border-amber-400/40 flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="font-score text-sm font-black text-slate-950 dark:text-white tracking-wide">
            <span className="text-slate-600 dark:text-slate-300 font-semibold mr-1.5">Target:</span>
            <span className="text-amber-700 dark:text-amber-300 text-base sm:text-lg">{metrics.target}</span>
          </div>
        </div>

        {/* Center: Need X runs in Y overs */}
        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight sm:text-center">
          Need{' '}
          <span className="font-score text-amber-700 dark:text-amber-300 font-black text-base sm:text-lg">
            {metrics.neededRuns}
          </span>{' '}
          {metrics.neededRuns === 1 ? 'run' : 'runs'} in{' '}
          <span className="font-score text-slate-950 dark:text-white font-black text-base sm:text-lg">
            {metrics.oversDisplay}
          </span>
        </div>

        {/* Right: Required Run Rate */}
        <div className="flex items-baseline sm:justify-end gap-2 font-score text-sm shrink-0">
          <span className="text-slate-600 dark:text-slate-300 font-semibold">Required Run Rate:</span>
          <span className="text-amber-700 dark:text-amber-300 font-black text-base sm:text-lg">
            {metrics.requiredRunRate.toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
};
