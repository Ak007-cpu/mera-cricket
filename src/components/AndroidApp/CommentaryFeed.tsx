import React, { useState, useEffect, useRef } from 'react';
import { CommentaryItem, MatchState } from '../../types/cricket';
import { fetchCommentaryFeed } from '../../services/api';
import {
  Radio,
  Play,
  Pause,
  ChevronRight,
  X,
  Flame,
  AlertCircle,
  Trophy,
  Zap,
  Clock,
  Filter,
  Volume2
} from 'lucide-react';

interface CommentaryFeedProps {
  match: MatchState | null;
  className?: string;
  pollIntervalMs?: number;
}

export const CommentaryFeed: React.FC<CommentaryFeedProps> = ({
  match,
  className = '',
  pollIntervalMs = 3500
}) => {
  const [items, setItems] = useState<CommentaryItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'wickets' | 'boundaries' | 'milestones'>('all');
  const [lastPolledAt, setLastPolledAt] = useState<number>(Date.now());
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const tickerContainerRef = useRef<HTMLDivElement>(null);

  // Poll commentary from backend
  useEffect(() => {
    let isMounted = true;

    const loadCommentary = async () => {
      try {
        const res = await fetchCommentaryFeed(35);
        if (isMounted && res && res.success && res.items && res.items.length > 0) {
          setItems(res.items);
          setLastPolledAt(Date.now());
          return;
        }
      } catch (err) {
        // Fallback to match.recentBalls below
      }

      // Graceful fallback from active matchState recentBalls if endpoint hasn't populated yet
      if (isMounted && match?.recentBalls && match.recentBalls.length > 0) {
        const currentScore = `${match.battingTeam.shortName || match.battingTeam.code} ${match.battingTeam.score.runs}/${match.battingTeam.score.wickets} (${match.battingTeam.score.overs}.${match.battingTeam.score.balls})`;
        const fallbackItems: CommentaryItem[] = match.recentBalls.map((b) => {
          let tag: CommentaryItem['tag'] = 'RUN';
          if (b.isWicket) tag = 'WICKET';
          else if (b.isSix) tag = 'SIX';
          else if (b.isFour) tag = 'FOUR';
          else if (b.runs === 0) tag = 'DOT';

          let isMilestone = false;
          let milestoneTitle: string | undefined;
          const commLower = (b.commentary || '').toLowerCase();
          if (commLower.includes('century') || commLower.includes('fifty') || commLower.includes('haul')) {
            isMilestone = true;
            tag = 'MILESTONE';
            milestoneTitle = commLower.includes('century') ? '100* Century' : '50* Half-Century';
          }

          return {
            id: b.id,
            ballNumber: b.ballNumber,
            overNumber: b.overNumber,
            ballInOver: b.ballInOver,
            runs: b.runs,
            isWicket: b.isWicket,
            wicketType: b.wicketType,
            isFour: b.isFour,
            isSix: b.isSix,
            isExtra: b.isExtra,
            extraType: b.extraType,
            isMilestone,
            milestoneTitle,
            batsmanName: b.batsmanName,
            bowlerName: b.bowlerName,
            commentary: b.commentary,
            timestamp: b.timestamp,
            teamScore: currentScore,
            tag
          };
        });
        setItems(fallbackItems);
      }
    };

    loadCommentary();
    const interval = setInterval(loadCommentary, pollIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [match?.lastUpdated, pollIntervalMs]);

  // Step active item in ticker every 4 seconds when not paused
  useEffect(() => {
    if (isPaused || items.length <= 1) return;

    const timer = setInterval(() => {
      setActiveItemIndex((prev) => (prev + 1) % items.length);
    }, 4200);

    return () => clearInterval(timer);
  }, [isPaused, items.length]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = items[activeItemIndex % items.length] || items[0];

  // Tag styling helper
  const renderTagBadge = (tag: CommentaryItem['tag'], runs: number) => {
    switch (tag) {
      case 'WICKET':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shadow-sm">
            🚨 Wicket
          </span>
        );
      case 'SIX':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-sm">
            💥 6 Runs
          </span>
        );
      case 'FOUR':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-sky-500 text-white shadow-sm">
            ⚡ 4 Runs
          </span>
        );
      case 'MILESTONE':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 font-bold shadow-sm">
            🏆 Milestone
          </span>
        );
      case 'DOT':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            • Dot
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            +{runs} {runs === 1 ? 'Run' : 'Runs'}
          </span>
        );
    }
  };

  // Filtered items for expanded log
  const filteredItems = items.filter((item) => {
    if (filterType === 'wickets') return item.isWicket;
    if (filterType === 'boundaries') return item.isFour || item.isSix;
    if (filterType === 'milestones') return item.isMilestone;
    return true;
  });

  return (
    <>
      {/* 1. SCROLLING TICKER CONTAINER */}
      <div
        className={`bg-slate-950/95 border-y border-slate-800/80 px-2.5 py-1.5 shadow-md flex items-center gap-2 select-none ${className}`}
      >
        {/* Live Badge */}
        <div className="flex items-center gap-1.5 shrink-0 bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-wider font-mono">FEED</span>
        </div>

        {/* Ticker Content Window */}
        <div
          ref={tickerContainerRef}
          onClick={() => setIsExpanded(true)}
          className="flex-1 min-w-0 cursor-pointer overflow-hidden flex items-center group"
          title="Click to view full chronological match events log"
        >
          <div className="flex items-center gap-2 text-xs truncate transition-all duration-300">
            {/* Event Badge */}
            {renderTagBadge(currentItem.tag, currentItem.runs)}

            {/* Over & Ball */}
            <span className="font-mono font-bold text-amber-400 text-[11px] shrink-0">
              {currentItem.ballNumber} ov:
            </span>

            {/* Players involved */}
            <span className="text-slate-300 font-semibold text-[11px] shrink-0">
              {currentItem.bowlerName} to {currentItem.batsmanName} —
            </span>

            {/* Commentary text preview */}
            <span className="text-slate-200 text-xs truncate group-hover:text-blue-300">
              {currentItem.commentary}
            </span>
          </div>
        </div>

        {/* Ticker Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Pause / Resume Ticker */}
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isPaused ? 'Resume Ticker' : 'Pause Ticker'}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
          </button>

          {/* Expand Full Event Log Drawer */}
          <button
            onClick={() => setIsExpanded(true)}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:bg-slate-800 transition-colors flex items-center gap-0.5"
            title="Expand Full Commentary Log"
          >
            <span>Log</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. EXPANDED FULL COMMENTARY DRAWER / MODAL */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-950 h-full flex flex-col border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    Commentary Feed
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Ball-by-ball text event log ({items.length} balls polled)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Close Commentary Feed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Balls ({items.length})
              </button>
              <button
                onClick={() => setFilterType('wickets')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'wickets'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-rose-400/80 hover:text-rose-300'
                }`}
              >
                <span>Wickets</span>
                <span className="text-[10px] bg-black/30 px-1 rounded-full">
                  {items.filter((i) => i.isWicket).length}
                </span>
              </button>
              <button
                onClick={() => setFilterType('boundaries')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'boundaries'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 text-purple-400/80 hover:text-purple-300'
                }`}
              >
                <span>Boundaries</span>
                <span className="text-[10px] bg-black/30 px-1 rounded-full">
                  {items.filter((i) => i.isFour || i.isSix).length}
                </span>
              </button>
              <button
                onClick={() => setFilterType('milestones')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  filterType === 'milestones'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <span>Milestones</span>
                <span className="text-[10px] bg-black/30 px-1 rounded-full">
                  {items.filter((i) => i.isMilestone).length}
                </span>
              </button>
            </div>

            {/* Commentary Event Log Scroll View */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  No events found for the selected filter.
                </div>
              ) : (
                filteredItems.map((item, idx) => (
                  <div
                    key={item.id || `ball-${idx}`}
                    className={`p-3 rounded-xl border transition-all ${
                      item.isWicket
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : item.isSix
                        ? 'bg-purple-950/20 border-purple-500/40'
                        : item.isFour
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : item.isMilestone
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    {/* Event Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-400 text-xs bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {item.ballNumber}
                        </span>
                        {renderTagBadge(item.tag, item.runs)}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Match & Ball Participants */}
                    <div className="pt-2 text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>
                        <strong className="text-white">{item.bowlerName}</strong> to{' '}
                        <strong className="text-white">{item.batsmanName}</strong>
                      </span>
                      {item.teamScore && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {item.teamScore}
                        </span>
                      )}
                    </div>

                    {/* Commentary Text */}
                    <p className="mt-1.5 text-xs text-slate-200 leading-relaxed font-sans">
                      {item.commentary}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer with sync info */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                Auto-polled every 3.5s
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-bold transition-all text-xs"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
