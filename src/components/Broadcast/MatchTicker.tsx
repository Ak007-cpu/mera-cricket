import React, { useMemo, useState } from 'react';
import { MatchState, NewsItem } from '../../types/cricket';
import { Pause, Play, Radio } from 'lucide-react';

interface MatchTickerProps {
  match: MatchState;
  newsItems?: NewsItem[];
  onOpenNews?: () => void;
}

interface TickerSegment {
  id: string;
  kind: 'breaking' | 'update' | 'score' | 'stat';
  tag: string;
  text: string;
}

export const MatchTicker: React.FC<MatchTickerProps> = ({ match, newsItems = [], onOpenNews }) => {
  const [isPaused, setIsPaused] = useState(false);

  const breakingOrPinnedNews = useMemo(
    () => newsItems.filter((item) => item.isBreaking || item.category === 'Breaking' || item.pinned),
    [newsItems]
  );

  const hasBreakingHeadline = useMemo(
    () => breakingOrPinnedNews.some((item) => item.isBreaking || item.category === 'Breaking'),
    [breakingOrPinnedNews]
  );

  const segments: TickerSegment[] = useMemo(() => {
    const list: TickerSegment[] = [];

    // 1. Prioritize Breaking & Pinned news headlines from Content Manager
    breakingOrPinnedNews.forEach((item) => {
      const desc = item.description?.trim();
      const shortDesc = desc && desc.length > 120 ? `${desc.slice(0, 117)}...` : desc;
      list.push({
        id: `news_${item.id}`,
        kind: item.isBreaking || item.category === 'Breaking' ? 'breaking' : 'update',
        tag: item.isBreaking || item.category === 'Breaking' ? 'Breaking' : 'Update',
        text: shortDesc ? `${item.title} — ${shortDesc}` : item.title
      });
    });

    // 2. Always include live match score feed segments
    const { battingTeam, bowlingTeam, striker, nonStriker, currentBowler, currentPartnership } = match;
    const batCode = battingTeam.shortName || battingTeam.code;
    const bowlCode = bowlingTeam.shortName || bowlingTeam.code;

    list.push({
      id: 'score_main',
      kind: 'score',
      tag: 'Score',
      text: `${batCode} ${battingTeam.score.runs}/${battingTeam.score.wickets} (${battingTeam.score.overs}.${battingTeam.score.balls} ov) · CRR ${match.currentRunRate.toFixed(2)}`
    });

    if (bowlingTeam.score.runs > 0 || bowlingTeam.score.overs > 0) {
      list.push({
        id: 'score_opp',
        kind: 'score',
        tag: bowlCode,
        text: `${bowlCode} ${bowlingTeam.score.runs}/${bowlingTeam.score.wickets} (${bowlingTeam.score.overs}.${bowlingTeam.score.balls} ov)`
      });
    }

    if (match.target && match.target > 0) {
      const chaseDetail =
        match.requiredRuns !== undefined && match.remainingBalls !== undefined
          ? ` · Need ${match.requiredRuns} off ${match.remainingBalls} balls`
          : '';
      list.push({
        id: 'score_target',
        kind: 'stat',
        tag: 'Chase',
        text: `Target ${match.target}${chaseDetail}`
      });
    }

    list.push({
      id: 'batters_live',
      kind: 'stat',
      tag: 'Batting',
      text: `${striker.shortName || striker.name}* ${striker.runs} (${striker.balls}b) · ${
        nonStriker.shortName || nonStriker.name
      } ${nonStriker.runs} (${nonStriker.balls}b)`
    });

    list.push({
      id: 'bowler_live',
      kind: 'stat',
      tag: 'Bowling',
      text: `${currentBowler.shortName || currentBowler.name} ${currentBowler.wickets}/${currentBowler.runs} (${currentBowler.overs} ov · Econ ${currentBowler.economy.toFixed(2)})`
    });

    if (currentPartnership && (currentPartnership.runs > 0 || currentPartnership.balls > 0)) {
      list.push({
        id: 'partnership_live',
        kind: 'stat',
        tag: 'Partnership',
        text: `${currentPartnership.runs} runs (${currentPartnership.balls} balls)`
      });
    }

    if (match.statusText?.trim()) {
      list.push({
        id: 'status_live',
        kind: 'update',
        tag: 'Match',
        text: match.statusText.trim()
      });
    } else if (match.toss?.trim()) {
      list.push({
        id: 'toss_live',
        kind: 'update',
        tag: 'Toss',
        text: match.toss.trim()
      });
    }

    return list;
  }, [breakingOrPinnedNews, match]);

  const renderTrack = (isDuplicate: boolean) => (
    <div
      className="flex items-center shrink-0"
      aria-hidden={isDuplicate ? 'true' : undefined}
    >
      {segments.map((seg) => {
        const isNews = seg.kind === 'breaking' || seg.kind === 'update';
        const tagColor =
          seg.kind === 'breaking'
            ? 'text-rose-600 dark:text-rose-400'
            : seg.kind === 'score'
            ? 'text-sky-700 dark:text-sky-300'
            : seg.kind === 'update'
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-emerald-700 dark:text-emerald-300';

        const content = (
          <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
            <span className={`font-bold uppercase tracking-wider text-xs ${tagColor}`}>
              {seg.tag}
            </span>
            <span className="font-score text-slate-900 dark:text-white font-medium">{seg.text}</span>
            <span className="text-slate-400 dark:text-slate-600 px-3" aria-hidden="true">
              ·
            </span>
          </span>
        );

        if (isNews && onOpenNews && !isDuplicate && seg.id.startsWith('news_')) {
          return (
            <a
              key={`${seg.id}_${isDuplicate ? 'dup' : 'main'}`}
              href="?page=news"
              onClick={(e) => {
                e.preventDefault();
                onOpenNews();
              }}
              className="hover:text-amber-700 dark:hover:text-amber-300 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {content}
            </a>
          );
        }

        return <React.Fragment key={`${seg.id}_${isDuplicate ? 'dup' : 'main'}`}>{content}</React.Fragment>;
      })}
    </div>
  );

  return (
    <section
      aria-label="Live Match & Breaking News Ticker"
      className="max-w-[1440px] mx-auto w-full shrink-0"
    >
      <div className="h-10 flex items-center overflow-hidden rounded-xl bg-white dark:bg-[#071127]/95 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 shadow-sm dark:shadow-lg">
        {/* Left Broadcast Cue */}
        <div
          className={`h-full px-3.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider shrink-0 border-r border-slate-300 dark:border-slate-700/80 ${
            hasBreakingHeadline
              ? 'bg-rose-600 text-white'
              : 'bg-slate-900 text-amber-300'
          }`}
        >
          <Radio className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">
            {hasBreakingHeadline ? 'Breaking' : 'Match Ticker'}
          </span>
        </div>

        {/* Continuous Horizontal Marquee Viewport */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white dark:from-[#071127] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white dark:from-[#071127] to-transparent z-10" />

          <div
            className={`flex w-max items-center animate-match-ticker ${
              isPaused ? 'ticker-paused' : ''
            }`}
          >
            {renderTrack(false)}
            {renderTrack(true)}
          </div>
        </div>

        {/* Accessible Pause / Resume Control */}
        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          aria-pressed={isPaused}
          aria-label={isPaused ? 'Resume match ticker' : 'Pause match ticker'}
          title={isPaused ? 'Resume ticker' : 'Pause ticker'}
          className="h-full px-3 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-l border-slate-300 dark:border-slate-700/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
    </section>
  );
};
