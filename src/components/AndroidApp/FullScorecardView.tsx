import React, { useState } from 'react';
import { MatchState, InningsScorecard } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';

interface FullScorecardViewProps {
  match: MatchState;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
}

export const FullScorecardView: React.FC<FullScorecardViewProps> = ({ match, onSelectPlayer }) => {
  const [selectedInnings, setSelectedInnings] = useState<1 | 2>(match.currentInnings || 1);

  const activeInnings: InningsScorecard | undefined =
    selectedInnings === 1 ? match.scorecards.firstInnings : match.scorecards.secondInnings;

  return (
    <div className="space-y-4">
      {/* Innings Switcher Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setSelectedInnings(1)}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            selectedInnings === 1
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {match.battingTeam.shortName} Innings (1st)
        </button>
        {match.scorecards.secondInnings ? (
          <button
            onClick={() => setSelectedInnings(2)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              selectedInnings === 2
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {match.bowlingTeam.shortName} Innings (2nd)
          </button>
        ) : (
          <button
            disabled
            className="flex-1 py-2 text-xs font-medium text-slate-600 cursor-not-allowed"
          >
            2nd Innings (Yet to bat)
          </button>
        )}
      </div>

      {activeInnings ? (
        <div className="space-y-4">
          {/* Batting Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
            <div className="bg-slate-850 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase tracking-wider">
                Batting
              </span>
              <div className="grid grid-cols-5 gap-2 text-center text-[10px] w-48 text-slate-400 font-mono">
                <span>R</span>
                <span>B</span>
                <span>4s</span>
                <span>6s</span>
                <span>SR</span>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {activeInnings.batting.map((batter) => (
                <div
                  key={batter.playerId}
                  onClick={() => onSelectPlayer?.({ name: batter.name, id: batter.playerId })}
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors active:bg-slate-800/60"
                  title="View Player Stats"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <PlayerAvatar
                      playerId={batter.playerId}
                      name={batter.name}
                      imageUrl={batter.imageUrl}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 text-xs sm:text-sm truncate">
                        {batter.name}
                        {batter.isNotOut && (
                          <span className="text-amber-400 font-bold ml-1">*</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {batter.dismissal || (batter.isNotOut ? 'not out' : 'out')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono w-48 shrink-0">
                    <span className="font-bold text-white text-sm">{batter.runs}</span>
                    <span className="text-slate-400 self-center">{batter.balls}</span>
                    <span className="text-slate-300 self-center">{batter.fours}</span>
                    <span className="text-slate-300 self-center">{batter.sixes}</span>
                    <span className="text-slate-400 text-[11px] self-center">
                      {batter.strikeRate.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Extras & Total */}
            <div className="bg-slate-950/80 p-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400 font-mono">
                <span>Extras</span>
                <span className="text-slate-200">
                  {activeInnings.extras.total} (wd {activeInnings.extras.wides}, nb {activeInnings.extras.noBalls}, b {activeInnings.extras.byes}, lb {activeInnings.extras.legByes})
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-800 text-white font-bold">
                <span>Total Score</span>
                <span className="text-base text-amber-400 font-mono">
                  {activeInnings.totalRuns}/{activeInnings.totalWickets} ({activeInnings.totalOvers} ov, RR {activeInnings.runRate})
                </span>
              </div>
            </div>

            {/* Yet to Bat */}
            {activeInnings.yetToBat && activeInnings.yetToBat.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 text-xs">
                <span className="text-slate-500 font-semibold mr-2">Yet to Bat:</span>
                <span className="text-slate-400">{activeInnings.yetToBat.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Bowling Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
            <div className="bg-slate-850 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase tracking-wider">
                Bowling
              </span>
              <div className="grid grid-cols-5 gap-2 text-center text-[10px] w-48 text-slate-400 font-mono">
                <span>O</span>
                <span>M</span>
                <span>R</span>
                <span>W</span>
                <span>Econ</span>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {activeInnings.bowling.map((bowler) => (
                <div
                  key={bowler.playerId}
                  onClick={() => onSelectPlayer?.({ name: bowler.name, id: bowler.playerId })}
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors active:bg-slate-800/60"
                  title="View Player Stats"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <PlayerAvatar
                      playerId={bowler.playerId}
                      name={bowler.name}
                      imageUrl={bowler.imageUrl}
                      size="xs"
                    />
                    <div className="font-semibold text-slate-100 text-xs sm:text-sm truncate">
                      {bowler.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono w-48 shrink-0">
                    <span className="text-slate-300 self-center">{bowler.overs}</span>
                    <span className="text-slate-400 self-center">{bowler.maidens}</span>
                    <span className="text-slate-300 self-center">{bowler.runs}</span>
                    <span className="font-bold text-emerald-400 text-sm self-center">
                      {bowler.wickets}
                    </span>
                    <span className="text-slate-400 text-[11px] self-center">
                      {bowler.economy.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fall of Wickets */}
          {activeInnings.fallOfWickets && activeInnings.fallOfWickets.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
              <span className="font-bold text-white text-xs uppercase tracking-wider block mb-2">
                Fall of Wickets
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {activeInnings.fallOfWickets.map((fow) => (
                  <span
                    key={fow.wicketNumber}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300"
                  >
                    <span className="text-rose-400 font-bold">{fow.score}/{fow.wicketNumber}</span> ({fow.playerOut}, {fow.over} ov)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
          Innings data is preparing or match has not reached this stage.
        </div>
      )}
    </div>
  );
};
