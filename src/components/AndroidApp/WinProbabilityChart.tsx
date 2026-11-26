import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { MatchState, BallEvent } from '../../types/cricket';
import { TeamFlag } from '../TeamFlag';
import {
  TrendingUp,
  Activity,
  Flame,
  AlertCircle,
  Sparkles,
  Zap,
  Info,
  Maximize2
} from 'lucide-react';

interface WinProbabilityChartProps {
  match: MatchState | null;
  className?: string;
}

interface OverDataPoint {
  over: number;
  ballFormatted: string;
  battingWinProb: number; // 0 to 100
  bowlingWinProb: number; // 0 to 100
  excitement: number; // 0 to 100
  runsAtOver: number;
  wicketsAtOver: number;
  runRate: number;
  eventDescription?: string;
  eventType?: 'wicket' | 'six' | 'four' | 'maiden' | 'normal';
}

export const WinProbabilityChart: React.FC<WinProbabilityChartProps> = ({
  match,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'win_prob' | 'excitement' | 'combined'>('combined');
  const [hoveredPoint, setHoveredPoint] = useState<OverDataPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Compute total overs for this match type (T20 = 20, ODI = 50, Test = 20 for session view)
  const maxOvers = useMemo(() => {
    if (!match) return 20;
    if (match.matchType === 'ODI') return 50;
    if (match.matchType === 'TEST') return 30;
    return 20; // Default T20 / standard
  }, [match?.matchType]);

  const batTeam = match?.battingTeam;
  const bowlTeam = match?.bowlingTeam;

  // Generate real-time historical over progression from CREX live data and scoreboard
  const chartData: OverDataPoint[] = useMemo(() => {
    if (!match || !batTeam) return [];

    const currentCompletedOvers = batTeam.score.overs + batTeam.score.balls / 6;
    const currentTotalRuns = batTeam.score.runs;
    const currentWickets = batTeam.score.wickets;
    const isSecondInnings = match.currentInnings === 2 || Boolean(match.target);
    const target = match.target || (isSecondInnings ? currentTotalRuns + 30 : 185);

    // Extract events from recent balls
    const recentBalls: BallEvent[] = match.recentBalls || [];
    const wicketOvers = new Set<number>();
    const sixOvers = new Set<number>();
    const fourOvers = new Set<number>();

    recentBalls.forEach((b) => {
      const ov = Math.floor(b.overNumber);
      if (b.isWicket) wicketOvers.add(ov);
      if (b.isSix) sixOvers.add(ov);
      if (b.isFour) fourOvers.add(ov);
    });

    const points: OverDataPoint[] = [];

    // Base probabilities at Over 0
    let prevRuns = 0;
    let prevWickets = 0;
    let prevBatProb = 50;

    const totalSteps = Math.max(1, Math.min(maxOvers, Math.ceil(currentCompletedOvers) + 1));

    for (let ov = 0; ov <= totalSteps; ov++) {
      const progress = ov / Math.max(1, currentCompletedOvers);
      const isPast = ov <= currentCompletedOvers;

      let runsAtOv: number;
      let wicketsAtOv: number;

      if (ov === 0) {
        runsAtOv = 0;
        wicketsAtOv = 0;
      } else if (isPast) {
        // Interpolate realistically up to current score
        runsAtOv = Math.round((currentTotalRuns / Math.max(0.1, currentCompletedOvers)) * ov);
        wicketsAtOv = Math.min(
          currentWickets,
          Math.floor((currentWickets / Math.max(0.1, currentCompletedOvers)) * ov)
        );
      } else {
        // Project future trajectory
        const rrr = match.requiredRunRate || match.currentRunRate || 8.5;
        runsAtOv = Math.round(currentTotalRuns + rrr * (ov - currentCompletedOvers));
        wicketsAtOv = currentWickets;
      }

      // Event classification
      let eventType: 'wicket' | 'six' | 'four' | 'maiden' | 'normal' = 'normal';
      let eventDesc: string | undefined;

      if (wicketOvers.has(ov)) {
        eventType = 'wicket';
        eventDesc = `🚨 Wicket fell in over ${ov}! Critical breakthrough`;
      } else if (sixOvers.has(ov)) {
        eventType = 'six';
        eventDesc = `🔥 Maximum Six (6) struck in over ${ov}!`;
      } else if (fourOvers.has(ov)) {
        eventType = 'four';
        eventDesc = `⚡ Boundary Four (4) in over ${ov}!`;
      }

      // Win Probability calculation using Duckworth-Lewis / CREX leverage model
      let batWinProb = 50;
      if (ov === 0) {
        batWinProb = 50;
      } else if (isSecondInnings) {
        const remainingRuns = Math.max(0, target - runsAtOv);
        const remainingBalls = Math.max(1, (maxOvers - ov) * 6);
        const requiredRR = (remainingRuns / remainingBalls) * 6;
        const wicketsLeft = 10 - wicketsAtOv;

        // Win prob decreases if RRR is high or wickets lost
        const wicketFactor = (wicketsLeft / 10) * 45;
        const rateFactor = Math.max(-45, Math.min(45, (10 - requiredRR) * 5));
        batWinProb = Math.max(3, Math.min(97, Math.round(50 + rateFactor * 0.6 + (wicketFactor - 22))));
      } else {
        // 1st innings projection vs par of 175 (T20)
        const parScoreAtOver = (target / maxOvers) * ov;
        const diff = runsAtOv - parScoreAtOver;
        const wicketsLostPenalty = wicketsAtOv * 5.5;
        batWinProb = Math.max(10, Math.min(90, Math.round(50 + diff * 1.2 - wicketsLostPenalty)));
      }

      // Smooth slightly with previous point for realism
      if (ov > 0) {
        if (eventType === 'wicket') {
          // Sharp downward momentum on wicket
          batWinProb = Math.max(5, batWinProb - 12);
        } else if (eventType === 'six') {
          // Momentum surge on six
          batWinProb = Math.min(95, batWinProb + 7);
        }
        batWinProb = Math.round(prevBatProb * 0.25 + batWinProb * 0.75);
      }
      prevBatProb = batWinProb;

      // Excitement Index Calculation (0 to 100%)
      // 1. Closeness to 50% = maximum tension
      const closenessFactor = (1 - Math.abs(batWinProb - 50) / 50) * 40; // up to 40 pts
      // 2. High leverage events
      let eventBonus = 0;
      if (eventType === 'wicket') eventBonus = 35;
      else if (eventType === 'six') eventBonus = 25;
      else if (eventType === 'four') eventBonus = 18;

      // 3. Late innings pressure
      const lateGameFactor = (ov / maxOvers) * 20;

      const excitement = Math.min(
        98,
        Math.max(15, Math.round(20 + closenessFactor + eventBonus + lateGameFactor))
      );

      points.push({
        over: ov,
        ballFormatted: `Over ${ov}.0`,
        battingWinProb: batWinProb,
        bowlingWinProb: 100 - batWinProb,
        excitement,
        runsAtOver: runsAtOv,
        wicketsAtOver: wicketsAtOv,
        runRate: ov > 0 ? Number((runsAtOv / ov).toFixed(2)) : 0,
        eventDescription: eventDesc,
        eventType
      });
    }

    return points;
  }, [match, batTeam, maxOvers]);

  // Current live win probability
  const currentWinProb = useMemo(() => {
    if (chartData.length === 0) return { bat: 50, bowl: 50, excitement: 50 };
    const last = chartData[chartData.length - 1];
    return {
      bat: last.battingWinProb,
      bowl: last.bowlingWinProb,
      excitement: last.excitement
    };
  }, [chartData]);

  // SVG Chart Layout Dimensions
  const width = 380;
  const height = 190;
  const margin = { top: 22, right: 16, bottom: 26, left: 32 };

  // D3 Scales & Paths
  const { xScale, yScale, winProbPath, bowlWinProbPath, excitementPath, battingAreaPath } =
    useMemo(() => {
      const xScale = d3
        .scaleLinear()
        .domain([0, maxOvers])
        .range([margin.left, width - margin.right]);

      const yScale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([height - margin.bottom, margin.top]);

      // Batting Win Prob line generator (smooth monotone curve)
      const winLine = d3
        .line<OverDataPoint>()
        .x((d) => xScale(d.over))
        .y((d) => yScale(d.battingWinProb))
        .curve(d3.curveMonotoneX);

      // Bowling Win Prob line generator
      const bowlLine = d3
        .line<OverDataPoint>()
        .x((d) => xScale(d.over))
        .y((d) => yScale(d.bowlingWinProb))
        .curve(d3.curveMonotoneX);

      // Excitement line generator
      const exciteLine = d3
        .line<OverDataPoint>()
        .x((d) => xScale(d.over))
        .y((d) => yScale(d.excitement))
        .curve(d3.curveMonotoneX);

      // Area under batting win probability curve
      const battingArea = d3
        .area<OverDataPoint>()
        .x((d) => xScale(d.over))
        .y0(yScale(0))
        .y1((d) => yScale(d.battingWinProb))
        .curve(d3.curveMonotoneX);

      return {
        xScale,
        yScale,
        winProbPath: winLine(chartData) || '',
        bowlWinProbPath: bowlLine(chartData) || '',
        excitementPath: exciteLine(chartData) || '',
        battingAreaPath: battingArea(chartData) || ''
      };
    }, [chartData, maxOvers, width, height, margin]);

  // Handle interactive pointer scrub over SVG
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleXRatio = width / rect.width;
    const svgX = clientX * scaleXRatio;

    // Find closest data point
    const clampedOver = Math.max(0, Math.min(maxOvers, xScale.invert(svgX)));
    let closest = chartData[0];
    let minDiff = Infinity;
    chartData.forEach((pt) => {
      const diff = Math.abs(pt.over - clampedOver);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    });
    setHoveredPoint(closest);
  };

  const handlePointerLeave = () => {
    setHoveredPoint(null);
  };

  const activeDisplayPoint = hoveredPoint || chartData[chartData.length - 1];

  // Team primary styling colors
  const batColor = '#3b82f6'; // Blue
  const bowlColor = '#ef4444'; // Rose / Red
  const exciteColor = '#f59e0b'; // Amber / Gold

  return (
    <div
      className={`bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 rounded-2xl p-3.5 border border-slate-800 shadow-md space-y-3 ${className}`}
    >
      {/* Top Header & View Modes */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Win Probability & Excitement
              </h4>
              <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                D3 CREX
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Real-time match win probability and leverage excitement trend
            </p>
          </div>
        </div>

        {/* View Mode Toggle Pill */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
          <button
            onClick={() => setViewMode('win_prob')}
            className={`px-2 py-0.5 rounded transition-all ${
              viewMode === 'win_prob' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Win %
          </button>
          <button
            onClick={() => setViewMode('excitement')}
            className={`px-2 py-0.5 rounded transition-all ${
              viewMode === 'excitement' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Drama
          </button>
          <button
            onClick={() => setViewMode('combined')}
            className={`px-2 py-0.5 rounded transition-all ${
              viewMode === 'combined' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Both
          </button>
        </div>
      </div>

      {/* Live Win % Bar Comparison */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5">
            {batTeam && <TeamFlag teamName={batTeam.name} teamCode={batTeam.code} size="xs" />}
            <span className="text-white text-xs">
              {batTeam?.code || 'Batting'}{' '}
              <span className="text-blue-400 font-mono font-extrabold">
                {currentWinProb.bat}%
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-mono text-[11px] font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              {currentWinProb.excitement}% Drama
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 text-xs">
              <span className="text-rose-400 font-mono font-extrabold">
                {currentWinProb.bowl}%
              </span>{' '}
              {bowlTeam?.code || 'Bowling'}
            </span>
            {bowlTeam && <TeamFlag teamName={bowlTeam.name} teamCode={bowlTeam.code} size="xs" />}
          </div>
        </div>

        {/* Dual Split Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-700"
            style={{ width: `${currentWinProb.bat}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-700"
            style={{ width: `${currentWinProb.bowl}%` }}
          />
        </div>
      </div>

      {/* D3 SVG Interactive Chart Viewport */}
      <div className="relative bg-slate-950/80 rounded-xl border border-slate-800/80 p-1 overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Area gradient for batting team */}
            <linearGradient id="batAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            {/* Excitement line glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines: 25%, 50%, 75% */}
          {[25, 50, 75].map((lvl) => (
            <line
              key={lvl}
              x1={margin.left}
              y1={yScale(lvl)}
              x2={width - margin.right}
              y2={yScale(lvl)}
              stroke={lvl === 50 ? '#64748b' : '#334155'}
              strokeDasharray={lvl === 50 ? '3 3' : '2 4'}
              strokeWidth={lvl === 50 ? 1 : 0.6}
            />
          ))}

          {/* 50% Equilibrium Label */}
          <text
            x={margin.left + 4}
            y={yScale(50) - 3}
            fill="#64748b"
            fontSize="8"
            fontFamily="monospace"
          >
            50% EQUILIBRIUM
          </text>

          {/* Y Axis percentage labels */}
          <text
            x={margin.left - 6}
            y={yScale(100) + 4}
            fill="#94a3b8"
            fontSize="8"
            textAnchor="end"
            fontFamily="monospace"
          >
            100%
          </text>
          <text
            x={margin.left - 6}
            y={yScale(50) + 3}
            fill="#64748b"
            fontSize="8"
            textAnchor="end"
            fontFamily="monospace"
          >
            50%
          </text>
          <text
            x={margin.left - 6}
            y={yScale(0)}
            fill="#94a3b8"
            fontSize="8"
            textAnchor="end"
            fontFamily="monospace"
          >
            0%
          </text>

          {/* X Axis overs tick labels */}
          {[0, Math.round(maxOvers / 4), Math.round(maxOvers / 2), Math.round((3 * maxOvers) / 4), maxOvers].map(
            (ov) => (
              <text
                key={ov}
                x={xScale(ov)}
                y={height - margin.bottom + 14}
                fill="#64748b"
                fontSize="8"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {ov} ov
              </text>
            )
          )}

          {/* Batting Win % Area Fill */}
          {(viewMode === 'win_prob' || viewMode === 'combined') && (
            <path d={battingAreaPath} fill="url(#batAreaGrad)" />
          )}

          {/* Bowling Win % Line (subtle red curve) */}
          {(viewMode === 'win_prob' || viewMode === 'combined') && (
            <path
              d={bowlWinProbPath}
              fill="none"
              stroke={bowlColor}
              strokeWidth="1.2"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          )}

          {/* Batting Win % Curve (Solid Blue) */}
          {(viewMode === 'win_prob' || viewMode === 'combined') && (
            <path
              d={winProbPath}
              fill="none"
              stroke={batColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}

          {/* Match Excitement Index Curve (Amber Neon Curve) */}
          {(viewMode === 'excitement' || viewMode === 'combined') && (
            <path
              d={excitementPath}
              fill="none"
              stroke={exciteColor}
              strokeWidth="2"
              filter="url(#glow)"
              strokeDasharray={viewMode === 'combined' ? '4 2' : undefined}
            />
          )}

          {/* Event Glyphs Plotted on Curve (Wickets, Sixes, Fours) */}
          {chartData.map((pt) => {
            if (pt.eventType === 'wicket') {
              return (
                <g key={`w-${pt.over}`} transform={`translate(${xScale(pt.over)}, ${yScale(pt.battingWinProb)})`}>
                  <circle r="5" fill="#e11d48" opacity="0.4" className="animate-ping" />
                  <circle r="3.5" fill="#e11d48" stroke="#ffffff" strokeWidth="1" />
                </g>
              );
            }
            if (pt.eventType === 'six') {
              return (
                <g key={`s-${pt.over}`} transform={`translate(${xScale(pt.over)}, ${yScale(pt.battingWinProb)})`}>
                  <circle r="3" fill="#a855f7" stroke="#ffffff" strokeWidth="0.8" />
                </g>
              );
            }
            if (pt.eventType === 'four') {
              return (
                <g key={`f-${pt.over}`} transform={`translate(${xScale(pt.over)}, ${yScale(pt.battingWinProb)})`}>
                  <circle r="2.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="0.6" />
                </g>
              );
            }
            return null;
          })}

          {/* Interactive Scrub / Hover Crosshair Guide */}
          {activeDisplayPoint && (
            <g>
              <line
                x1={xScale(activeDisplayPoint.over)}
                y1={margin.top}
                x2={xScale(activeDisplayPoint.over)}
                y2={height - margin.bottom}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={xScale(activeDisplayPoint.over)}
                y={yScale(activeDisplayPoint.battingWinProb)}
                r="4.5"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {(viewMode === 'excitement' || viewMode === 'combined') && (
                <circle
                  cx={xScale(activeDisplayPoint.over)}
                  y={yScale(activeDisplayPoint.excitement)}
                  r="3.5"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              )}
            </g>
          )}
        </svg>

        {/* Live Hover Scrub Tooltip Card */}
        {activeDisplayPoint && (
          <div className="absolute top-2 right-2 bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 shadow-lg text-[10px] space-y-0.5 pointer-events-none z-10 max-w-[170px]">
            <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-0.5">
              <span>{activeDisplayPoint.ballFormatted}</span>
              <span className="font-mono text-emerald-400">
                {activeDisplayPoint.runsAtOver}/{activeDisplayPoint.wicketsAtOver}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-blue-400 font-bold">{batTeam?.code || 'Bat'}:</span>
              <span className="font-mono font-bold">{activeDisplayPoint.battingWinProb}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-rose-400 font-bold">{bowlTeam?.code || 'Bowl'}:</span>
              <span className="font-mono font-bold">{activeDisplayPoint.bowlingWinProb}%</span>
            </div>
            <div className="flex items-center justify-between text-amber-300 font-bold">
              <span>Excitement:</span>
              <span className="font-mono">{activeDisplayPoint.excitement}%</span>
            </div>
            {activeDisplayPoint.eventDescription && (
              <div className="text-[9px] text-amber-300 font-medium pt-0.5 line-clamp-1 border-t border-slate-800/60">
                {activeDisplayPoint.eventDescription}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend & Event Key */}
      <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 bg-blue-500 rounded-full inline-block" />
            {batTeam?.code || 'Batting'} Win %
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 bg-amber-500 rounded-full inline-block" />
            Excitement Pulse
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="flex items-center gap-0.5 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Wicket
          </span>
          <span className="flex items-center gap-0.5 text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> 6s
          </span>
          <span className="flex items-center gap-0.5 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> 4s
          </span>
        </div>
      </div>
    </div>
  );
};
