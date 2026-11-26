import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { MatchState } from '../../types/cricket';
import {
  recordOverSnapshot,
  buildOverProgression,
  OverGraphPoint
} from '../../utils/matchAnalytics';
import { TrendingUp } from 'lucide-react';

interface CompactRunRateGraphProps {
  match: MatchState | null | undefined;
  variant?: 'broadcast' | 'obs';
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: OverGraphPoint;
  strokeColor: string;
  totalPoints: number;
}

const WicketAwareDot: React.FC<CustomDotProps> = ({
  cx,
  cy,
  payload,
  strokeColor,
  totalPoints
}) => {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null;

  if (payload.isWicket) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7.5} fill="#ef4444" fillOpacity={0.28} />
        <circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth={1.75}
        />
      </g>
    );
  }

  if (totalPoints > 25) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={2.5}
      fill={strokeColor}
      stroke="#091227"
      strokeWidth={1}
    />
  );
};

export const CompactRunRateGraph: React.FC<CompactRunRateGraphProps> = ({
  match,
  variant = 'broadcast'
}) => {
  const [metric, setMetric] = useState<'crr' | 'score'>('crr');

  const points = useMemo(() => {
    if (!match) return [];
    const snapshots = recordOverSnapshot(match);
    return buildOverProgression(match, snapshots);
  }, [
    match?.matchId,
    match?.currentInnings,
    match?.gameState,
    match?.battingTeam?.score?.runs,
    match?.battingTeam?.score?.wickets,
    match?.battingTeam?.score?.overs,
    match?.battingTeam?.score?.balls,
    match?.currentRunRate,
    match?.target,
    match?.recentBalls,
    match?.scorecards
  ]);

  if (!match || points.length === 0) return null;

  const isObs = variant === 'obs';
  const strokeColor = metric === 'crr' ? '#38bdf8' : '#10b981';
  const latest = points[points.length - 1];
  const wicketCount = points.reduce((sum, p) => sum + p.wicketsInOver, 0);

  return (
    <section
      aria-label="Run Rate Graph"
      className={
        isObs
          ? 'max-w-5xl mx-auto w-full bg-[#050c1d]/95 border border-sky-400/30 rounded-xl px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]'
          : 'bg-[#0a1329]/80 backdrop-blur-md border border-sky-400/20 rounded-2xl p-3.5 sm:p-4 shadow-xl'
      }
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
            {metric === 'crr' ? 'Run Rate Progression' : 'Score Progression'}
          </h3>
          <span className="font-score text-[11px] font-bold text-sky-300">
            {metric === 'crr'
              ? `CRR ${latest.crr.toFixed(2)}`
              : `${latest.cumulativeRuns}/${latest.cumulativeWickets}`}
          </span>
          {wicketCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 border border-white inline-block" />
              <span>Wicket</span>
            </span>
          )}
        </div>

        {/* Toggle Run Rate / Score */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setMetric('crr')}
            className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
              metric === 'crr' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Run Rate
          </button>
          <button
            type="button"
            onClick={() => setMetric('score')}
            className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
              metric === 'score' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Score
          </button>
        </div>
      </div>

      {/* Compact Line Chart */}
      <div className={isObs ? 'w-full h-24' : 'w-full h-36 sm:h-44'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={10}
              fontFamily="monospace"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              fontFamily="monospace"
              tickLine={false}
              domain={[0, 'auto']}
            />
            {!isObs && (
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0].payload as OverGraphPoint;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700/80 px-3 py-2 rounded-xl shadow-2xl text-[11px] font-mono space-y-0.5">
                      <div className="font-bold text-white border-b border-slate-800 pb-1">
                        Over {pt.label}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Score:</span>
                        <strong className="text-white">
                          {pt.cumulativeRuns}/{pt.cumulativeWickets}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Run Rate:</span>
                        <strong className="text-sky-300">{pt.crr.toFixed(2)}</strong>
                      </div>
                      {pt.isWicket && (
                        <div className="text-rose-400 font-bold pt-0.5">
                          ● {pt.wicketDetails || 'Wicket'}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey={metric === 'crr' ? 'crr' : 'cumulativeRuns'}
              stroke={strokeColor}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={(props: any) => (
                <WicketAwareDot
                  key={`dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  payload={props.payload}
                  strokeColor={strokeColor}
                  totalPoints={points.length}
                />
              )}
              activeDot={{ r: 5, fill: strokeColor, stroke: '#ffffff', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
