import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { MatchState } from '../../types/cricket';
import {
  recordOverSnapshot,
  buildOverProgression,
  getFormatMaxOvers,
  OverGraphPoint
} from '../../utils/matchAnalytics';
import { TrendingUp, Activity, Target, Flame, BarChart3 } from 'lucide-react';

interface RunRateProgressionChartProps {
  match: MatchState;
  compact?: boolean;
}

const renderWicketDot = (defaultColor: string) => (props: any) => {
  const { cx, cy, payload, index } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return <g key={`empty-${index}`} />;
  if (payload.isWicket) {
    return (
      <g key={`wkt-${index}`}>
        <circle cx={cx} cy={cy} r={8} fill="#ef4444" fillOpacity={0.3} />
        <circle cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1.75} />
      </g>
    );
  }
  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={defaultColor} stroke="#ffffff" strokeWidth={1} />;
};

export const RunRateProgressionChart: React.FC<RunRateProgressionChartProps> = ({ match, compact = false }) => {
  const [chartMode, setChartMode] = useState<'run_rate' | 'over_runs' | 'worm'>('run_rate');

  const { battingTeam, currentInnings, target, requiredRunRate, currentRunRate } = match;

  const maxOvers = useMemo(() => {
    const fmtMax = getFormatMaxOvers(match);
    if (fmtMax) return fmtMax;
    return Math.max(30, battingTeam.score.overs + 5);
  }, [match, battingTeam.score.overs]);

  const data: OverGraphPoint[] = useMemo(() => {
    const snapshots = recordOverSnapshot(match);
    return buildOverProgression(match, snapshots);
  }, [
    match.matchId,
    match.currentInnings,
    match.gameState,
    battingTeam.score.overs,
    battingTeam.score.balls,
    battingTeam.score.runs,
    battingTeam.score.wickets,
    currentRunRate,
    target,
    match.recentBalls,
    match.scorecards
  ]);

  // Projected score at current run rate
  const projectedScore = useMemo(() => {
    if (battingTeam.score.overs === 0 && battingTeam.score.balls === 0) return 0;
    return Math.round(currentRunRate * maxOvers);
  }, [currentRunRate, maxOvers, battingTeam.score.overs, battingTeam.score.balls]);

  const isChasing = currentInnings === 2 && Boolean(target && target > 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-[#0a1329]/90 border border-slate-700/80 rounded-2xl shadow-xl relative overflow-hidden backdrop-blur-md ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6 rounded-3xl'
      }`}
    >
      {/* Chart Header Bar */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 gap-2.5 ${
          compact ? 'pb-3' : 'pb-4 gap-3'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 text-amber-300 border border-slate-700">
            <TrendingUp className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-white uppercase tracking-wider">
                Run-Rate Progression
              </h4>
              <span className="text-sm font-score text-slate-300 font-bold">
                · {battingTeam.code}
              </span>
            </div>
            {!compact && (
              <p className="text-sm text-slate-300 mt-0.5">
                Live progression of Current Run Rate (CRR) and over-by-over momentum.
              </p>
            )}
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-sm">
          <button
            onClick={() => setChartMode('run_rate')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'run_rate'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>CRR</span>
          </button>
          <button
            onClick={() => setChartMode('worm')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'worm'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Worm</span>
          </button>
          <button
            onClick={() => setChartMode('over_runs')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              chartMode === 'over_runs'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Overs</span>
          </button>
        </div>
      </div>

      {/* Key Stats Metric Ticker */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 font-score text-xs">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block">Current Run Rate (CRR)</span>
            <span className="text-xl font-black text-sky-400 drop-shadow">
              {currentRunRate.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">rpo</span>
          </div>

          {isChasing && requiredRunRate !== undefined && requiredRunRate > 0 ? (
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/30">
              <span className="text-amber-400 text-[11px] block flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-400 inline" /> Required RR (RRR)
              </span>
              <span className="text-xl font-black text-amber-300">
                {requiredRunRate.toFixed(2)}
              </span>
              <span className="text-[10px] text-amber-500/80 block mt-0.5">Target: {target}</span>
            </div>
          ) : (
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                <Flame className="w-3 h-3 text-emerald-400 inline" /> Projected Score
              </span>
              <span className="text-xl font-black text-emerald-400">
                {projectedScore > 0 ? projectedScore : '—'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">at current CRR</span>
            </div>
          )}

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block">Overs Completed</span>
            <span className="text-xl font-black text-white">
              {battingTeam.score.overs}.{battingTeam.score.balls}
              <span className="text-xs text-slate-500 font-normal ml-1">/ {maxOvers}</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {Math.max(0, maxOvers * 6 - (battingTeam.score.overs * 6 + battingTeam.score.balls))} balls left
            </span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 text-[11px] block">Wickets in Hand</span>
            <span className="text-xl font-black text-amber-400">
              {10 - battingTeam.score.wickets}
              <span className="text-xs text-slate-500 font-normal ml-1">/ 10</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {battingTeam.score.wickets} fallen
            </span>
          </div>
        </div>
      )}

      {/* Main Recharts Progression Display */}
      <div className={`w-full mt-2 ${compact ? 'h-32 sm:h-36' : 'h-64 sm:h-72'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 16, left: -14, bottom: 2 }}
          >
            <defs>
              <linearGradient id="crrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="wormGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
            />

            {/* Left Y Axis for Run Rate or Worm Score */}
            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              domain={chartMode === 'worm' ? [0, 'auto'] : [0, 'auto']}
              label={
                chartMode === 'worm'
                  ? { value: 'Total Runs', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }
                  : { value: 'Run Rate (rpo)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }
              }
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as OverGraphPoint;
                return (
                  <div className="bg-slate-950/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[180px]">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-slate-300 font-bold">
                      <span className="text-white">Over {point.label}</span>
                      <span className="text-blue-400">{battingTeam.code}</span>
                    </div>

                    <div className="space-y-1 mt-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Score:</span>
                        <strong className="text-white font-bold">
                          {point.cumulativeRuns}/{point.cumulativeWickets}
                        </strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">CRR:</span>
                        <strong className="text-blue-400 font-bold">{point.crr.toFixed(2)}</strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">Runs in Over:</span>
                        <strong className="text-amber-400 font-bold">+{point.overRuns}</strong>
                      </div>

                      {point.rrr !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Required RR:</span>
                          <strong className="text-rose-400 font-bold">{point.rrr.toFixed(2)}</strong>
                        </div>
                      )}

                      {point.isWicket && (
                        <div className="pt-1 text-rose-400 font-bold text-[10px]">
                          ● {point.wicketDetails || 'Wicket fallen in this over'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }}
            />

            {/* Reference Line for Required Run Rate or Target Par Rate */}
            {isChasing && requiredRunRate && chartMode !== 'worm' && (
              <ReferenceLine
                y={requiredRunRate}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `RRR: ${requiredRunRate.toFixed(2)}`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
            )}

            {/* Run Rate Mode: Shows CRR curve + Over runs bars */}
            {chartMode === 'run_rate' && (
              <>
                <Bar
                  dataKey="overRuns"
                  name="Over Runs"
                  fill="#334155"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Area
                  type="monotone"
                  dataKey="crr"
                  name="Current Run Rate (CRR)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#crrGradient)"
                  dot={renderWicketDot('#3b82f6')}
                  activeDot={{ r: 6, fill: '#60a5fa', stroke: '#1e3a8a', strokeWidth: 2 }}
                />
                {isChasing && (
                  <Line
                    type="monotone"
                    dataKey="rrr"
                    name="Req Run Rate (RRR)"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </>
            )}

            {/* Worm Mode: Shows cumulative runs worm */}
            {chartMode === 'worm' && (
              <>
                <Area
                  type="monotone"
                  dataKey="cumulativeRuns"
                  name="Cumulative Runs"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#wormGradient)"
                  dot={renderWicketDot('#10b981')}
                  activeDot={{ r: 6, fill: '#34d399', stroke: '#064e3b', strokeWidth: 2 }}
                />
                {isChasing && target && (
                  <ReferenceLine
                    y={target}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Target: ${target}`,
                      fill: '#fbbf24',
                      fontSize: 10,
                      position: 'insideTopLeft'
                    }}
                  />
                )}
              </>
            )}

            {/* Over Runs Mode: Detailed breakdown of each individual over */}
            {chartMode === 'over_runs' && (
              <>
                <Bar
                  dataKey="overRuns"
                  name="Runs in Over"
                  fill="#3b82f6"
                  radius={[5, 5, 0, 0]}
                  barSize={20}
                />
                <Line
                  type="monotone"
                  dataKey="crr"
                  name="CRR"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
