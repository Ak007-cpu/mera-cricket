import React from 'react';
import { MatchState } from '../../types/cricket';
import { ActiveAutoBallEvent } from '../../hooks/useAutoBallAnimation';

interface LiveAnimatedMatchCardProps {
  match: MatchState;
  activeBallEvent: ActiveAutoBallEvent | null;
  animationsEnabled: boolean;
  battingColor: string;
  bowlingColor: string;
  compact?: boolean;
  topTv?: boolean;
  isVoiceSpeaking?: boolean;
}

function getShortPlayerTag(shortName?: string, fullName?: string): string {
  const s = (shortName || '').trim();
  if (s && s.length <= 14) return s;
  const f = (fullName || '').trim();
  if (!f) return '';
  const parts = f.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 13);
  return `${parts[0][0]}. ${parts[parts.length - 1]}`.slice(0, 14);
}

function extractDismissedBatterName(event: ActiveAutoBallEvent | null, fallbackName: string): string {
  if (!event || event.type !== 'wicket') return '';
  const raw = (event.subline || '').split('•')[0]?.trim();
  if (!raw) return fallbackName;
  // Strip score suffix like "45 (32b)" if present
  return raw.replace(/\s+\d+\s*\(\d+b\)\s*$/i, '').trim() || fallbackName;
}

export const LiveAnimatedMatchCard: React.FC<LiveAnimatedMatchCardProps> = ({
  match,
  activeBallEvent,
  animationsEnabled,
  battingColor,
  bowlingColor,
  compact = false,
  topTv = false,
  isVoiceSpeaking = false
}) => {
  const { battingTeam, striker, nonStriker, currentBowler, recentBalls } = match;
  const isLive = match.gameState === 'live';

  // Ensure bowler & fielder jersey always contrasts visibly against batting jersey
  const resolvedBowlingColor =
    bowlingColor.toLowerCase() === battingColor.toLowerCase() ? '#38bdf8' : bowlingColor;

  const evType = animationsEnabled && activeBallEvent ? activeBallEvent.type : null;
  const isDelivery = evType !== null;
  const shouldIdle = animationsEnabled && !isDelivery;

  const isOddRun = evType === 'single' || evType === 'three';
  const isTwoRuns = evType === 'two';
  const isRunScoring = isOddRun || isTwoRuns;
  const isBoundary = evType === 'four' || evType === 'six';
  const isDot = evType === 'dot';
  const isWicket = evType === 'wicket';
  const isWide = evType === 'wide';
  const isNoBall = evType === 'no-ball';
  const isBye = evType === 'bye' || evType === 'leg-bye';

  const bowlerTag = getShortPlayerTag(currentBowler.shortName, currentBowler.name);
  const strikerTag = getShortPlayerTag(striker.shortName, striker.name);
  const dismissedName = extractDismissedBatterName(activeBallEvent, strikerTag || striker.name);

  const bowlerGroupClass = isDelivery ? 'card-bowler-run' : shouldIdle ? 'card-idle-bowler' : '';
  const bowlerArmClass = isDelivery ? 'card-bowler-arm' : shouldIdle ? 'card-idle-bowler-arm' : '';

  const strikerRunnerClass = isOddRun
    ? 'card-runner-odd-a'
    : isTwoRuns
    ? 'card-runner-two-a'
    : isWicket
    ? 'card-batter-walkoff'
    : shouldIdle
    ? 'card-idle-batter'
    : '';
  const nonStrikerRunnerClass = isOddRun
    ? 'card-runner-odd-b'
    : isTwoRuns
    ? 'card-runner-two-b'
    : shouldIdle
    ? 'card-idle-nonstriker'
    : '';
  const batterHeadClass = isWicket ? 'card-head-bow' : '';
  const batActionClass = isDot
    ? 'card-batter-defend'
    : isRunScoring || isBoundary || isBye
    ? 'card-batter-swing'
    : shouldIdle
    ? 'card-idle-bat'
    : '';

  const fielderAClass = isRunScoring || isBoundary ? 'card-fielder-chase-a' : shouldIdle ? 'card-idle-fielder-a' : '';
  const fielderBClass = isRunScoring || isBoundary ? 'card-fielder-chase-b' : shouldIdle ? 'card-idle-fielder-b' : '';
  const fielderCClass = isRunScoring || isBoundary ? 'card-fielder-chase-c' : shouldIdle ? 'card-idle-fielder-c' : '';

  const ballAnimClass = isDot
    ? 'card-ball-dot'
    : isRunScoring || isBye
    ? 'card-ball-run'
    : evType === 'four'
    ? 'card-ball-four'
    : evType === 'six'
    ? 'card-ball-six'
    : isWicket
    ? 'card-ball-wicket'
    : isWide || isNoBall
    ? 'card-ball-wide'
    : '';

  const flashConfig =
    evType === 'four'
      ? {
          bg: 'rgba(37, 99, 235, 0.52)',
          bigBadge: '4',
          label: 'FOUR!',
          sub: strikerTag ? `${strikerTag} smashes 4 runs` : 'Boundary 4 Runs',
          accent: 'text-white border-blue-300 bg-blue-600/95 shadow-[0_0_24px_rgba(37,99,235,0.75)]'
        }
      : evType === 'six'
      ? {
          bg: 'rgba(245, 158, 11, 0.55)',
          bigBadge: '6',
          label: 'SIX!',
          sub: strikerTag ? `${strikerTag} sends it flying!` : 'Maximum 6 Runs',
          accent: 'text-slate-950 border-amber-200 bg-amber-400/95 shadow-[0_0_26px_rgba(251,191,36,0.85)]'
        }
      : isWicket
      ? {
          bg: 'rgba(225, 29, 72, 0.56)',
          bigBadge: 'W',
          label: 'WICKET DOWN!',
          sub: dismissedName ? `OUT: ${dismissedName}` : 'Batter Dismissed',
          accent: 'text-white border-rose-200 bg-rose-600/95 shadow-[0_0_26px_rgba(225,29,72,0.85)]'
        }
      : isWide
      ? {
          bg: '',
          bigBadge: 'WD',
          label: activeBallEvent?.headline || 'WIDE BALL!',
          sub: 'Extra Run + Re-bowl',
          accent: 'text-cyan-100 border-cyan-400/80 bg-cyan-950/90'
        }
      : isNoBall
      ? {
          bg: '',
          bigBadge: 'NB',
          label: activeBallEvent?.headline || 'NO BALL!',
          sub: 'Free Hit Coming Up',
          accent: 'text-orange-100 border-orange-400/80 bg-orange-950/90'
        }
      : isRunScoring
      ? {
          bg: '',
          bigBadge: evType === 'single' ? '1' : evType === 'two' ? '2' : '3',
          label: evType === 'single' ? '1 RUN' : evType === 'two' ? '2 RUNS' : '3 RUNS',
          sub: strikerTag ? `${strikerTag} runs hard` : 'Quick Running',
          accent: 'text-emerald-100 border-emerald-400/75 bg-emerald-950/90 shadow-[0_0_16px_rgba(16,185,129,0.4)]'
        }
      : isBye
      ? {
          bg: '',
          bigBadge: 'B',
          label: activeBallEvent?.headline || 'BYE RUN',
          sub: 'Extras Added',
          accent: 'text-slate-100 border-slate-400/70 bg-slate-900/90'
        }
      : isDot
      ? {
          bg: '',
          bigBadge: '0',
          label: 'DOT BALL',
          sub: bowlerTag ? `${bowlerTag} keeps it tight` : 'No Run',
          accent: 'text-slate-100 border-slate-500/75 bg-slate-900/90'
        }
      : null;

  // Persistent last-ball indicator shown calmly between deliveries
  const latestBall = recentBalls?.[0];
  const lastBallSummary = !flashConfig && latestBall
    ? latestBall.isWicket
      ? { text: 'WICKET DOWN', badgeClass: 'bg-rose-600/90 border-rose-300/70 text-white' }
      : latestBall.isSix
      ? { text: '6 • SIX', badgeClass: 'bg-amber-400/95 border-amber-200 text-slate-950' }
      : latestBall.isFour
      ? { text: '4 • FOUR', badgeClass: 'bg-blue-600/90 border-blue-300/70 text-white' }
      : latestBall.isExtra && latestBall.extraType === 'wide'
      ? { text: latestBall.runs > 1 ? `WIDE +${latestBall.runs}` : 'WIDE', badgeClass: 'bg-cyan-900/90 border-cyan-400/60 text-cyan-100' }
      : latestBall.isExtra && latestBall.extraType === 'no-ball'
      ? { text: latestBall.runs > 1 ? `NO BALL +${latestBall.runs}` : 'NO BALL', badgeClass: 'bg-orange-900/90 border-orange-400/60 text-orange-100' }
      : latestBall.runs === 0
      ? { text: 'DOT BALL', badgeClass: 'bg-slate-900/85 border-slate-600 text-slate-200' }
      : {
          text: `${latestBall.runs} ${latestBall.runs === 1 ? 'RUN' : 'RUNS'}`,
          badgeClass: 'bg-emerald-900/90 border-emerald-400/60 text-emerald-100'
        }
    : null;

  const animKey = activeBallEvent?.key ? `ev-${activeBallEvent.key}` : 'calm';

  return (
    <div
      className={`bg-[#0a1329]/92 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl flex flex-col justify-between h-full ${
        topTv ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'
      }`}
    >
      {/* Top Card Bar: Pulsing LIVE indicator + Voice Badge + Compact Mini Scoreboard */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 font-score text-[11px] font-black tracking-wider text-rose-300 shrink-0">
              <span
                className={`w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] ${
                  animationsEnabled ? 'animate-live-dot' : ''
                }`}
              />
              <span>LIVE TV</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 font-score text-[11px] font-bold uppercase tracking-wider text-slate-300 shrink-0">
              {match.gameState === 'innings_break'
                ? 'BREAK'
                : match.gameState === 'delayed'
                ? 'DELAYED'
                : match.gameState === 'completed'
                ? 'FINAL'
                : 'MATCH TV'}
            </span>
          )}
          <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
            Live Ground
          </span>
          {isVoiceSpeaking && (
            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-400/50 text-[10px] font-bold text-pink-200 animate-pulse shrink-0">
              VOICE
            </span>
          )}
        </div>

        {/* Mini Scoreboard: Team, Score, Overs */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 font-score tabular-nums text-xs shrink-0">
          <span className="font-extrabold text-slate-200">
            {battingTeam.shortName || battingTeam.code}
          </span>
          <span className="font-black text-amber-300">
            {battingTeam.score.runs}/{battingTeam.score.wickets}
          </span>
          <span className="text-slate-400 font-bold">
            ({battingTeam.score.overs}.{battingTeam.score.balls})
          </span>
        </div>
      </div>

      {/* TV Bezel Viewport containing Animated Cricket Field */}
      <div
        className={`relative mt-2 flex-1 rounded-xl border-2 border-[#0b101b] ring-1 ring-white/10 bg-[#071c10] shadow-[inset_0_0_26px_rgba(0,0,0,0.85)] overflow-hidden flex items-center justify-center ${
          topTv
            ? 'min-h-[270px] sm:min-h-[360px] lg:min-h-[450px] xl:min-h-[505px]'
            : compact
            ? 'min-h-[185px] sm:min-h-[215px] lg:min-h-[235px] max-h-[265px]'
            : 'min-h-[200px] sm:min-h-[230px] lg:min-h-[250px] max-h-[280px]'
        }`}
      >
        {/* Inside-Card Screen Flash Overlay for 4 / 6 / Wicket */}
        {flashConfig?.bg && (
          <div
            key={`flash-${animKey}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 card-flash-overlay"
            style={{ backgroundColor: flashConfig.bg }}
          />
        )}

        {/* Calm Last-Ball Score Pill in Corner between deliveries */}
        {lastBallSummary && (
          <div className="pointer-events-none absolute top-2 left-2 z-20 flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-score font-black tracking-wider shadow-md backdrop-blur-sm ${lastBallSummary.badgeClass}`}
            >
              {lastBallSummary.text}
            </span>
          </div>
        )}

        {/* Inside-Card Event Callout Banner (FOUR!, SIX!, WICKET! + Broken Stumps, 1/2/3 RUNS, etc.) */}
        {flashConfig && (
          <div
            key={`callout-${animKey}`}
            className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3 card-callout-pop"
          >
            <div
              className={`px-3.5 py-1.5 rounded-xl border backdrop-blur-md flex items-center gap-2.5 ${flashConfig.accent}`}
            >
              {isWicket ? (
                /* Broken Stumps Graphic right on Wicket Callout */
                <svg
                  width="26"
                  height="24"
                  viewBox="0 0 28 26"
                  aria-hidden="true"
                  className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                >
                  <rect x="4" y="5" width="3" height="17" rx="1" fill="#fef3c7" transform="rotate(-18 5.5 20)" />
                  <rect x="12.5" y="4" width="3" height="17" rx="1" fill="#fef3c7" transform="rotate(8 14 20)" />
                  <rect x="20" y="6" width="3" height="17" rx="1" fill="#fef3c7" transform="rotate(34 21.5 20)" />
                  <rect x="7" y="1" width="5" height="2" rx="0.8" fill="#fbbf24" transform="rotate(-28 9.5 2)" />
                  <rect x="17" y="2" width="5" height="2" rx="0.8" fill="#fbbf24" transform="rotate(30 19.5 3)" />
                </svg>
              ) : (
                <span className="w-7 h-7 rounded-lg bg-black/30 border border-white/25 font-score text-sm font-black flex items-center justify-center shrink-0">
                  {flashConfig.bigBadge}
                </span>
              )}
              <div className="text-left min-w-0">
                <div className="font-score text-sm sm:text-base font-black tracking-wider leading-none">
                  {flashConfig.label}
                </div>
                <div className="text-[10px] sm:text-[11px] font-bold opacity-90 leading-tight mt-0.5 truncate max-w-[190px]">
                  {flashConfig.sub}
                </div>
              </div>
            </div>
          </div>
        )}

        <svg
          viewBox="0 0 420 206"
          className={`w-full h-full block select-none ${topTv ? 'max-h-[500px]' : 'max-h-[255px]'}`}
          role="img"
          aria-label={`Animated live cricket view: ${battingTeam.shortName || battingTeam.code} ${battingTeam.score.runs}/${battingTeam.score.wickets}`}
        >
          <defs>
            <radialGradient id="cardTurfGrad" cx="50%" cy="50%" r="58%">
              <stop offset="0%" stopColor="#1f7a3f" />
              <stop offset="60%" stopColor="#145a2d" />
              <stop offset="100%" stopColor="#093419" />
            </radialGradient>
            <linearGradient id="cardPitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b58d5a" />
              <stop offset="50%" stopColor="#caa26e" />
              <stop offset="100%" stopColor="#b58d5a" />
            </linearGradient>
          </defs>

          {/* Green Outfield ("Hara Maidan") */}
          <rect x="0" y="0" width="420" height="206" fill="url(#cardTurfGrad)" />

          {/* Subtle Stadium Floodlight Glow Overlay */}
          <ellipse
            cx="210"
            cy="104"
            rx="168"
            ry="76"
            fill="rgba(74, 222, 128, 0.14)"
            className={shouldIdle ? 'card-idle-turf' : undefined}
            opacity="0.2"
          />

          {/* Subtle Mowed Grass Stripes */}
          <g opacity="0.1">
            <rect x="0" y="18" width="420" height="18" fill="#4ade80" />
            <rect x="0" y="54" width="420" height="18" fill="#4ade80" />
            <rect x="0" y="90" width="420" height="18" fill="#4ade80" />
            <rect x="0" y="126" width="420" height="18" fill="#4ade80" />
            <rect x="0" y="162" width="420" height="18" fill="#4ade80" />
          </g>

          {/* Boundary Rope */}
          <ellipse
            cx="210"
            cy="104"
            rx="194"
            ry="88"
            fill="none"
            stroke="rgba(255,255,255,0.58)"
            strokeWidth="2"
            strokeDasharray="7 5"
          />

          {/* 30-Yard Inner Circle */}
          <ellipse
            cx="210"
            cy="104"
            rx="126"
            ry="58"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* Center 22-Yard Pitch */}
          <rect
            x="126"
            y="88"
            width="168"
            height="32"
            rx="3"
            fill="url(#cardPitchGrad)"
            stroke="#8f6939"
            strokeWidth="1"
          />

          {/* Crease Markings */}
          <line x1="142" y1="88" x2="142" y2="120" stroke="#f8fafc" strokeWidth="1.3" opacity="0.88" />
          <line x1="134" y1="88" x2="134" y2="120" stroke="#f8fafc" strokeWidth="0.9" opacity="0.55" />
          <line x1="278" y1="88" x2="278" y2="120" stroke="#f8fafc" strokeWidth="1.3" opacity="0.88" />
          <line x1="286" y1="88" x2="286" y2="120" stroke="#f8fafc" strokeWidth="0.9" opacity="0.55" />

          {/* Bowler-End Stumps (Left) */}
          <g>
            <rect x="132.5" y="96" width="2" height="12" rx="0.5" fill="#fef3c7" />
            <rect x="135" y="97" width="2" height="12" rx="0.5" fill="#fef3c7" />
            <rect x="137.5" y="98" width="2" height="12" rx="0.5" fill="#fef3c7" />
            <line x1="132.5" y1="96.5" x2="139.5" y2="98" stroke="#f59e0b" strokeWidth="1.2" />
          </g>

          {/* Animated Layer Keyed per Delivery */}
          <g key={animKey}>
            {/* Striker-End Stumps (Right — scatter on WICKET!) */}
            <g>
              <g className={isWicket ? 'card-stump-l' : ''}>
                <rect x="284.5" y="96" width="2.2" height="12.5" rx="0.6" fill="#fef3c7" />
              </g>
              <g className={isWicket ? 'card-stump-m' : ''}>
                <rect x="287" y="97" width="2.2" height="12.5" rx="0.6" fill="#fef3c7" />
              </g>
              <g className={isWicket ? 'card-stump-r' : ''}>
                <rect x="289.5" y="98" width="2.2" height="12.5" rx="0.6" fill="#fef3c7" />
              </g>
              {!isWicket && (
                <line x1="284.5" y1="96.5" x2="291.5" y2="98" stroke="#f59e0b" strokeWidth="1.3" />
              )}
            </g>

            {/* Cartoon Fielder 1 (Top-Left Outfield) */}
            <g className={fielderAClass}>
              <g transform="translate(182, 42)">
                <ellipse cx="0" cy="11" rx="6" ry="2.2" fill="rgba(0,0,0,0.3)" />
                <line x1="-2" y1="5" x2="-2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <line x1="2" y1="5" x2="2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <rect x="-4" y="-3" width="8" height="9" rx="3" fill={resolvedBowlingColor} stroke="#0f172a" strokeWidth="0.7" />
                <circle cx="0" cy="-6.5" r="3.2" fill="#eab38c" stroke="#0f172a" strokeWidth="0.6" />
                <path d="M-3.5 -7.5 Q0 -11 3.5 -7.5 Z" fill={resolvedBowlingColor} />
              </g>
            </g>

            {/* Cartoon Fielder 2 (Top-Right Cover/Point) */}
            <g className={fielderBClass}>
              <g transform="translate(332, 54)">
                <ellipse cx="0" cy="11" rx="6" ry="2.2" fill="rgba(0,0,0,0.3)" />
                <line x1="-2" y1="5" x2="-2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <line x1="2" y1="5" x2="2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <rect x="-4" y="-3" width="8" height="9" rx="3" fill={resolvedBowlingColor} stroke="#0f172a" strokeWidth="0.7" />
                <circle cx="0" cy="-6.5" r="3.2" fill="#eab38c" stroke="#0f172a" strokeWidth="0.6" />
                <path d="M-3.5 -7.5 Q0 -11 3.5 -7.5 Z" fill={resolvedBowlingColor} />
              </g>
            </g>

            {/* Cartoon Fielder 3 (Bottom-Mid Long-On/Midwicket) */}
            <g className={fielderCClass}>
              <g transform="translate(248, 166)">
                <ellipse cx="0" cy="11" rx="6" ry="2.2" fill="rgba(0,0,0,0.3)" />
                <line x1="-2" y1="5" x2="-2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <line x1="2" y1="5" x2="2.5" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                <rect x="-4" y="-3" width="8" height="9" rx="3" fill={resolvedBowlingColor} stroke="#0f172a" strokeWidth="0.7" />
                <circle cx="0" cy="-6.5" r="3.2" fill="#eab38c" stroke="#0f172a" strokeWidth="0.6" />
                <path d="M-3.5 -7.5 Q0 -11 3.5 -7.5 Z" fill={resolvedBowlingColor} />
              </g>
            </g>

            {/* Cartoon Umpire (Behind Bowler Stumps) */}
            <g transform="translate(110, 86)">
              <ellipse cx="0" cy="12" rx="6" ry="2.2" fill="rgba(0,0,0,0.3)" />
              <line x1="-2" y1="6" x2="-2.5" y2="12" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="2" y1="6" x2="2.5" y2="12" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
              {/* Left Arm (Raises on Wide or No Ball) */}
              <g className={isWide ? 'card-umpire-wide-l' : isNoBall ? 'card-umpire-noball' : ''}>
                <line x1="-4" y1="-1" x2="-8.5" y2="3" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
              </g>
              {/* Right Arm (Raises on Wide) */}
              <g className={isWide ? 'card-umpire-wide-r' : ''}>
                <line x1="4" y1="-1" x2="8.5" y2="3" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
              </g>
              <rect x="-4.5" y="-3" width="9" height="10" rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.7" />
              <circle cx="0" cy="-6.5" r="3.2" fill="#eab38c" />
              {/* Classic Umpire Sun Hat */}
              <ellipse cx="0" cy="-9" rx="5.5" ry="1.8" fill="#f8fafc" />
              <rect x="-2.8" y="-11.5" width="5.6" height="2.8" rx="1" fill="#f8fafc" />
            </g>

            {/* Non-Striker Batsman (Batting Jersey + Helmet) */}
            <g className={nonStrikerRunnerClass}>
              <g transform="translate(148, 86)">
                <ellipse cx="0" cy="12" rx="6" ry="2.2" fill="rgba(0,0,0,0.32)" />
                <line x1="-2" y1="6" x2="-2.5" y2="12" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="2" y1="6" x2="2.5" y2="12" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
                <rect x="-4.5" y="-3" width="9" height="9.5" rx="3" fill={battingColor} stroke="#0f172a" strokeWidth="0.7" />
                {/* Bat */}
                <line x1="4" y1="1" x2="8" y2="10" stroke="#e2a856" strokeWidth="2.4" strokeLinecap="round" />
                {/* Helmet */}
                <circle cx="0" cy="-6.5" r="3.5" fill={battingColor} stroke="#e2e8f0" strokeWidth="0.7" />
                <rect x="0.8" y="-7.5" width="3" height="2" rx="0.6" fill="#0f172a" />
              </g>
            </g>

            {/* Cartoon Bowler (Bowling Jersey + Arm Action + Name Tag) */}
            <g className={bowlerGroupClass}>
              <g transform="translate(128, 108)">
                <ellipse cx="0" cy="13" rx="6.5" ry="2.3" fill="rgba(0,0,0,0.35)" />
                <line x1="-2.2" y1="6.5" x2="-3" y2="13" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="2.2" y1="6.5" x2="3" y2="13" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
                <rect x="-5" y="-3.5" width="10" height="10.5" rx="3" fill={resolvedBowlingColor} stroke="#0f172a" strokeWidth="0.8" />
                {/* Bowling Arm */}
                <g className={bowlerArmClass}>
                  <line x1="3.5" y1="-2" x2="7.5" y2="-9" stroke="#eab38c" strokeWidth="2.3" strokeLinecap="round" />
                </g>
                <circle cx="0" cy="-7" r="3.5" fill="#eab38c" stroke="#0f172a" strokeWidth="0.6" />
                <path d="M-3.8 -8 Q0 -11.5 3.8 -8 Z" fill={resolvedBowlingColor} />

                {/* Small Bowler Name Label */}
                {bowlerTag && (
                  <g transform="translate(0, 22)">
                    <rect x="-32" y="-7" width="64" height="12" rx="4" fill="rgba(2,6,23,0.82)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
                    <text
                      x="0"
                      y="1.5"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="7.8"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {bowlerTag}
                    </text>
                  </g>
                )}
              </g>
            </g>

            {/* Cartoon Striker Batsman (Batting Jersey + Helmet + Bat + Name Tag) */}
            <g className={strikerRunnerClass}>
              <g transform="translate(274, 106)">
                <ellipse cx="0" cy="13" rx="6.5" ry="2.3" fill="rgba(0,0,0,0.35)" />
                <line x1="-2.2" y1="6.5" x2="-3" y2="13" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
                <line x1="2.2" y1="6.5" x2="3" y2="13" stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
                <rect x="-5" y="-3.5" width="10" height="10.5" rx="3" fill={battingColor} stroke="#0f172a" strokeWidth="0.8" />
                {/* Animated Bat */}
                <g className={batActionClass}>
                  <line x1="-4" y1="1" x2="-10" y2="11" stroke="#e2a856" strokeWidth="2.9" strokeLinecap="round" />
                </g>
                {/* Helmeted Head (bows down on Wicket walk-off) */}
                <g className={batterHeadClass}>
                  <circle cx="0" cy="-7" r="3.7" fill={battingColor} stroke="#f8fafc" strokeWidth="0.8" />
                  <rect x="-3.8" y="-8" width="3" height="2" rx="0.6" fill="#0f172a" />
                </g>

                {/* Small Striker Name Label */}
                {strikerTag && (
                  <g transform="translate(0, 23)">
                    <rect x="-34" y="-7" width="68" height="12" rx="4" fill="rgba(2,6,23,0.85)" stroke="rgba(251,191,36,0.45)" strokeWidth="0.7" />
                    <text
                      x="0"
                      y="1.5"
                      textAnchor="middle"
                      fill="#fde68a"
                      fontSize="7.8"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {strikerTag}
                    </text>
                  </g>
                )}
              </g>
            </g>

            {/* Animated Cricket Ball (strictly visible during live delivery delta) */}
            {ballAnimClass && (
              <g className={ballAnimClass}>
                <circle
                  cx="0"
                  cy="0"
                  r="4.2"
                  fill="#f8fafc"
                  stroke="#dc2626"
                  strokeWidth="1.2"
                />
                <path d="M-2 -1.5 Q0 0 -2 1.5" fill="none" stroke="#dc2626" strokeWidth="0.9" />
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Bottom Compact Legend Row (Matches PitchMap footer balance) */}
      <div className="pt-2.5 mt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-300 font-score">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
            style={{ backgroundColor: battingColor }}
          />
          <span className="truncate font-bold text-slate-200">{strikerTag || 'Striker'}*</span>
        </div>
        <span className="text-slate-500 font-bold shrink-0">VS</span>
        <div className="flex items-center gap-2 min-w-0 truncate justify-end">
          <span className="truncate font-bold text-slate-200">{bowlerTag || 'Bowler'}</span>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
            style={{ backgroundColor: resolvedBowlingColor }}
          />
        </div>
      </div>
    </div>
  );
};
