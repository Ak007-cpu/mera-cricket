import React, { useMemo, useState, useEffect } from 'react';
import { BallEvent, BowlerScore } from '../../types/cricket';
import { Crosshair, Target } from 'lucide-react';

export type DeliveryLengthType = 'good' | 'full' | 'bouncer';

interface PitchMapProps {
  recentBalls: BallEvent[];
  bowler?: BowlerScore;
  compact?: boolean;
}

interface PlottedDelivery {
  ball: BallEvent;
  sequenceIndex: number; // 1 = latest delivery
  lengthType: DeliveryLengthType;
  lengthLabel: string;
  lineLabel: string;
  svgX: number; // Mapped inside pitch box x: 64..356
  svgY: number; // Mapped inside pitch box y: 34..156
  outcomeLabel: string;
}

const LENGTH_META: Record<
  DeliveryLengthType,
  { label: string; shortLabel: string; color: string; bgClass: string; textClass: string; borderClass: string }
> = {
  bouncer: {
    label: 'Bouncer / Short',
    shortLabel: 'Bouncer',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/40'
  },
  good: {
    label: 'Good / Length',
    shortLabel: 'Good/Length',
    color: '#38bdf8',
    bgClass: 'bg-sky-500/15',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-400/40'
  },
  full: {
    label: 'Full / Yorker',
    shortLabel: 'Full',
    color: '#10b981',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-400/40'
  }
};

function deterministicHash(seedStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function classifyDelivery(ball: BallEvent, idx: number): {
  lengthType: DeliveryLengthType;
  normX: number; // 0..100 across pitch length (0 = short/bowler side, 100 = stumps/yorker)
  normY: number; // 0..100 across width (0 = wide off, 50 = middle stump, 100 = leg)
} {
  const comment = (ball.commentary || '').toLowerCase();
  const seed = `${ball.id || ''}-${ball.ballNumber || ''}-${ball.overNumber}-${ball.ballInOver}-${ball.runs}-${idx}`;
  const hashA = deterministicHash(seed);
  const hashB = deterministicHash(`${seed}-lat`);
  const jitterX = (hashA % 100) / 100; // 0..1
  const jitterY = (hashB % 100) / 100; // 0..1

  let lengthType: DeliveryLengthType | undefined = ball.pitchLength;

  if (!lengthType) {
    if (/(bouncer|short|pull|hook|duck|rib|shoulder|chin|upper cut|back of a length|dug in|riser)/i.test(comment)) {
      lengthType = 'bouncer';
    } else if (/(yorker|full|half-volley|half volley|overpitch|drive|driven|toe|toes|low full|sweep|pitching up|tossed up|flight)/i.test(comment)) {
      lengthType = 'full';
    } else if (/(good length|length ball|on a length|defend|block|leave|left alone|edg|lbw|channel|off stump|seam)/i.test(comment)) {
      lengthType = 'good';
    } else {
      // Cricket-realistic heuristic fallback from ball outcome & deterministic signature
      if (ball.isSix && hashA % 2 === 0) {
        lengthType = 'bouncer';
      } else if (ball.isFour && (hashA % 3 === 0 || ball.runs === 4)) {
        lengthType = hashA % 4 === 0 ? 'good' : 'full';
      } else if (ball.isWicket) {
        lengthType = hashA % 3 === 0 ? 'full' : hashA % 3 === 1 ? 'good' : 'bouncer';
      } else {
        const mod = hashA % 10;
        if (mod < 5) lengthType = 'good'; // Good length is most common (~50%)
        else if (mod < 8) lengthType = 'full'; // Full (~30%)
        else lengthType = 'bouncer'; // Bouncer/short (~20%)
      }
    }
  }

  let normX = ball.pitchX;
  if (typeof normX !== 'number' || Number.isNaN(normX)) {
    if (lengthType === 'bouncer') {
      normX = 12 + jitterX * 22; // 12..34% (short / bouncer zone)
    } else if (lengthType === 'good') {
      normX = 40 + jitterX * 28; // 40..68% (good length zone)
    } else {
      normX = 73 + jitterX * 22; // 73..95% (full / yorker zone)
    }
  }

  let normY = ball.pitchY;
  if (typeof normY !== 'number' || Number.isNaN(normY)) {
    if (ball.extraType === 'wide') {
      normY = hashB % 2 === 0 ? 12 + jitterY * 10 : 78 + jitterY * 10;
    } else if (/(outside off|wide off|cover|point|cut|slip|third man)/i.test(comment)) {
      normY = 20 + jitterY * 22; // Off side corridor
    } else if (/(leg|flick|glance|pad|fine leg|mid-wicket|midwicket)/i.test(comment)) {
      normY = 56 + jitterY * 22; // Middle & leg
    } else {
      normY = 30 + jitterY * 36; // Stump-to-off corridor
    }
  }

  return {
    lengthType,
    normX: Math.max(4, Math.min(97, normX)),
    normY: Math.max(10, Math.min(90, normY))
  };
}

function getLineDescription(normY: number): string {
  if (normY < 32) return 'Outside Off';
  if (normY < 45) return 'Off Stump Line';
  if (normY <= 57) return 'Middle Stump';
  if (normY <= 70) return 'Leg Stump Line';
  return 'Down Leg';
}

function getOutcomeLabel(ball: BallEvent): string {
  if (ball.isWicket) return 'WICKET';
  if (ball.isSix) return '6 RUNS';
  if (ball.isFour) return '4 RUNS';
  if (ball.isExtra && ball.extraType === 'wide') return ball.runs > 1 ? `${ball.runs} WD` : 'WIDE';
  if (ball.isExtra && ball.extraType === 'no-ball') return ball.runs > 1 ? `${ball.runs} NB` : 'NO BALL';
  if (ball.runs === 0) return 'DOT';
  return `${ball.runs} RUN${ball.runs === 1 ? '' : 'S'}`;
}

export const PitchMap: React.FC<PitchMapProps> = ({ recentBalls, bowler, compact = false }) => {
  const [lengthFilter, setLengthFilter] = useState<'all' | DeliveryLengthType>('all');
  const [selectedBallId, setSelectedBallId] = useState<string | null>(null);

  const deliveries: PlottedDelivery[] = useMemo(() => {
    const lastSix = (recentBalls || []).slice(0, 6);
    // Map pitch region inside SVG (x: 44..352, y: 28..152)
    return lastSix.map((ball, idx) => {
      const { lengthType, normX, normY } = classifyDelivery(ball, idx);
      const svgX = 44 + (normX / 100) * 308;
      const svgY = 28 + (normY / 100) * 124;
      return {
        ball,
        sequenceIndex: idx + 1,
        lengthType,
        lengthLabel: LENGTH_META[lengthType].label,
        lineLabel: getLineDescription(normY),
        svgX,
        svgY,
        outcomeLabel: getOutcomeLabel(ball)
      };
    });
  }, [recentBalls]);

  const counts = useMemo(() => {
    const res = { good: 0, full: 0, bouncer: 0 };
    deliveries.forEach((d) => {
      res[d.lengthType] += 1;
    });
    return res;
  }, [deliveries]);

  useEffect(() => {
    if (deliveries.length === 0) {
      setSelectedBallId(null);
      return;
    }
    const stillPresent = deliveries.some((d) => (d.ball.id || `${d.sequenceIndex}`) === selectedBallId);
    if (!stillPresent) {
      setSelectedBallId(deliveries[0].ball.id || `${deliveries[0].sequenceIndex}`);
    }
  }, [deliveries, selectedBallId]);

  const activeDelivery = useMemo(() => {
    if (deliveries.length === 0) return null;
    const filtered =
      lengthFilter === 'all' ? deliveries : deliveries.filter((d) => d.lengthType === lengthFilter);
    const byId = deliveries.find((d) => (d.ball.id || `${d.sequenceIndex}`) === selectedBallId);
    if (byId && (lengthFilter === 'all' || byId.lengthType === lengthFilter)) {
      return byId;
    }
    return filtered[0] || deliveries[0];
  }, [deliveries, lengthFilter, selectedBallId]);

  return (
    <div className="bg-[#0a1329]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between h-full">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-300 shrink-0" />
            <h3 className="text-base font-black text-white tracking-tight truncate">
              Pitch Map
            </h3>
            <span className="text-sm font-score text-slate-300 whitespace-nowrap">
              · Last {deliveries.length || 6} Balls
            </span>
          </div>
          {bowler?.name && (
            <p className="text-sm text-slate-300 truncate mt-0.5">
              {bowler.name} · {bowler.wickets}/{bowler.runs} ({bowler.overs} ov)
            </p>
          )}
        </div>

        {/* Interactive Length Zone Filter Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-slate-800 text-sm">
          <button
            type="button"
            onClick={() => setLengthFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              lengthFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            All ({deliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setLengthFilter('good')}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              lengthFilter === 'good'
                ? 'bg-sky-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Good ({counts.good})
          </button>
          <button
            type="button"
            onClick={() => setLengthFilter('full')}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              lengthFilter === 'full'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Full ({counts.full})
          </button>
          <button
            type="button"
            onClick={() => setLengthFilter('bouncer')}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              lengthFilter === 'bouncer'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Bouncer ({counts.bouncer})
          </button>
        </div>
      </div>

      {/* Calibrated 22-Yard Cricket Pitch SVG */}
      <div className={`relative w-full mt-3 ${compact ? 'h-36 sm:h-40' : 'h-48 sm:h-52'}`}>
        {deliveries.length === 0 ? (
          <div className="w-full h-full rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col items-center justify-center text-center px-4">
            <Target className="w-6 h-6 text-slate-500 mb-1.5" />
            <p className="text-sm font-semibold text-slate-200">Awaiting deliveries for Pitch Map</p>
            <p className="text-sm text-slate-400 mt-0.5">
              Landing zones will plot automatically as balls are bowled.
            </p>
          </div>
        ) : (
          <svg
            viewBox="0 0 400 180"
            className="w-full h-full rounded-xl bg-[#040916] border border-slate-800/90 select-none"
            role="img"
            aria-label="Cricket pitch map showing landing positions of the last 6 deliveries"
          >
            <defs>
              <linearGradient id="pitchSurface" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1e293b" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#334155" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.45" />
              </linearGradient>
            </defs>

            {/* Outfield subtle grid */}
            <rect x="8" y="10" width="384" height="160" rx="10" fill="#060f23" stroke="#1e293b" strokeWidth="1" />

            {/* Pitch Strip */}
            <rect x="40" y="24" width="320" height="132" rx="4" fill="url(#pitchSurface)" stroke="#475569" strokeWidth="1" />

            {/* Zone 1: Bouncer / Short (x: 40..154) */}
            <rect
              x="40"
              y="24"
              width="114"
              height="132"
              fill="#f59e0b"
              fillOpacity={lengthFilter === 'bouncer' ? 0.16 : 0.06}
            />
            <text
              x="97"
              y="19"
              textAnchor="middle"
              fill="#fbbf24"
              fontSize="8"
              fontWeight="700"
              letterSpacing="0.8"
            >
              BOUNCER
            </text>

            {/* Zone 2: Good / Length (x: 154..262) */}
            <rect
              x="154"
              y="24"
              width="108"
              height="132"
              fill="#38bdf8"
              fillOpacity={lengthFilter === 'good' ? 0.16 : 0.06}
            />
            <text
              x="208"
              y="19"
              textAnchor="middle"
              fill="#7dd3fc"
              fontSize="8"
              fontWeight="700"
              letterSpacing="0.8"
            >
              GOOD / LENGTH
            </text>

            {/* Zone 3: Full / Yorker (x: 262..360) */}
            <rect
              x="262"
              y="24"
              width="98"
              height="132"
              fill="#10b981"
              fillOpacity={lengthFilter === 'full' ? 0.16 : 0.06}
            />
            <text
              x="311"
              y="19"
              textAnchor="middle"
              fill="#6ee7b7"
              fontSize="8"
              fontWeight="700"
              letterSpacing="0.8"
            >
              FULL / YORKER
            </text>

            {/* Zone Divider Lines */}
            <line x1="154" y1="24" x2="154" y2="156" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="262" y1="24" x2="262" y2="156" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />

            {/* Wide Guidelines & Stump Corridor Lines (Off / Middle / Leg) */}
            <line x1="40" y1="38" x2="360" y2="38" stroke="#64748b" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 3" />
            <line x1="40" y1="142" x2="360" y2="142" stroke="#64748b" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 3" />

            {/* Stump-to-Stump Corridor Band */}
            <rect x="40" y="76" width="320" height="28" fill="#ffffff" fillOpacity="0.03" />
            <line x1="40" y1="78" x2="360" y2="78" stroke="#94a3b8" strokeOpacity="0.28" strokeWidth="0.7" strokeDasharray="4 4" />
            <line x1="40" y1="90" x2="360" y2="90" stroke="#cbd5e1" strokeOpacity="0.32" strokeWidth="0.7" strokeDasharray="4 4" />
            <line x1="40" y1="102" x2="360" y2="102" stroke="#94a3b8" strokeOpacity="0.28" strokeWidth="0.7" strokeDasharray="4 4" />

            {/* Channel Labels on Left Margin */}
            <text x="24" y="54" textAnchor="middle" fill="#64748b" fontSize="7.5" fontWeight="600">
              OFF
            </text>
            <text x="24" y="93" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="700">
              MID
            </text>
            <text x="24" y="130" textAnchor="middle" fill="#64748b" fontSize="7.5" fontWeight="600">
              LEG
            </text>

            {/* Bowler Release Arrow (Left) */}
            <text x="48" y="168" fill="#64748b" fontSize="7.5" fontWeight="700" letterSpacing="0.5">
              BOWLER →
            </text>

            {/* Batting Popping Crease & Stumps (Right) */}
            <line x1="336" y1="24" x2="336" y2="156" stroke="#e2e8f0" strokeOpacity="0.75" strokeWidth="1.4" />
            <line x1="360" y1="24" x2="360" y2="156" stroke="#e2e8f0" strokeOpacity="0.55" strokeWidth="1.2" />
            {/* 3 Stumps at x=362 */}
            <circle cx="363" cy="79" r="2.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.8" />
            <circle cx="363" cy="90" r="2.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.8" />
            <circle cx="363" cy="101" r="2.5" fill="#fbbf24" stroke="#0f172a" strokeWidth="0.8" />
            <text x="348" y="168" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="700" letterSpacing="0.5">
              STUMPS
            </text>

            {/* Plotted Last 6 Deliveries */}
            {deliveries.map((item) => {
              const idKey = item.ball.id || `${item.sequenceIndex}`;
              const isSelected = activeDelivery?.ball.id
                ? activeDelivery.ball.id === item.ball.id
                : activeDelivery?.sequenceIndex === item.sequenceIndex;
              const matchesFilter = lengthFilter === 'all' || item.lengthType === lengthFilter;
              const opacity = matchesFilter ? 1 : 0.22;
              const meta = LENGTH_META[item.lengthType];
              const isLatest = item.sequenceIndex === 1;

              return (
                <g
                  key={idKey}
                  transform={`translate(${item.svgX}, ${item.svgY})`}
                  opacity={opacity}
                  className="cursor-pointer"
                  onClick={() => setSelectedBallId(idKey)}
                >
                  {/* Selection / Latest Ball Outer Halo */}
                  {(isSelected || isLatest) && (
                    <circle
                      r={isSelected ? 13.5 : 11.5}
                      fill="none"
                      stroke={item.ball.isWicket ? '#f43f5e' : '#ffffff'}
                      strokeOpacity={isSelected ? 0.9 : 0.4}
                      strokeWidth={isSelected ? 1.5 : 1}
                      strokeDasharray={isSelected ? undefined : '2 2'}
                    />
                  )}

                  {/* Wicket Outer Ring */}
                  {item.ball.isWicket && (
                    <circle r="11" fill="#e11d48" fillOpacity="0.28" stroke="#fb7185" strokeWidth="1.6" />
                  )}

                  {/* Distinct Marker Geometry by Length: Full=Diamond, Bouncer=Triangle, Good=Circle */}
                  {item.lengthType === 'full' ? (
                    <polygon
                      points="0,-9 9,0 0,9 -9,0"
                      fill={meta.color}
                      stroke="#030712"
                      strokeWidth="1.4"
                    />
                  ) : item.lengthType === 'bouncer' ? (
                    <polygon
                      points="0,-9.5 9,7.5 -9,7.5"
                      fill={meta.color}
                      stroke="#030712"
                      strokeWidth="1.4"
                    />
                  ) : (
                    <circle r="8.5" fill={meta.color} stroke="#030712" strokeWidth="1.4" />
                  )}

                  {/* Ball Sequence Number (1 = most recent) */}
                  <text
                    y={item.lengthType === 'bouncer' ? 4.2 : 3.2}
                    textAnchor="middle"
                    fill="#030712"
                    fontSize="8.5"
                    fontWeight="900"
                  >
                    {item.ball.isWicket ? 'W' : item.sequenceIndex}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Footer Legend + Selected Delivery Readout */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        {/* Shape + Color Legend */}
        <div className="flex items-center gap-3.5 text-slate-200 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" aria-hidden="true" />
            <span>Good</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-emerald-400 inline-block" aria-hidden="true" />
            <span>Full</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[9px] border-l-transparent border-r-transparent border-b-amber-400 inline-block" aria-hidden="true" />
            <span>Bouncer</span>
          </span>
        </div>

        {/* Active Ball Telemetry */}
        {activeDelivery && (
          <div className="flex items-center gap-1.5 font-score text-slate-100 truncate">
            <span className="text-slate-400">#{activeDelivery.sequenceIndex}</span>
            <span className="text-sky-300 font-bold">
              {activeDelivery.ball.ballNumber || `${activeDelivery.ball.overNumber}.${activeDelivery.ball.ballInOver}`}
            </span>
            <span aria-hidden="true">·</span>
            <span className={LENGTH_META[activeDelivery.lengthType].textClass}>
              {LENGTH_META[activeDelivery.lengthType].shortLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-200">{activeDelivery.lineLabel}</span>
            <span aria-hidden="true">·</span>
            <span className={activeDelivery.ball.isWicket ? 'text-rose-400 font-black' : 'text-white font-bold'}>
              {activeDelivery.outcomeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
