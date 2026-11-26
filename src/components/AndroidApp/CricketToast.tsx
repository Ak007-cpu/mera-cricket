import React, { useEffect, useState } from 'react';
import { PlayerAvatar } from '../PlayerAvatar';
import { X, Trophy, AlertCircle, Clock, Sparkles, ChevronRight, Flame } from 'lucide-react';

export interface CricketToastItem {
  id: string;
  type:
    | 'wicket'
    | 'fifty'
    | 'century'
    | 'thirty'
    | 'one_fifty'
    | 'double_century'
    | 'five_wickets'
    | 'four_wickets'
    | 'three_wickets'
    | 'maiden'
    | 'innings_break'
    | 'match_result'
    | 'match_starting'
    | 'new_match'
    | 'tight_finish'
    | 'six'
    | 'four'
    | 'boundary'
    | 'custom';
  title: string;
  subtitle: string;
  detail?: string;
  teamScore?: string;
  playerImageUrl?: string;
  playerName?: string;
  playerId?: string;
  runs?: number;
  balls?: number;
  bowlerName?: string;
  bowlerWickets?: number;
  bowlerRuns?: number;
  bowlerOvers?: number;
  target?: number;
  timestamp: number;
  durationMs?: number;
}

interface CricketToastProps {
  toast: CricketToastItem;
  onDismiss: (id: string) => void;
  onActionClick?: (toast: CricketToastItem) => void;
}

export const CricketToast: React.FC<CricketToastProps> = ({
  toast,
  onDismiss,
  onActionClick
}) => {
  const duration =
    toast.durationMs ||
    (toast.type === 'century' || toast.type === 'five_wickets' || toast.type === 'double_century'
      ? 8000
      : 6500);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [toast.id, duration, onDismiss]);

  const getToastTheme = () => {
    switch (toast.type) {
      case 'wicket':
        return {
          wrapperBorder: 'border-rose-500/80 shadow-rose-950/50',
          gradientBg: 'from-rose-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-rose-600',
          badgeText: 'WICKET FALL',
          icon: <AlertCircle className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-rose-400',
          scoreBadgeBg: 'bg-rose-900/40 border-rose-700/50 text-rose-300',
          progressColor: 'bg-rose-500',
          glowRing: 'ring-1 ring-rose-500/40'
        };
      case 'double_century':
      case 'one_fifty':
        return {
          wrapperBorder: 'border-purple-400/90 shadow-purple-950/60',
          gradientBg: 'from-purple-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black',
          badgeText: toast.type === 'double_century' ? '👑 DOUBLE CENTURY (200*)' : '👑 150* LANDMARK',
          icon: <Trophy className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-purple-300',
          scoreBadgeBg: 'bg-purple-900/40 border-purple-600/50 text-purple-200',
          progressColor: 'bg-purple-400',
          glowRing: 'ring-2 ring-purple-400/50'
        };
      case 'century':
        return {
          wrapperBorder: 'border-amber-400/90 shadow-amber-950/60',
          gradientBg: 'from-amber-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black',
          badgeText: 'MAGNIFICENT CENTURY (100*)',
          icon: <Trophy className="w-3.5 h-3.5 text-slate-950" />,
          accentTextColor: 'text-amber-300',
          scoreBadgeBg: 'bg-amber-900/40 border-amber-600/50 text-amber-200',
          progressColor: 'bg-amber-400',
          glowRing: 'ring-2 ring-amber-400/50'
        };
      case 'fifty':
        return {
          wrapperBorder: 'border-yellow-500/80 shadow-yellow-950/50',
          gradientBg: 'from-yellow-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-yellow-500 text-slate-950 font-bold',
          badgeText: 'HALF-CENTURY (50*)',
          icon: <Trophy className="w-3.5 h-3.5 text-slate-950" />,
          accentTextColor: 'text-yellow-300',
          scoreBadgeBg: 'bg-yellow-900/40 border-yellow-700/50 text-yellow-200',
          progressColor: 'bg-yellow-400',
          glowRing: 'ring-1 ring-yellow-400/40'
        };
      case 'thirty':
        return {
          wrapperBorder: 'border-sky-500/80 shadow-sky-950/50',
          gradientBg: 'from-sky-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-sky-500 text-slate-950 font-bold',
          badgeText: '30* RUNS MILESTONE',
          icon: <Sparkles className="w-3.5 h-3.5 text-slate-950" />,
          accentTextColor: 'text-sky-300',
          scoreBadgeBg: 'bg-sky-900/40 border-sky-700/50 text-sky-200',
          progressColor: 'bg-sky-400',
          glowRing: 'ring-1 ring-sky-400/40'
        };
      case 'five_wickets':
        return {
          wrapperBorder: 'border-emerald-400/90 shadow-emerald-950/60',
          gradientBg: 'from-emerald-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black',
          badgeText: '🔥 5-WICKET HAUL (5W)',
          icon: <Flame className="w-3.5 h-3.5 text-slate-950" />,
          accentTextColor: 'text-emerald-300',
          scoreBadgeBg: 'bg-emerald-900/40 border-emerald-600/50 text-emerald-200',
          progressColor: 'bg-emerald-400',
          glowRing: 'ring-2 ring-emerald-400/50'
        };
      case 'three_wickets':
      case 'four_wickets':
        return {
          wrapperBorder: 'border-teal-500/80 shadow-teal-950/50',
          gradientBg: 'from-teal-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-teal-600 text-white font-bold',
          badgeText: toast.type === 'four_wickets' ? '🎯 4-WICKET SPELL' : '🎯 3-WICKET HAUL',
          icon: <Flame className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-teal-300',
          scoreBadgeBg: 'bg-teal-900/40 border-teal-700/50 text-teal-200',
          progressColor: 'bg-teal-400',
          glowRing: 'ring-1 ring-teal-400/40'
        };
      case 'maiden':
        return {
          wrapperBorder: 'border-slate-500/80 shadow-slate-950/50',
          gradientBg: 'from-slate-900/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-slate-600 text-white font-bold',
          badgeText: '🛑 MAIDEN OVER',
          icon: <Clock className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-slate-300',
          scoreBadgeBg: 'bg-slate-800 border-slate-700 text-slate-300',
          progressColor: 'bg-slate-400',
          glowRing: 'ring-1 ring-slate-500/40'
        };
      case 'match_result':
        return {
          wrapperBorder: 'border-amber-500/80 shadow-amber-950/60',
          gradientBg: 'from-amber-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-amber-500 text-slate-950 font-black',
          badgeText: '🏆 MATCH RESULT',
          icon: <Trophy className="w-3.5 h-3.5 text-slate-950" />,
          accentTextColor: 'text-amber-300',
          scoreBadgeBg: 'bg-amber-900/40 border-amber-600/50 text-amber-200',
          progressColor: 'bg-amber-400',
          glowRing: 'ring-2 ring-amber-400/50'
        };
      case 'match_starting':
        return {
          wrapperBorder: 'border-rose-600 shadow-rose-950/50',
          gradientBg: 'from-rose-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-rose-600 text-white font-black animate-pulse',
          badgeText: '🔴 MATCH STARTING',
          icon: <Flame className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-rose-300',
          scoreBadgeBg: 'bg-rose-900/40 border-rose-700/50 text-rose-200',
          progressColor: 'bg-rose-500',
          glowRing: 'ring-1 ring-rose-500/40'
        };
      case 'new_match':
        return {
          wrapperBorder: 'border-violet-500/80 shadow-violet-950/50',
          gradientBg: 'from-violet-950/90 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-violet-600 text-white font-bold',
          badgeText: '📅 NEW MATCH LISTED',
          icon: <Sparkles className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-violet-300',
          scoreBadgeBg: 'bg-violet-900/40 border-violet-700/50 text-violet-200',
          progressColor: 'bg-violet-400',
          glowRing: 'ring-1 ring-violet-400/40'
        };
      case 'innings_break':
        return {
          wrapperBorder: 'border-blue-500/80 shadow-blue-950/50',
          gradientBg: 'from-blue-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-blue-600 text-white',
          badgeText: 'INNINGS BREAK',
          icon: <Clock className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-blue-300',
          scoreBadgeBg: 'bg-blue-900/40 border-blue-700/50 text-blue-200',
          progressColor: 'bg-blue-500',
          glowRing: 'ring-1 ring-blue-500/40'
        };
      case 'six':
        return {
          wrapperBorder: 'border-purple-500/80 shadow-purple-950/50',
          gradientBg: 'from-purple-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-purple-600 text-white',
          badgeText: 'MAXIMUM SIX',
          icon: <Sparkles className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-purple-300',
          scoreBadgeBg: 'bg-purple-900/40 border-purple-700/50 text-purple-200',
          progressColor: 'bg-purple-500',
          glowRing: 'ring-1 ring-purple-500/40'
        };
      case 'boundary':
      case 'four':
        return {
          wrapperBorder: 'border-cyan-500/80 shadow-cyan-950/50',
          gradientBg: 'from-cyan-950/95 via-slate-900/98 to-slate-950/95',
          headerBg: 'bg-cyan-600 text-white',
          badgeText: toast.type === 'boundary' ? 'BOUNDARY HIT' : 'CRACKING FOUR',
          icon: <Sparkles className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-cyan-300',
          scoreBadgeBg: 'bg-cyan-900/40 border-cyan-700/50 text-cyan-200',
          progressColor: 'bg-cyan-500',
          glowRing: 'ring-1 ring-cyan-500/40'
        };
      default:
        return {
          wrapperBorder: 'border-slate-700 shadow-slate-950/50',
          gradientBg: 'from-slate-900/98 to-slate-950/95',
          headerBg: 'bg-blue-600 text-white',
          badgeText: 'MATCH ALERT',
          icon: <Flame className="w-3.5 h-3.5 text-white" />,
          accentTextColor: 'text-blue-300',
          scoreBadgeBg: 'bg-slate-800 border-slate-700 text-slate-200',
          progressColor: 'bg-blue-500',
          glowRing: 'ring-1 ring-slate-700'
        };
    }
  };

  const theme = getToastTheme();

  return (
    <div className="w-full select-none animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`relative overflow-hidden rounded-2xl border-2 ${theme.wrapperBorder} bg-gradient-to-r ${theme.gradientBg} ${theme.glowRing} backdrop-blur-xl shadow-2xl p-3 text-white transition-all`}
      >
        {/* Glow Effects */}
        {toast.type === 'century' && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
        )}
        {toast.type === 'five_wickets' && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
        )}
        {toast.type === 'wicket' && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
        )}

        {/* Top Header Strip: Category Pill, Live Sync badge, Dismiss Button */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm ${theme.headerBg}`}
            >
              {theme.icon}
              <span>{theme.badgeText}</span>
            </span>

            {toast.teamScore && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${theme.scoreBadgeBg}`}
              >
                {toast.teamScore}
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss Toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Visual Content */}
        <div
          onClick={() => onActionClick && onActionClick(toast)}
          className="flex items-center gap-3 pt-2.5 cursor-pointer group"
        >
          {/* Avatar Thumbnail */}
          <div className="shrink-0 relative">
            <PlayerAvatar
              playerId={toast.playerId}
              name={toast.playerName || toast.title}
              imageUrl={toast.playerImageUrl}
              size="sm"
              showJerseyNumber={false}
            />
            {toast.type === 'century' && (
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 font-black text-[9px] px-1 rounded-full shadow">
                100*
              </span>
            )}
            {toast.type === 'fifty' && (
              <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-950 font-black text-[9px] px-1 rounded-full shadow">
                50*
              </span>
            )}
            {toast.type === 'five_wickets' && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-400 text-slate-950 font-black text-[9px] px-1 rounded-full shadow">
                5W
              </span>
            )}
            {toast.type === 'wicket' && (
              <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white font-black text-[9px] px-1 rounded-full shadow">
                OUT
              </span>
            )}
          </div>

          {/* Texts & Stats */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs sm:text-sm text-white tracking-tight uppercase truncate">
                {toast.title}
              </h4>
              <span className="text-[10px] font-semibold text-slate-400 flex items-center group-hover:text-blue-400 transition-colors ml-1 shrink-0">
                Scorecard <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>

            <p className="text-xs text-slate-200 mt-0.5 leading-snug line-clamp-2">
              {toast.subtitle}
            </p>

            {toast.detail && (
              <div className={`text-[10px] font-mono mt-1 font-semibold ${theme.accentTextColor}`}>
                {toast.detail}
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-white/10 h-1 mt-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full ${theme.progressColor} transition-all duration-75 ease-linear shadow-sm`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface CricketToastContainerProps {
  toasts: CricketToastItem[];
  onDismiss: (id: string) => void;
  onActionClick?: (toast: CricketToastItem) => void;
}

export const CricketToastContainer: React.FC<CricketToastContainerProps> = ({
  toasts,
  onDismiss,
  onActionClick
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-12 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-auto max-w-sm mx-auto">
      {toasts.map((toast) => (
        <CricketToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onActionClick={onActionClick}
        />
      ))}
    </div>
  );
};
