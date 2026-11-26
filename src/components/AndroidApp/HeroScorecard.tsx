import React from 'react';
import { MatchState } from '../../types/cricket';
import { Trophy, Clock, Activity, MapPin } from 'lucide-react';
import { TeamFlag } from '../TeamFlag';

interface HeroScorecardProps {
  match: MatchState;
}

export const HeroScorecard: React.FC<HeroScorecardProps> = ({ match }) => {
  const { battingTeam, bowlingTeam, currentRunRate, requiredRunRate, target, statusText } = match;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 rounded-2xl p-4 border border-slate-800 shadow-xl relative overflow-hidden">
      {/* Background ambient stadium glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Series & Match Type Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5 font-medium truncate max-w-[220px]">
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{match.series}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px] tracking-wide border border-blue-500/30">
            {match.matchType}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            LIVE
          </span>
        </div>
      </div>

      {/* Main Score Area */}
      <div className="grid grid-cols-2 gap-3 py-1">
        {/* Batting Team (In action) */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 relative">
          <div className="flex items-center gap-2 mb-1.5">
            <TeamFlag
              teamName={battingTeam.name}
              teamCode={battingTeam.code}
              logoUrl={battingTeam.logoUrl}
              size="sm"
            />
            <div>
              <div className="font-bold text-white text-sm leading-tight flex items-center gap-1">
                {battingTeam.name}
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Batting" />
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Batting</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              {battingTeam.score.runs}/{battingTeam.score.wickets}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-400 font-mono">
              ({battingTeam.score.overs}.{battingTeam.score.balls} ov)
            </span>
          </div>
        </div>

        {/* Bowling / Opponent Team */}
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
          <div className="flex items-center gap-2 mb-1.5">
            <TeamFlag
              teamName={bowlingTeam.name}
              teamCode={bowlingTeam.code}
              logoUrl={bowlingTeam.logoUrl}
              size="sm"
            />
            <div>
              <div className="font-bold text-slate-300 text-sm leading-tight">{bowlingTeam.name}</div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Bowling</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-bold text-slate-400 tracking-tight font-sans">
              {bowlingTeam.score.runs > 0 ? `${bowlingTeam.score.runs}/${bowlingTeam.score.wickets}` : 'Yet to Bat'}
            </span>
            {bowlingTeam.score.overs > 0 && (
              <span className="text-xs font-semibold text-slate-500 font-mono">
                ({bowlingTeam.score.overs}.{bowlingTeam.score.balls})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rates & Target Bar */}
      <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-3 py-2 mt-3 border border-slate-800 font-mono">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">CRR:</span>
          <span className="text-white font-bold">{currentRunRate.toFixed(2)}</span>
        </div>

        {target && target > 0 ? (
          <div className="flex items-center gap-2">
            <div>
              <span className="text-slate-400">Target:</span>{' '}
              <span className="text-amber-400 font-bold">{target}</span>
            </div>
            {requiredRunRate !== undefined && (
              <div>
                <span className="text-slate-400">RRR:</span>{' '}
                <span className="text-rose-400 font-bold">{requiredRunRate.toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Innings:</span>
            <span className="text-slate-200 font-bold">{match.currentInnings}st</span>
          </div>
        )}
      </div>

      {/* Match Status Strip */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <p className="text-amber-400 font-semibold tracking-wide text-[11px] truncate">
          {statusText}
        </p>
        <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 ml-2">
          <MapPin className="w-3 h-3 text-slate-500" />
          <span className="truncate max-w-[120px]">{match.venue.split(',')[0]}</span>
        </span>
      </div>
    </div>
  );
};
