import React from 'react';
import { MatchState } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';
import { Users } from 'lucide-react';

interface LivePlayersCardProps {
  match: MatchState;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
}

export const LivePlayersCard: React.FC<LivePlayersCardProps> = ({ match, onSelectPlayer }) => {
  const { striker, nonStriker, currentBowler, currentPartnership, battingTeam, bowlingTeam } = match;

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-4">
      {/* Batting Section (Striker & Non-Striker) */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 px-1">
          <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-blue-400">
            <span>Batting</span>
            <span className="text-[10px] text-slate-500 font-normal lowercase">(tap for stats)</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-[10px] w-36 text-slate-500 font-mono">
            <span>R</span>
            <span>B</span>
            <span>4s</span>
            <span>6s</span>
          </div>
        </div>

        <div className="space-y-2">
          {/* Striker Row */}
          <div
            onClick={() => onSelectPlayer?.({ name: striker.name, team: battingTeam.code, id: striker.playerId })}
            className="bg-slate-800/80 hover:bg-slate-800 rounded-xl p-2.5 border border-amber-500/30 flex items-center justify-between shadow-sm cursor-pointer transition-all active:scale-[0.99]"
            title="View Player Stats"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <PlayerAvatar
                playerId={striker.playerId}
                name={striker.name}
                teamCode={battingTeam.code}
                jerseyNumber={striker.jerseyNumber}
                imageUrl={striker.imageUrl}
                isOnStrike={true}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-white text-sm truncate">
                  <span className="truncate">{striker.name}</span>
                  <span className="text-amber-400 font-black text-xs">*</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  SR: <span className="text-slate-200">{striker.strikeRate.toFixed(1)}</span> · <span className="text-blue-400">Stats →</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center text-xs font-mono w-36 font-semibold">
              <span className="text-white font-bold text-sm bg-slate-950/60 py-0.5 rounded border border-slate-700/50">
                {striker.runs}
              </span>
              <span className="text-slate-300 self-center">{striker.balls}</span>
              <span className="text-blue-400 self-center">{striker.fours}</span>
              <span className="text-purple-400 self-center">{striker.sixes}</span>
            </div>
          </div>

          {/* Non-Striker Row */}
          <div
            onClick={() => onSelectPlayer?.({ name: nonStriker.name, team: battingTeam.code, id: nonStriker.playerId })}
            className="bg-slate-800/40 hover:bg-slate-800/70 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]"
            title="View Player Stats"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <PlayerAvatar
                playerId={nonStriker.playerId}
                name={nonStriker.name}
                teamCode={battingTeam.code}
                jerseyNumber={nonStriker.jerseyNumber}
                imageUrl={nonStriker.imageUrl}
                isOnStrike={false}
                size="sm"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 text-sm truncate">
                  {nonStriker.name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  SR: <span className="text-slate-300">{nonStriker.strikeRate.toFixed(1)}</span> · <span className="text-blue-400">Stats →</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center text-xs font-mono w-36 font-semibold">
              <span className="text-slate-100 font-bold text-sm bg-slate-950/40 py-0.5 rounded border border-slate-800">
                {nonStriker.runs}
              </span>
              <span className="text-slate-400 self-center">{nonStriker.balls}</span>
              <span className="text-blue-400 self-center">{nonStriker.fours}</span>
              <span className="text-purple-400 self-center">{nonStriker.sixes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Partnership Pill */}
      {currentPartnership && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">Partnership:</span>
          </div>
          <div className="text-white font-bold">
            {currentPartnership.runs} runs <span className="text-slate-400 font-normal">({currentPartnership.balls}b)</span>
          </div>
        </div>
      )}

      {/* Bowling Section */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 px-1">
          <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-emerald-400">
            <span>Bowling</span>
            <span className="text-[10px] text-slate-500 font-normal lowercase">(tap for stats)</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-[10px] w-36 text-slate-500 font-mono">
            <span>O</span>
            <span>M</span>
            <span>R</span>
            <span>W</span>
          </div>
        </div>

        <div
          onClick={() => onSelectPlayer?.({ name: currentBowler.name, team: bowlingTeam.code, id: currentBowler.playerId })}
          className="bg-slate-800/80 hover:bg-slate-800 rounded-xl p-2.5 border border-emerald-500/30 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]"
          title="View Player Stats"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PlayerAvatar
              playerId={currentBowler.playerId}
              name={currentBowler.name}
              teamCode={bowlingTeam.code}
              jerseyNumber={currentBowler.jerseyNumber}
              imageUrl={currentBowler.imageUrl}
              size="sm"
            />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                {currentBowler.name}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Econ: <span className="text-slate-200">{currentBowler.economy.toFixed(2)}</span> · <span className="text-emerald-400">Stats →</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center text-xs font-mono w-36 font-semibold">
            <span className="text-slate-300 self-center">{currentBowler.overs}</span>
            <span className="text-slate-400 self-center">{currentBowler.maidens}</span>
            <span className="text-slate-200 self-center">{currentBowler.runs}</span>
            <span className="text-emerald-400 font-bold text-sm bg-slate-950/60 py-0.5 rounded border border-emerald-700/50">
              {currentBowler.wickets}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
