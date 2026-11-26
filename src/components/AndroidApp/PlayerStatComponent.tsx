import React from 'react';
import { MatchState } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';
import { Users, Zap, Target, Shield, ChevronRight, Activity, Flame } from 'lucide-react';

interface PlayerStatComponentProps {
  match: MatchState | null;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
  className?: string;
}

export const PlayerStatComponent: React.FC<PlayerStatComponentProps> = ({
  match,
  onSelectPlayer,
  className = ''
}) => {
  if (!match) {
    return null;
  }

  const { striker, nonStriker, currentBowler, currentPartnership, battingTeam, bowlingTeam } = match;

  // Strike rate helpers
  const getStrikeRateColor = (sr: number) => {
    if (sr >= 160) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (sr >= 130) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (sr >= 100) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-300 bg-slate-800 border-slate-700';
  };

  // Economy helpers
  const getEconomyColor = (econ: number) => {
    if (econ <= 6.0) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (econ <= 8.0) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (econ <= 10.0) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getEconomyLabel = (econ: number) => {
    if (econ <= 6.0) return 'Elite Econ';
    if (econ <= 8.0) return 'Disciplined';
    if (econ <= 10.0) return 'Under Pressure';
    return 'Expensive';
  };

  // Boundary calculations
  const strikerBoundaryRuns = striker.fours * 4 + striker.sixes * 6;
  const strikerBoundaryPct = striker.runs > 0 ? Math.round((strikerBoundaryRuns / striker.runs) * 100) : 0;

  const nonStrikerBoundaryRuns = nonStriker.fours * 4 + nonStriker.sixes * 6;
  const nonStrikerBoundaryPct = nonStriker.runs > 0 ? Math.round((nonStrikerBoundaryRuns / nonStriker.runs) * 100) : 0;

  // Partnership share calculations
  const totalPartRuns = currentPartnership?.runs || (striker.runs + nonStriker.runs) || 1;
  const p1Share = currentPartnership?.player1Runs ?? Math.round((striker.runs / totalPartRuns) * totalPartRuns);
  const p2Share = currentPartnership?.player2Runs ?? Math.round((nonStriker.runs / totalPartRuns) * totalPartRuns);
  const p1Pct = Math.min(100, Math.max(0, Math.round((p1Share / Math.max(1, totalPartRuns)) * 100)));

  // Partnership run rate
  const partBalls = currentPartnership?.balls || (striker.balls + nonStriker.balls) || 0;
  const partRunRate = partBalls > 0 ? Number(((totalPartRuns / partBalls) * 6).toFixed(2)) : 0;

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* 1. BATTERS IN ACTION CARD */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                Active Batters
                <span className="text-[10px] font-normal text-slate-400">({battingTeam.shortName || battingTeam.code})</span>
              </h3>
              <p className="text-[10px] text-slate-400">Live strike rates & boundary impact</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
            CREX Source of Truth
          </span>
        </div>

        {/* Striker Performance Card */}
        <div
          onClick={() =>
            onSelectPlayer?.({
              name: striker.name,
              team: battingTeam.code,
              id: striker.playerId
            })
          }
          className="bg-slate-800/70 hover:bg-slate-800/90 transition-all rounded-xl p-3 border border-amber-500/30 shadow-sm cursor-pointer active:scale-[0.99] space-y-2.5"
          title={`View full career stats for ${striker.name}`}
        >
          {/* Top Row: Avatar + Name + On-Strike Badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PlayerAvatar
                playerId={striker.playerId}
                name={striker.name}
                teamCode={battingTeam.code}
                jerseyNumber={striker.jerseyNumber}
                imageUrl={striker.imageUrl}
                isOnStrike={true}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-sm truncate">{striker.name}</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    On Strike
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>#{striker.jerseyNumber || 10}</span>
                  <span>•</span>
                  <span>{striker.outDesc || 'Not Out *'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 hover:text-white shrink-0">
              <span className="text-[10px] font-bold text-blue-400">Profile</span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>

          {/* Stats Metric Grid */}
          <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-700/60 text-center font-mono">
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Runs</div>
              <div className="text-sm font-black text-white">{striker.runs}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Balls</div>
              <div className="text-sm font-bold text-slate-300">{striker.balls}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">4s</div>
              <div className="text-sm font-bold text-blue-400">{striker.fours}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">6s</div>
              <div className="text-sm font-bold text-purple-400">{striker.sixes}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">S/R</div>
              <div className="text-xs font-black text-amber-400">
                {striker.strikeRate.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Additional details bar: Boundary percentage */}
          <div className="flex items-center justify-between text-[10px] font-mono px-1 text-slate-400">
            <span>Boundary Runs: <strong className="text-slate-200">{strikerBoundaryRuns}</strong> ({strikerBoundaryPct}%)</span>
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${getStrikeRateColor(striker.strikeRate)}`}>
              SR {striker.strikeRate.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Non-Striker Performance Card */}
        <div
          onClick={() =>
            onSelectPlayer?.({
              name: nonStriker.name,
              team: battingTeam.code,
              id: nonStriker.playerId
            })
          }
          className="bg-slate-800/40 hover:bg-slate-800/70 transition-all rounded-xl p-3 border border-slate-800 shadow-sm cursor-pointer active:scale-[0.99] space-y-2.5"
          title={`View full career stats for ${nonStriker.name}`}
        >
          {/* Top Row: Avatar + Name + Non-Striker Tag */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PlayerAvatar
                playerId={nonStriker.playerId}
                name={nonStriker.name}
                teamCode={battingTeam.code}
                jerseyNumber={nonStriker.jerseyNumber}
                imageUrl={nonStriker.imageUrl}
                isOnStrike={false}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-200 text-sm truncate">{nonStriker.name}</span>
                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                    Non-Striker
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>#{nonStriker.jerseyNumber || 7}</span>
                  <span>•</span>
                  <span>Not Out</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 hover:text-white shrink-0">
              <span className="text-[10px] font-bold text-blue-400">Profile</span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>

          {/* Stats Metric Grid */}
          <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-800 text-center font-mono">
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Runs</div>
              <div className="text-sm font-bold text-slate-200">{nonStriker.runs}</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Balls</div>
              <div className="text-sm font-medium text-slate-400">{nonStriker.balls}</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">4s</div>
              <div className="text-sm font-semibold text-blue-400">{nonStriker.fours}</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">6s</div>
              <div className="text-sm font-semibold text-purple-400">{nonStriker.sixes}</div>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/80">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">S/R</div>
              <div className="text-xs font-bold text-slate-300">
                {nonStriker.strikeRate.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Additional details bar: Boundary percentage */}
          <div className="flex items-center justify-between text-[10px] font-mono px-1 text-slate-400">
            <span>Boundary Runs: <strong className="text-slate-300">{nonStrikerBoundaryRuns}</strong> ({nonStrikerBoundaryPct}%)</span>
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${getStrikeRateColor(nonStriker.strikeRate)}`}>
              SR {nonStriker.strikeRate.toFixed(0)}
            </span>
          </div>
        </div>

        {/* 2. ACTIVE PARTNERSHIP BREAKDOWN */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Current Partnership</span>
            </div>
            <div className="font-mono text-xs">
              <strong className="text-white text-sm">{totalPartRuns}</strong>
              <span className="text-slate-400 ml-1">runs ({partBalls}b)</span>
              <span className="text-slate-500 ml-1.5 font-normal">· RR {partRunRate}</span>
            </div>
          </div>

          {/* Visual Distribution Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${p1Pct}%` }}
                title={`${striker.name}: ${p1Share} runs (${p1Pct}%)`}
              />
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${100 - p1Pct}%` }}
                title={`${nonStriker.name}: ${p2Share} runs (${100 - p1Pct}%)`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span className="text-amber-400 truncate max-w-[45%]">
                {striker.shortName || striker.name}: {p1Share} ({p1Pct}%)
              </span>
              <span className="text-blue-400 truncate max-w-[45%] text-right">
                {nonStriker.shortName || nonStriker.name}: {p2Share} ({100 - p1Pct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE BOWLER PERFORMANCE CARD */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                Active Bowler
                <span className="text-[10px] font-normal text-slate-400">({bowlingTeam.shortName || bowlingTeam.code})</span>
              </h3>
              <p className="text-[10px] text-slate-400">Spell economy, maidens & wickets</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            In Attack
          </span>
        </div>

        {/* Bowler Details Card */}
        <div
          onClick={() =>
            onSelectPlayer?.({
              name: currentBowler.name,
              team: bowlingTeam.code,
              id: currentBowler.playerId
            })
          }
          className="bg-slate-800/70 hover:bg-slate-800/90 transition-all rounded-xl p-3 border border-emerald-500/30 shadow-sm cursor-pointer active:scale-[0.99] space-y-2.5"
          title={`View full career bowling figures for ${currentBowler.name}`}
        >
          {/* Top Row: Avatar + Name + Spell badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <PlayerAvatar
                playerId={currentBowler.playerId}
                name={currentBowler.name}
                teamCode={bowlingTeam.code}
                jerseyNumber={currentBowler.jerseyNumber}
                imageUrl={currentBowler.imageUrl}
                size="md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-sm truncate">{currentBowler.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>#{currentBowler.jerseyNumber || 99}</span>
                  <span>•</span>
                  <span>Figures: <strong className="text-emerald-400">{currentBowler.wickets}/{currentBowler.runs}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 hover:text-white shrink-0">
              <span className="text-[10px] font-bold text-emerald-400">Profile</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          {/* Figures Metric Grid */}
          <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-700/60 text-center font-mono">
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Overs</div>
              <div className="text-sm font-bold text-slate-200">{currentBowler.overs}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Maidens</div>
              <div className="text-sm font-bold text-amber-400">{currentBowler.maidens}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Runs</div>
              <div className="text-sm font-bold text-slate-300">{currentBowler.runs}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Wickets</div>
              <div className="text-sm font-black text-emerald-400">{currentBowler.wickets}</div>
            </div>
            <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">Econ</div>
              <div className="text-xs font-black text-cyan-400">
                {currentBowler.economy.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Spell Summary Bar */}
          <div className="flex items-center justify-between text-[10px] font-mono px-1 text-slate-400">
            <span>
              Spell Rating: <span className="font-semibold text-slate-200">{getEconomyLabel(currentBowler.economy)}</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${getEconomyColor(currentBowler.economy)}`}>
              ECON {currentBowler.economy.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
