import React from 'react';
import { CloudRain, Clock, Coffee, RefreshCw } from 'lucide-react';
import { BreakScreenConfig, BreakScreenType, MatchState } from '../../types/cricket';
import { TeamFlag } from '../TeamFlag';

interface BreakScreenOverlayProps {
  breakScreen?: BreakScreenConfig | null;
  match: MatchState | null;
  animationsEnabled: boolean;
  siteName?: string;
  variant?: 'broadcast' | 'obs';
  obsPosition?: 'bottom' | 'top';
}

interface BreakVisualMeta {
  title: string;
  defaultSubtitle: string;
  badgeText: string;
  accentGradient: string;
  borderClass: string;
  badgeClass: string;
  barColor: string;
  Icon: React.FC<{ className?: string }>;
}

const BREAK_META: Record<BreakScreenType, BreakVisualMeta> = {
  drinks: {
    title: 'DRINKS BREAK',
    defaultSubtitle: 'Players taking refreshments — live action resumes shortly',
    badgeText: 'MATCH PAUSED',
    accentGradient: 'from-[#061834] via-[#0a2448] to-[#06152c]',
    borderClass: 'border-sky-400/50',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
    barColor: 'bg-sky-400',
    Icon: Coffee
  },
  rain: {
    title: 'RAIN DELAY',
    defaultSubtitle: 'Covers are on the pitch — waiting for weather clearance',
    badgeText: 'WEATHER DELAY',
    accentGradient: 'from-[#091326] via-[#11223d] to-[#070f1e]',
    borderClass: 'border-cyan-400/45',
    badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
    barColor: 'bg-cyan-400',
    Icon: CloudRain
  },
  innings: {
    title: 'INNINGS BREAK',
    defaultSubtitle: 'Mid-innings changeover — second innings starting soon',
    badgeText: 'CHANGE OF INNINGS',
    accentGradient: 'from-[#101836] via-[#1c234d] to-[#090f24]',
    borderClass: 'border-amber-400/50',
    badgeClass: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
    barColor: 'bg-amber-400',
    Icon: RefreshCw
  },
  starting_soon: {
    title: 'MATCH STARTING SOON',
    defaultSubtitle: 'Live broadcast coverage is about to begin — stay tuned',
    badgeText: 'PRE-MATCH BUILDUP',
    accentGradient: 'from-[#061c1d] via-[#0b2b2c] to-[#051319]',
    borderClass: 'border-emerald-400/50',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    barColor: 'bg-emerald-400',
    Icon: Clock
  }
};

export const BreakScreenOverlay: React.FC<BreakScreenOverlayProps> = ({
  breakScreen,
  match,
  animationsEnabled,
  siteName = 'Live Cricket HD',
  variant = 'broadcast',
  obsPosition = 'bottom'
}) => {
  if (!breakScreen?.active) return null;

  const meta = BREAK_META[breakScreen.type] || BREAK_META.drinks;
  const Icon = meta.Icon;
  const subtitle = breakScreen.subtitle?.trim() || meta.defaultSubtitle;

  if (variant === 'obs') {
    return (
      <div
        className={`w-full min-h-screen bg-transparent pointer-events-none px-4 sm:px-8 py-4 flex flex-col ${
          obsPosition === 'top' ? 'justify-start' : 'justify-end'
        } select-none`}
      >
        <div
          className={`max-w-4xl mx-auto w-full rounded-2xl bg-gradient-to-r ${meta.accentGradient}/95 border-2 ${meta.borderClass} px-5 py-4 shadow-[0_16px_45px_rgba(0,0,0,0.75)] relative overflow-hidden`}
        >
          {/* Subtle GPU sweep bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
            <div
              className={`h-full w-1/2 ${meta.barColor} ${
                animationsEnabled ? 'animate-break-sweep' : ''
              }`}
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl border ${meta.badgeClass} flex items-center justify-center shrink-0 ${
                  animationsEnabled ? 'animate-break-float' : ''
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${meta.badgeClass}`}
                  >
                    {meta.badgeText}
                  </span>
                </div>
                <h2 className="font-score text-xl sm:text-2xl font-black text-white tracking-wider uppercase mt-1 leading-none">
                  {meta.title}
                </h2>
                <p className="text-xs text-slate-300 mt-1 truncate">{subtitle}</p>
              </div>
            </div>

            {match && (
              <div className="flex items-center gap-3 bg-slate-950/65 border border-white/10 rounded-xl px-3.5 py-2 shrink-0">
                <TeamFlag
                  teamName={match.battingTeam.name}
                  teamCode={match.battingTeam.code}
                  logoUrl={match.battingTeam.logoUrl}
                  size="sm"
                />
                <div className="text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    {match.battingTeam.shortName || match.battingTeam.code} vs{' '}
                    {match.bowlingTeam.shortName || match.bowlingTeam.code}
                  </div>
                  <div className="font-score text-base font-black text-white leading-tight">
                    {match.battingTeam.score.runs}/{match.battingTeam.score.wickets}{' '}
                    <span className="text-xs text-amber-300 font-bold">
                      ({match.battingTeam.score.overs}.{match.battingTeam.score.balls})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full Broadcast Slate View
  return (
    <div className="fixed inset-0 z-40 bg-[#030712]/95 flex flex-col justify-between p-5 sm:p-8 select-none">
      {/* Top Broadcast Slate Header */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-black text-[11px] uppercase tracking-widest">
            ON AIR
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-200">{siteName}</span>
        </div>
        {match && (
          <span className="text-xs font-score text-slate-400 uppercase truncate max-w-xs sm:max-w-md">
            {match.series || match.title}
          </span>
        )}
      </div>

      {/* Center Animated Break Card */}
      <div className="flex-1 flex items-center justify-center py-6">
        <div
          className={`max-w-2xl w-full rounded-3xl bg-gradient-to-br ${meta.accentGradient} border-2 ${meta.borderClass} p-6 sm:p-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative overflow-hidden`}
        >
          {/* Top GPU Animated Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
            <div
              className={`h-full w-1/2 ${meta.barColor} ${
                animationsEnabled ? 'animate-break-sweep' : ''
              }`}
            />
          </div>

          <div
            className={`w-20 h-20 rounded-2xl border-2 ${meta.badgeClass} mx-auto flex items-center justify-center shadow-lg ${
              animationsEnabled ? 'animate-break-float' : ''
            }`}
          >
            <Icon className="w-10 h-10" />
          </div>

          <div className="mt-5">
            <span
              className={`inline-block px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-[0.2em] border ${meta.badgeClass}`}
            >
              {meta.badgeText}
            </span>
          </div>

          <h1 className="font-score text-3xl sm:text-5xl font-black text-white tracking-wider uppercase mt-4">
            {meta.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-200 max-w-lg mx-auto mt-3 leading-relaxed">
            {subtitle}
          </p>

          {match && (
            <div className="mt-7 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <TeamFlag
                  teamName={match.battingTeam.name}
                  teamCode={match.battingTeam.code}
                  logoUrl={match.battingTeam.logoUrl}
                  size="md"
                  className="border border-white/20"
                />
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-300 uppercase">
                    {match.battingTeam.name}
                  </div>
                  <div className="font-score text-2xl font-black text-white">
                    {match.battingTeam.score.runs}/{match.battingTeam.score.wickets}{' '}
                    <span className="text-xs text-amber-300">
                      ({match.battingTeam.score.overs}.{match.battingTeam.score.balls} ov)
                    </span>
                  </div>
                </div>
              </div>

              <span className="font-score text-xs font-bold text-slate-400 uppercase tracking-widest">
                VS
              </span>

              <div className="flex items-center gap-3">
                <TeamFlag
                  teamName={match.bowlingTeam.name}
                  teamCode={match.bowlingTeam.code}
                  logoUrl={match.bowlingTeam.logoUrl}
                  size="md"
                  className="border border-white/20"
                />
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-300 uppercase">
                    {match.bowlingTeam.name}
                  </div>
                  <div className="font-score text-sm font-bold text-slate-300">
                    {match.bowlingTeam.score.runs > 0
                      ? `${match.bowlingTeam.score.runs}/${match.bowlingTeam.score.wickets} (${match.bowlingTeam.score.overs}.${match.bowlingTeam.score.balls})`
                      : match.target
                      ? `Target ${match.target}`
                      : 'Bowling'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Slate Note */}
      <div className="max-w-5xl mx-auto w-full text-center text-xs text-slate-400">
        {match?.statusText || 'Live broadcast will return automatically when play resumes.'}
      </div>
    </div>
  );
};
