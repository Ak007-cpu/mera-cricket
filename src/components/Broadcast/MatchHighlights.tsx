import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MatchHighlightItem, MatchHighlightType, MatchState } from '../../types/cricket';
import { fetchMatchHighlights } from '../../services/api';
import { ChevronLeft, ChevronRight, Clapperboard, Play, RotateCcw } from 'lucide-react';

interface MatchHighlightsProps {
  match: MatchState;
  isDemoPreview?: boolean;
  activeReplayId?: string | null;
  onReplayHighlight: (highlight: MatchHighlightItem) => void;
}

type HighlightFilter = 'all' | MatchHighlightType;

function extractLocalHighlights(match: MatchState): MatchHighlightItem[] {
  const list: MatchHighlightItem[] = [];
  const teamCode = match.battingTeam.shortName || match.battingTeam.code;
  const currentScore = `${teamCode} ${match.battingTeam.score.runs}/${match.battingTeam.score.wickets}`;

  for (const ball of match.recentBalls || []) {
    const type: MatchHighlightType | null = ball.isWicket
      ? 'wicket'
      : ball.isSix
      ? 'six'
      : ball.isFour
      ? 'four'
      : null;
    if (!type) continue;

    list.push({
      id: ball.id || `local-${match.matchId}-${type}-${ball.ballNumber}`,
      matchId: match.matchId,
      innings: match.currentInnings,
      type,
      ballNumber: ball.ballNumber || `${match.battingTeam.score.overs}.${match.battingTeam.score.balls}`,
      runs: ball.runs ?? (type === 'six' ? 6 : type === 'four' ? 4 : 0),
      batsmanName: ball.batsmanName || match.striker?.name || 'Batter',
      bowlerName: ball.bowlerName || match.currentBowler?.name || 'Bowler',
      wicketType: ball.wicketType,
      teamCode,
      teamScore: currentScore,
      commentary:
        ball.commentary ||
        (type === 'wicket'
          ? `Wicket! ${ball.batsmanName || 'Batter'} dismissed`
          : type === 'six'
          ? `Maximum SIX by ${ball.batsmanName || 'Batter'}`
          : `FOUR! ${ball.batsmanName || 'Batter'} finds the fence`),
      timestamp: ball.timestamp || match.lastUpdated || Date.now()
    });
  }

  const addFow = (
    innings: 1 | 2,
    fowList?: { score: number; wicketNumber: number; over: string; playerOut: string }[],
    scTeamCode?: string
  ) => {
    if (!Array.isArray(fowList)) return;
    for (const fow of fowList) {
      if (!fow.playerOut) continue;
      list.push({
        id: `local-fow-${match.matchId}-${innings}-${fow.wicketNumber}-${fow.over || 'ov'}`,
        matchId: match.matchId,
        innings,
        type: 'wicket',
        ballNumber: fow.over || '-',
        runs: 0,
        batsmanName: fow.playerOut,
        bowlerName: match.currentBowler?.shortName || match.currentBowler?.name || '',
        teamCode: scTeamCode || teamCode,
        teamScore: `${scTeamCode || teamCode} ${fow.score}/${fow.wicketNumber}`,
        commentary: `Wicket #${fow.wicketNumber}: ${fow.playerOut} out at ${fow.score}/${fow.wicketNumber}`,
        timestamp: match.lastUpdated || Date.now()
      });
    }
  };

  addFow(1, match.scorecards?.firstInnings?.fallOfWickets, match.scorecards?.firstInnings?.teamCode);
  addFow(2, match.scorecards?.secondInnings?.fallOfWickets, match.scorecards?.secondInnings?.teamCode);

  return list;
}

const HighlightThumbnailSvg: React.FC<{ type: MatchHighlightType }> = ({ type }) => {
  if (type === 'wicket') {
    return (
      <svg viewBox="0 0 180 76" className="w-full h-full block" aria-hidden="true">
        <defs>
          <radialGradient id="hlWicketBg" cx="50%" cy="55%" r="65%">
            <stop offset="0%" stopColor="#4c0519" />
            <stop offset="55%" stopColor="#143d24" />
            <stop offset="100%" stopColor="#07150e" />
          </radialGradient>
        </defs>
        <rect width="180" height="76" fill="url(#hlWicketBg)" />
        {/* Pitch strip */}
        <polygon points="62,76 118,76 104,22 76,22" fill="#b48a57" opacity="0.45" />
        {/* Crease line */}
        <line x1="66" y1="54" x2="114" y2="54" stroke="#f8fafc" strokeWidth="1.2" opacity="0.7" />
        {/* Shattered stumps */}
        <line x1="84" y1="54" x2="77" y2="33" stroke="#fde047" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="90" y1="54" x2="91" y2="31" stroke="#fde047" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="96" y1="54" x2="105" y2="36" stroke="#fde047" strokeWidth="2.4" strokeLinecap="round" />
        {/* Flying bails */}
        <line x1="76" y1="24" x2="84" y2="21" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
        <line x1="97" y1="22" x2="106" y2="26" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
        {/* Impact burst + ball */}
        <circle cx="91" cy="40" r="14" fill="#f43f5e" opacity="0.22" />
        <circle cx="114" cy="30" r="4" fill="#f8fafc" stroke="#e11d48" strokeWidth="1.2" />
      </svg>
    );
  }

  if (type === 'six') {
    return (
      <svg viewBox="0 0 180 76" className="w-full h-full block" aria-hidden="true">
        <defs>
          <radialGradient id="hlSixBg" cx="55%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="52%" stopColor="#14532d" />
            <stop offset="100%" stopColor="#061a10" />
          </radialGradient>
        </defs>
        <rect width="180" height="76" fill="url(#hlSixBg)" />
        {/* Stadium boundary arc */}
        <path d="M 10 64 Q 90 42 170 64" fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeDasharray="4 3" opacity="0.65" />
        {/* High lofted golden trajectory */}
        <path d="M 42 62 Q 96 4 148 22" fill="none" stroke="#fde047" strokeWidth="2.2" strokeDasharray="4 3" />
        {/* Starburst glow */}
        <circle cx="148" cy="22" r="13" fill="#fbbf24" opacity="0.25" />
        <circle cx="148" cy="22" r="4.8" fill="#ffffff" stroke="#f59e0b" strokeWidth="1.5" />
        {/* Mini bat impact flash */}
        <circle cx="42" cy="62" r="6" fill="#fde047" opacity="0.35" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 180 76" className="w-full h-full block" aria-hidden="true">
      <defs>
        <radialGradient id="hlFourBg" cx="50%" cy="60%" r="68%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="55%" stopColor="#14532d" />
          <stop offset="100%" stopColor="#071910" />
        </radialGradient>
      </defs>
      <rect width="180" height="76" fill="url(#hlFourBg)" />
      {/* Outfield boundary rope */}
      <path d="M 12 58 Q 90 70 168 58" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.75" />
      {/* Fast ground boundary trail */}
      <path d="M 38 40 Q 94 48 152 60" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="152" cy="60" r="11" fill="#3b82f6" opacity="0.28" />
      <circle cx="152" cy="60" r="4.4" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5" />
    </svg>
  );
};

export const MatchHighlights: React.FC<MatchHighlightsProps> = ({
  match,
  isDemoPreview = false,
  activeReplayId = null,
  onReplayHighlight
}) => {
  const [serverHighlights, setServerHighlights] = useState<MatchHighlightItem[]>([]);
  const [accumulatedLocal, setAccumulatedLocal] = useState<MatchHighlightItem[]>([]);
  const [filter, setFilter] = useState<HighlightFilter>('all');
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Reset accumulated highlights when switching to a different match
  useEffect(() => {
    setServerHighlights([]);
    setAccumulatedLocal([]);
  }, [match.matchId]);

  // Accumulate live/simulated key deliveries on the client so replay history persists during session
  useEffect(() => {
    const fresh = extractLocalHighlights(match);
    if (fresh.length === 0) return;

    setAccumulatedLocal((prev) => {
      const map = new Map<string, MatchHighlightItem>();
      for (const item of prev) {
        map.set(`${item.type}:${item.innings}:${item.ballNumber || item.id}`, item);
      }
      for (const item of fresh) {
        const key = `${item.type}:${item.innings}:${item.ballNumber || item.id}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
      return Array.from(map.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 60);
    });
  }, [
    match.matchId,
    match.currentInnings,
    match.lastUpdated,
    match.battingTeam.score.runs,
    match.battingTeam.score.wickets,
    match.recentBalls
  ]);

  // Fetch key events from /api/match/highlights whenever live match updates
  useEffect(() => {
    if (isDemoPreview) return;
    let cancelled = false;

    const load = async () => {
      const res = await fetchMatchHighlights(30);
      if (cancelled || !res || !Array.isArray(res.items)) return;
      if (res.matchId && res.matchId !== match.matchId) return;
      setServerHighlights(res.items);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [
    isDemoPreview,
    match.matchId,
    match.battingTeam.score.runs,
    match.battingTeam.score.wickets,
    match.battingTeam.score.overs,
    match.battingTeam.score.balls
  ]);

  const allHighlights = useMemo(() => {
    const map = new Map<string, MatchHighlightItem>();
    for (const item of serverHighlights) {
      map.set(`${item.type}:${item.innings}:${item.ballNumber || item.id}`, item);
    }
    for (const item of accumulatedLocal) {
      const key = `${item.type}:${item.innings}:${item.ballNumber || item.id}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [serverHighlights, accumulatedLocal]);

  const counts = useMemo(() => {
    let wicket = 0;
    let six = 0;
    let four = 0;
    for (const h of allHighlights) {
      if (h.type === 'wicket') wicket++;
      else if (h.type === 'six') six++;
      else if (h.type === 'four') four++;
    }
    return { all: allHighlights.length, wicket, six, four };
  }, [allHighlights]);

  const visibleHighlights = useMemo(() => {
    if (filter === 'all') return allHighlights;
    return allHighlights.filter((h) => h.type === filter);
  }, [allHighlights, filter]);

  const scrollStrip = (dir: 'left' | 'right') => {
    if (!stripRef.current) return;
    const offset = dir === 'left' ? -440 : 440;
    stripRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section
      aria-label="Match Highlights"
      className="bg-white/95 dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 shadow-md dark:shadow-xl space-y-3"
    >
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Clapperboard className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
          <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight">
            Match Highlights
          </h3>
          <span className="text-xs font-score text-slate-600 dark:text-slate-300 hidden sm:inline">
            · Click any clip to replay animation
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'wicket', label: `Wickets (${counts.wicket})` },
                { id: 'six', label: `Sixes (${counts.six})` },
                { id: 'four', label: `Fours (${counts.four})` }
              ] as { id: HighlightFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  filter === tab.id
                    ? tab.id === 'wicket'
                      ? 'bg-rose-600 text-white'
                      : tab.id === 'six'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : tab.id === 'four'
                      ? 'bg-blue-600 text-white'
                      : 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleHighlights.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollStrip('left')}
                aria-label="Scroll highlights left"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip('right')}
                aria-label="Scroll highlights right"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Clickable Highlight Thumbnail Cards */}
      {visibleHighlights.length > 0 ? (
        <div
          ref={stripRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-1 scroll-smooth"
        >
          {visibleHighlights.map((item) => {
            const isReplaying = activeReplayId === item.id;
            const theme =
              item.type === 'wicket'
                ? {
                    border: isReplaying
                      ? 'border-rose-400 ring-2 ring-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                      : 'border-rose-500/40 hover:border-rose-400',
                    badge: 'bg-rose-600 text-white',
                    label: 'WICKET'
                  }
                : item.type === 'six'
                ? {
                    border: isReplaying
                      ? 'border-amber-300 ring-2 ring-amber-300/60 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                      : 'border-amber-400/40 hover:border-amber-300',
                    badge: 'bg-amber-400 text-slate-950',
                    label: 'SIX!'
                  }
                : {
                    border: isReplaying
                      ? 'border-sky-400 ring-2 ring-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                      : 'border-blue-500/40 hover:border-sky-400',
                    badge: 'bg-blue-600 text-white',
                    label: 'FOUR!'
                  };

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onReplayHighlight(item)}
                title={`Replay ${theme.label}: ${item.batsmanName}${item.bowlerName ? ` vs ${item.bowlerName}` : ''} (${item.ballNumber} ov)`}
                className={`group w-[198px] sm:w-[214px] shrink-0 text-left rounded-xl bg-slate-50 dark:bg-[#060c1d] border transition-all overflow-hidden flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:focus-visible:ring-amber-300 ${theme.border}`}
              >
                {/* Thumbnail Preview */}
                <div className="relative w-full h-[80px] overflow-hidden border-b border-slate-200 dark:border-slate-800/90">
                  <HighlightThumbnailSvg type={item.type} />

                  {/* Event Label */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded font-score text-[10px] font-black tracking-wider shadow ${theme.badge}`}
                  >
                    {theme.label}
                  </span>

                  {/* Over Chip */}
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 border border-white/15 font-score text-[10px] font-bold text-slate-100">
                    {item.ballNumber} ov
                  </span>

                  {/* Replay Hover / Active Play Pill */}
                  <span
                    className={`absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-score text-[10px] font-bold border transition-transform ${
                      isReplaying
                        ? 'bg-emerald-500 text-slate-950 border-emerald-200 scale-105'
                        : 'bg-black/75 text-white border-white/25 group-hover:scale-105 group-hover:bg-white group-hover:text-slate-950'
                    }`}
                  >
                    {isReplaying ? (
                      <>
                        <RotateCcw className="w-3 h-3 animate-spin" />
                        <span>Replaying</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Replay</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Metadata Footer */}
                <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold text-slate-950 dark:text-white truncate">
                      {item.batsmanName}
                    </span>
                    {item.teamScore && (
                      <span className="text-[10px] font-score font-bold text-slate-600 dark:text-slate-400 shrink-0">
                        {item.teamScore}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                    {item.bowlerName ? `vs ${item.bowlerName}` : item.commentary}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800/80 px-4 py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-400 font-score">
          Key highlights (Wickets, Fours &amp; Sixes) will appear here as clickable clips once recorded in this match.
        </div>
      )}
    </section>
  );
};
