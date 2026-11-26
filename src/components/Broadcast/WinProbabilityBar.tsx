import React from 'react';
import { MatchState, WinProbabilityOverride } from '../../types/cricket';
import { calculateWinProbability } from '../../utils/matchAnalytics';

interface WinProbabilityBarProps {
  match: MatchState | null | undefined;
  enabled?: boolean;
  override?: WinProbabilityOverride | null;
  variant?: 'broadcast' | 'obs';
}

export const WinProbabilityBar: React.FC<WinProbabilityBarProps> = ({
  match,
  enabled = true,
  override = null,
  variant = 'broadcast'
}) => {
  if (!enabled) return null;

  const prob = calculateWinProbability(match, override);
  if (!prob) return null;

  const isObs = variant === 'obs';

  return (
    <section
      aria-label="Win Probability"
      className={
        isObs
          ? 'max-w-5xl mx-auto w-full bg-[#050c1d]/95 border border-sky-400/30 rounded-xl px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]'
          : 'bg-white dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-sm dark:shadow-xl'
      }
    >
      {/* Team Codes & Centered Split Label */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-slate-900/20 dark:border-white/40"
            style={{ backgroundColor: prob.battingColor }}
          />
          <span
            className={
              isObs
                ? 'text-xs font-bold text-slate-200 truncate'
                : 'text-sm font-bold text-slate-900 dark:text-slate-100 truncate'
            }
          >
            {prob.battingCode}
          </span>
        </div>

        <div
          className={`font-score font-black tracking-wide text-center whitespace-nowrap ${
            isObs ? 'text-xs sm:text-sm text-white' : 'text-sm sm:text-base text-slate-950 dark:text-white'
          }`}
        >
          <span style={{ color: prob.battingColor }}>{prob.battingCode}</span>{' '}
          <span>{prob.battingPct}%</span>
          <span className="text-slate-400 dark:text-slate-500 mx-2">-</span>
          <span style={{ color: prob.bowlingColor }}>{prob.bowlingCode}</span>{' '}
          <span>{prob.bowlingPct}%</span>
        </div>

        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span
            className={
              isObs
                ? 'text-xs font-bold text-slate-200 truncate'
                : 'text-sm font-bold text-slate-900 dark:text-slate-100 truncate'
            }
          >
            {prob.bowlingCode}
          </span>
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-slate-900/20 dark:border-white/40"
            style={{ backgroundColor: prob.bowlingColor }}
          />
        </div>
      </div>

      {/* Slim Dual-Color Probability Bar */}
      <div
        className={`w-full h-2.5 rounded-full overflow-hidden flex border ${
          isObs ? 'bg-slate-950 border-slate-700/80' : 'bg-slate-200 dark:bg-slate-950 border-slate-300 dark:border-slate-700/80'
        }`}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${prob.battingPct}%`,
            backgroundColor: prob.battingColor
          }}
        />
        <div className="w-[2px] h-full bg-white/90 shrink-0" />
        <div
          className="h-full transition-all duration-500 ease-out flex-1"
          style={{
            backgroundColor: prob.bowlingColor
          }}
        />
      </div>

      {/* Small "Estimate" Caption */}
      <div className="text-center mt-1">
        <span
          className={
            isObs
              ? 'text-[10px] font-medium text-slate-400 tracking-wide'
              : 'text-xs font-medium text-slate-600 dark:text-slate-300 tracking-wide'
          }
        >
          Estimate
        </span>
      </div>
    </section>
  );
};
