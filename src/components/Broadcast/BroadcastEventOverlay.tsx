import React from 'react';
import { Award, Crown, Flame, Sparkles } from 'lucide-react';
import {
  ActiveBroadcastEvent,
  ActiveBroadcastMilestone,
  BroadcastFlashType
} from '../../hooks/useBroadcastEffects';
import { PlayerAvatar } from '../PlayerAvatar';

interface BroadcastEventOverlayProps {
  animationsEnabled: boolean;
  flashEvent: { type: BroadcastFlashType | null; key: number };
  activeEvent: ActiveBroadcastEvent | null;
  activeMilestone: ActiveBroadcastMilestone | null;
  variant?: 'broadcast' | 'obs';
  obsPosition?: 'bottom' | 'top';
}

export const BroadcastEventOverlay: React.FC<BroadcastEventOverlayProps> = ({
  animationsEnabled,
  flashEvent,
  activeEvent,
  activeMilestone,
  variant = 'broadcast',
  obsPosition = 'bottom'
}) => {
  if (!animationsEnabled) return null;

  const isObs = variant === 'obs';
  const bannerPositionClass = isObs
    ? obsPosition === 'top'
      ? 'top-24 left-1/2 -translate-x-1/2'
      : 'bottom-24 left-1/2 -translate-x-1/2'
    : 'top-14 left-1/2 -translate-x-1/2';

  const milestonePositionClass = isObs
    ? obsPosition === 'top'
      ? 'top-44 left-1/2 -translate-x-1/2'
      : 'bottom-44 left-1/2 -translate-x-1/2'
    : 'top-36 left-1/2 -translate-x-1/2';

  return (
    <>
      {/* Screen / Frame Edge Flash (Blue = 4, Gold = 6, Red = Wicket) */}
      {flashEvent.type && (
        <div
          key={`flash-${flashEvent.key}`}
          className={`fixed inset-0 pointer-events-none z-40 animate-flash-pulse ${
            flashEvent.type === 'wicket'
              ? isObs
                ? 'ring-[8px] ring-inset ring-rose-500/90 bg-gradient-to-t from-rose-600/25 via-transparent to-rose-600/15'
                : 'bg-rose-600/25 ring-4 ring-inset ring-rose-500/85'
              : flashEvent.type === 'six'
              ? isObs
                ? 'ring-[8px] ring-inset ring-amber-400/90 bg-gradient-to-t from-amber-400/20 via-transparent to-amber-400/15'
                : 'bg-amber-400/20 ring-4 ring-inset ring-amber-400/85'
              : isObs
              ? 'ring-[8px] ring-inset ring-sky-400/90 bg-gradient-to-t from-sky-500/20 via-transparent to-sky-500/15'
              : 'bg-sky-500/20 ring-4 ring-inset ring-sky-400/85'
          }`}
        />
      )}

      {/* 3-Second Auto-Dismiss Event Banner (FOUR! / SIX! / WICKET!) */}
      {activeEvent && (
        <div
          key={`event-${activeEvent.key}`}
          className={`fixed ${bannerPositionClass} z-50 pointer-events-none w-[92%] max-w-lg animate-boundary-banner`}
        >
          {activeEvent.type === 'four' && (
            <div className="rounded-2xl border-2 border-sky-300 bg-gradient-to-r from-[#071a3e]/95 via-blue-700/95 to-[#071a3e]/95 px-5 py-3 shadow-[0_14px_40px_rgba(37,99,235,0.55)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-sky-400 text-slate-950 font-score font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
                  4
                </div>
                <div className="min-w-0">
                  <div className="font-score text-2xl sm:text-3xl font-black tracking-[0.16em] text-white leading-none">
                    FOUR!
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-sky-100 truncate mt-1">
                    {activeEvent.subtitle}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-200 block">
                  BOUNDARY
                </span>
                <span className="font-score text-xs sm:text-sm font-black text-white">
                  {activeEvent.scoreText}
                </span>
              </div>
            </div>
          )}

          {activeEvent.type === 'six' && (
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-[#291702]/95 via-amber-600/95 to-[#291702]/95 px-5 py-3 shadow-[0_14px_40px_rgba(245,158,11,0.55)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-amber-300 text-slate-950 font-score font-black text-2xl flex items-center justify-center shrink-0 shadow-md">
                  6
                </div>
                <div className="min-w-0">
                  <div className="font-score text-2xl sm:text-3xl font-black tracking-[0.16em] text-amber-100 leading-none flex items-center gap-1.5">
                    <span>SIX!</span>
                    <Flame className="w-5 h-5 text-amber-200" />
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-amber-100 truncate mt-1">
                    {activeEvent.subtitle}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200 block">
                  MAXIMUM
                </span>
                <span className="font-score text-xs sm:text-sm font-black text-white">
                  {activeEvent.scoreText}
                </span>
              </div>
            </div>
          )}

          {activeEvent.type === 'wicket' && (
            <div className="rounded-2xl border-2 border-rose-300 bg-gradient-to-r from-rose-950/95 via-rose-700/95 to-rose-950/95 px-5 py-3 shadow-[0_16px_45px_rgba(225,29,72,0.65)] text-center">
              <div className="font-score text-3xl sm:text-4xl font-black tracking-[0.2em] text-white leading-none">
                WICKET!
              </div>
              <div className="mt-1.5 text-[11px] sm:text-xs font-bold text-rose-100 uppercase tracking-wider truncate">
                {activeEvent.subtitle} • {activeEvent.scoreText}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special Milestone Celebration Banner (FIFTY 50 & CENTURY 100) */}
      {activeMilestone && (
        <div
          key={`milestone-${activeMilestone.key}`}
          className={`fixed ${milestonePositionClass} z-50 pointer-events-none w-[92%] max-w-xl animate-milestone-banner`}
        >
          <div
            className={`rounded-2xl border-2 px-5 py-3.5 shadow-2xl flex items-center justify-between gap-4 ${
              activeMilestone.type === 'century'
                ? 'border-amber-300 bg-gradient-to-r from-[#1c1303]/95 via-amber-700/90 to-[#1c1303]/95 shadow-[0_18px_50px_rgba(245,158,11,0.55)]'
                : 'border-emerald-300 bg-gradient-to-r from-[#041f18]/95 via-emerald-800/95 to-[#041f18]/95 shadow-[0_18px_50px_rgba(16,185,129,0.5)]'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <PlayerAvatar
                name={activeMilestone.playerName}
                teamCode={activeMilestone.teamCode}
                imageUrl={activeMilestone.imageUrl}
                size="md"
                ringVariant="gold"
                showJerseyNumber={false}
                showStrikeBadge={false}
              />
              <div className="min-w-0">
                <div
                  className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${
                    activeMilestone.type === 'century' ? 'text-amber-200' : 'text-emerald-200'
                  }`}
                >
                  {activeMilestone.type === 'century' ? (
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Award className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                  <span>
                    {activeMilestone.type === 'century' ? 'CENTURY MILESTONE' : 'HALF-CENTURY MILESTONE'}
                  </span>
                  <Sparkles className="w-3 h-3" />
                </div>
                <div className="font-score text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate mt-0.5">
                  {activeMilestone.playerName}
                </div>
                <div className="text-[11px] font-score text-slate-200 mt-0.5">
                  {activeMilestone.fours} Fours • {activeMilestone.sixes} Sixes • {activeMilestone.teamCode}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 pl-2 border-l border-white/15">
              <div
                className={`font-score text-3xl sm:text-4xl font-black leading-none ${
                  activeMilestone.type === 'century' ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {activeMilestone.runs}*
              </div>
              <div className="font-score text-[11px] font-bold text-slate-200 mt-1 uppercase">
                {activeMilestone.balls} BALLS
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
