import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { MatchState, WinProbabilityOverride } from '../../types/cricket';
import { calculateWinProbability } from '../../utils/matchAnalytics';
import { TeamFlag } from '../TeamFlag';
import { useTheme } from '../../context/ThemeContext';
import { Activity, TrendingUp } from 'lucide-react';

interface WinProbabilityGraphProps {
  match: MatchState;
  enabled?: boolean;
  override?: WinProbabilityOverride | null;
}

interface WinProbPoint {
  overLabel: string;
  overNum: number;
  battingWinProb: number;
  bowlingWinProb: number;
  crr: number;
  rrr: number;
  rateDelta: number;
  eventNote?: string;
}

function getFormatDefaults(matchType: MatchState['matchType'], currentOvers: number) {
  if (matchType === 'T10') return { totalOvers: 10, parRR: 9.5 };
  if (matchType === 'ODI') return { totalOvers: 50, parRR: 5.8 };
  if (matchType === 'TEST') return { totalOvers: Math.max(40, currentOvers + 15), parRR: 3.4 };
  return { totalOvers: 20, parRR: 8.4 };
}

function clampProb(val: number): number {
  return Math.max(2, Math.min(98, Math.round(val)));
}

export const WinProbabilityGraph: React.FC<WinProbabilityGraphProps> = ({
  match,
  enabled = true,
  override = null
}) => {
  const { isDark } = useTheme();
  const [showBothTeams, setShowBothTeams] = useState(true);

  const {
    battingTeam,
    bowlingTeam,
    currentInnings,
    target,
    currentRunRate,
    requiredRunRate,
    matchType,
    recentBalls,
    gameState,
    statusText
  } = match;

  const isChasing = currentInnings === 2 || Boolean(target && target > 0);

  const { points, liveBatProb, liveBowlProb, effectiveRRR, hasExplicitRRR } = useMemo(() => {
    const completedBalls = battingTeam.score.overs * 6 + battingTeam.score.balls;
    const completedOvers = completedBalls / 6;
    const { totalOvers, parRR } = getFormatDefaults(matchType, battingTeam.score.overs);
    const effectiveTotalOvers = match.dlsDetails?.revisedOvers || totalOvers;

    const rrrNow =
      isChasing && requiredRunRate !== undefined && requiredRunRate > 0
        ? requiredRunRate
        : isChasing && target && effectiveTotalOvers > completedOvers
        ? Number(((Math.max(0, target - battingTeam.score.runs)) / (effectiveTotalOvers - completedOvers)).toFixed(2))
        : parRR;

    // Collect wicket & boundary momentum signals per over from recentBalls
    const overMomentum = new Map<number, { wickets: number; boundaries: number }>();
    (recentBalls || []).forEach((b) => {
      const ov = Math.floor(b.overNumber);
      const prev = overMomentum.get(ov) || { wickets: 0, boundaries: 0 };
      if (b.isWicket) prev.wickets += 1;
      if (b.isSix || b.isFour) prev.boundaries += 1;
      overMomentum.set(ov, prev);
    });

    const maxPointOver = Math.max(1, Math.ceil(completedOvers));
    const data: WinProbPoint[] = [];

    // Over 0 baseline
    data.push({
      overLabel: '0',
      overNum: 0,
      battingWinProb: 50,
      bowlingWinProb: 50,
      crr: 0,
      rrr: Number(rrrNow.toFixed(2)),
      rateDelta: 0
    });

    let prevProb = 50;

    for (let ov = 1; ov <= maxPointOver; ov++) {
      const isFinalPoint = ov === maxPointOver;
      const frac = completedOvers > 0 ? Math.min(1, ov / completedOvers) : 1;

      const runsAtOv = isFinalPoint
        ? battingTeam.score.runs
        : Math.round(battingTeam.score.runs * frac);
      const wicketsAtOv = isFinalPoint
        ? battingTeam.score.wickets
        : Math.min(battingTeam.score.wickets, Math.round(battingTeam.score.wickets * frac));
      const oversAtOv = isFinalPoint ? Math.max(0.167, completedOvers) : ov;

      const crrAtOv = isFinalPoint
        ? currentRunRate
        : Number((runsAtOv / oversAtOv).toFixed(2));

      let rrrAtOv = parRR;
      if (isChasing && target && target > 0) {
        if (isFinalPoint && requiredRunRate !== undefined && requiredRunRate > 0) {
          rrrAtOv = requiredRunRate;
        } else {
          const remOvers = Math.max(0.5, effectiveTotalOvers - Math.min(effectiveTotalOvers - 0.5, oversAtOv));
          rrrAtOv = Number((Math.max(0, target - runsAtOv) / remOvers).toFixed(2));
        }
      }

      const rateDelta = Number((crrAtOv - rrrAtOv).toFixed(2));
      const wicketsRemainingFactor = ((10 - wicketsAtOv) / 10 - 0.65) * 28;
      const momentum = overMomentum.get(ov);
      const momentumShift =
        (momentum ? momentum.boundaries * 2.5 - momentum.wickets * 7.5 : 0);

      // Core Win Probability driven primarily by CRR vs RRR swing + wickets in hand
      const rateSwing = isChasing ? rateDelta * 7.5 : rateDelta * 5.8;
      let rawBatProb = 50 + rateSwing + wicketsRemainingFactor + momentumShift;

      // Smooth transitions so the curve tracks realistic game swing
      let smoothedBatProb = clampProb(prevProb * 0.28 + rawBatProb * 0.72);

      // Snap near 98/2 on finalized match outcomes
      if (isFinalPoint && (gameState === 'completed' || (isChasing && target && battingTeam.score.runs >= target))) {
        const statusLower = (statusText || '').toLowerCase();
        const batCode = (battingTeam.code || '').toLowerCase();
        const bowlCode = (bowlingTeam.code || '').toLowerCase();
        if (isChasing && target && battingTeam.score.runs >= target) {
          smoothedBatProb = 98;
        } else if (statusLower.includes(battingTeam.name.toLowerCase()) || (batCode && statusLower.includes(batCode))) {
          smoothedBatProb = 98;
        } else if (statusLower.includes(bowlingTeam.name.toLowerCase()) || (bowlCode && statusLower.includes(bowlCode))) {
          smoothedBatProb = 2;
        }
      }

      prevProb = smoothedBatProb;

      let eventNote: string | undefined;
      if (momentum?.wickets) eventNote = `${momentum.wickets} Wicket${momentum.wickets > 1 ? 's' : ''}`;
      else if (momentum?.boundaries) eventNote = `${momentum.boundaries} Boundary hit${momentum.boundaries > 1 ? 's' : ''}`;

      data.push({
        overLabel: isFinalPoint && battingTeam.score.balls > 0
          ? `${battingTeam.score.overs}.${battingTeam.score.balls}`
          : String(ov),
        overNum: isFinalPoint ? Number(completedOvers.toFixed(1)) : ov,
        battingWinProb: smoothedBatProb,
        bowlingWinProb: 100 - smoothedBatProb,
        crr: Number(crrAtOv.toFixed(2)),
        rrr: Number(rrrAtOv.toFixed(2)),
        rateDelta,
        eventNote
      });
    }

    const latest = data[data.length - 1];
    return {
      points: data,
      liveBatProb: latest.battingWinProb,
      liveBowlProb: latest.bowlingWinProb,
      effectiveRRR: rrrNow,
      hasExplicitRRR: isChasing
    };
  }, [
    battingTeam,
    bowlingTeam,
    matchType,
    match.dlsDetails?.revisedOvers,
    isChasing,
    target,
    currentRunRate,
    requiredRunRate,
    recentBalls,
    gameState,
    statusText
  ]);

  const probSummary = useMemo(
    () => calculateWinProbability(match, override),
    [match, override]
  );

  if (!enabled || !probSummary) {
    return null;
  }

  const displayBatProb = override?.enabled ? probSummary.battingPct : liveBatProb;
  const displayBowlProb = override?.enabled ? probSummary.bowlingPct : liveBowlProb;

  const rateDiff = Number((currentRunRate - effectiveRRR).toFixed(2));
  const rateDiffPositive = rateDiff >= 0;

  return (
    <section
      aria-label="Win Probability Graph"
      className="bg-white dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 shadow-sm dark:shadow-xl space-y-2.5 h-full flex flex-col justify-between"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
            <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight">
              Win Probability
            </h3>
            <span className="text-xs sm:text-sm font-score text-slate-600 dark:text-slate-300 whitespace-nowrap">
              · {hasExplicitRRR ? 'CRR vs RRR' : 'CRR vs Par'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-score">
            CRR <strong className="text-sky-700 dark:text-sky-300">{currentRunRate.toFixed(2)}</strong>
            {' · '}
            {hasExplicitRRR ? 'RRR' : 'Par'}{' '}
            <strong className="text-amber-700 dark:text-amber-300">{effectiveRRR.toFixed(2)}</strong>
            {' · '}
            Delta{' '}
            <strong className={rateDiffPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'}>
              {rateDiffPositive ? `+${rateDiff.toFixed(2)}` : rateDiff.toFixed(2)}
            </strong>
          </p>
        </div>

        {/* Toggle Chart Series */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowBothTeams(true)}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              showBothTeams
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            Both
          </button>
          <button
            type="button"
            onClick={() => setShowBothTeams(false)}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              !showBothTeams
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {battingTeam.shortName || battingTeam.code}
          </button>
        </div>
      </div>

      {/* Live Probability Split Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-bold">
          <div className="flex items-center gap-2">
            <TeamFlag
              teamName={battingTeam.name}
              teamCode={battingTeam.code}
              logoUrl={battingTeam.logoUrl}
              size="xs"
            />
            <span className="text-slate-950 dark:text-white">{battingTeam.shortName || battingTeam.code}</span>
            <span className="font-score text-base font-black text-sky-700 dark:text-sky-300">{displayBatProb}%</span>
          </div>

          <span className="text-sm font-score text-slate-600 dark:text-slate-300 hidden xl:inline">
            50% EVEN BALANCE
          </span>

          <div className="flex items-center gap-2">
            <span className="font-score text-base font-black text-amber-700 dark:text-amber-300">{displayBowlProb}%</span>
            <span className="text-slate-900 dark:text-slate-100">{bowlingTeam.shortName || bowlingTeam.code}</span>
            <TeamFlag
              teamName={bowlingTeam.name}
              teamCode={bowlingTeam.code}
              logoUrl={bowlingTeam.logoUrl}
              size="xs"
            />
          </div>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          <div
            className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-500"
            style={{ width: `${displayBatProb}%` }}
          />
          <div
            className="h-full bg-amber-500 dark:bg-amber-400 transition-all duration-500"
            style={{ width: `${displayBowlProb}%` }}
          />
        </div>
      </div>

      {/* Dynamic Recharts Line Chart */}
      <div className="w-full flex-1 min-h-[175px] sm:min-h-[205px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, left: -16, bottom: 2 }}>
            <CartesianGrid stroke={isDark ? '#1e293b' : '#cbd5e1'} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="overLabel"
              stroke={isDark ? '#64748b' : '#475569'}
              tick={{ fill: isDark ? '#94a3b8' : '#334155', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: isDark ? '#334155' : '#94a3b8' }}
              label={{
                value: 'Overs',
                position: 'insideBottomRight',
                offset: -2,
                fill: isDark ? '#64748b' : '#475569',
                fontSize: 10
              }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke={isDark ? '#64748b' : '#475569'}
              tick={{ fill: isDark ? '#94a3b8' : '#334155', fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={50}
              stroke={isDark ? '#475569' : '#94a3b8'}
              strokeDasharray="4 4"
              label={{
                value: '50%',
                position: 'insideTopRight',
                fill: isDark ? '#64748b' : '#475569',
                fontSize: 10
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload as WinProbPoint;
                return (
                  <div className="bg-white dark:bg-[#050c1d]/95 border border-slate-300 dark:border-sky-400/35 rounded-xl px-3 py-2 shadow-2xl text-xs space-y-1">
                    <div className="font-score font-bold text-slate-950 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1">
                      Over {d.overLabel}
                      {d.eventNote ? ` · ${d.eventNote}` : ''}
                    </div>
                    <div className="flex items-center justify-between gap-4 font-score">
                      <span className="text-sky-700 dark:text-sky-300">{battingTeam.shortName || battingTeam.code} Win:</span>
                      <span className="font-black text-slate-950 dark:text-white">{d.battingWinProb}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 font-score">
                      <span className="text-amber-700 dark:text-amber-300">{bowlingTeam.shortName || bowlingTeam.code} Win:</span>
                      <span className="font-black text-slate-950 dark:text-white">{d.bowlingWinProb}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[11px] font-score text-slate-600 dark:text-slate-300 pt-0.5 border-t border-slate-200 dark:border-slate-800/80">
                      <span>CRR {d.crr.toFixed(2)}</span>
                      <span>
                        {hasExplicitRRR ? 'RRR' : 'Par'} {d.rrr.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="battingWinProb"
              name={`${battingTeam.shortName || battingTeam.code} Win %`}
              stroke={isDark ? '#38bdf8' : '#0284c7'}
              strokeWidth={2.5}
              dot={{ r: 3, fill: isDark ? '#38bdf8' : '#0284c7', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#ffffff', stroke: isDark ? '#38bdf8' : '#0284c7', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {showBothTeams && (
              <Line
                type="monotone"
                dataKey="bowlingWinProb"
                name={`${bowlingTeam.shortName || bowlingTeam.code} Win %`}
                stroke={isDark ? '#fbbf24' : '#d97706'}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: '#ffffff', stroke: isDark ? '#fbbf24' : '#d97706', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-0.5 bg-sky-600 dark:bg-sky-400 inline-block" aria-hidden="true" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">{battingTeam.name}</span>
          </span>
          {showBothTeams && (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 border-t-2 border-dashed border-amber-600 dark:border-amber-400 inline-block" aria-hidden="true" />
              <span className="text-slate-900 dark:text-slate-100 font-medium">{bowlingTeam.name}</span>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 font-score text-slate-700 dark:text-slate-300">
          <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Dynamic Live Swing</span>
        </span>
      </div>
    </section>
  );
};
