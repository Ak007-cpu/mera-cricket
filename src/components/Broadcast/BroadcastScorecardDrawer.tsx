import React, { useEffect, useState } from 'react';
import { InningsScorecard, MatchState } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { VERIFIED_PLAYERS } from '../../data/playersRegistry';
import { ClipboardList, Users, X } from 'lucide-react';

interface BroadcastScorecardDrawerProps {
  match: MatchState;
  isOpen: boolean;
  onClose: () => void;
}

type DrawerTab = 'innings1' | 'innings2' | 'squads';

export const BroadcastScorecardDrawer: React.FC<BroadcastScorecardDrawerProps> = ({
  match,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>(() =>
    match.currentInnings === 2 && match.scorecards?.secondInnings ? 'innings2' : 'innings1'
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(
      match.currentInnings === 2 && match.scorecards?.secondInnings ? 'innings2' : 'innings1'
    );
  }, [isOpen, match.currentInnings, match.scorecards?.secondInnings]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const firstInn = match.scorecards?.firstInnings;
  const secondInn = match.scorecards?.secondInnings;
  const activeInnings: InningsScorecard | undefined =
    activeTab === 'innings2' ? secondInn : firstInn;

  const batCode = (match.battingTeam.code || match.battingTeam.shortName || '').toUpperCase();
  const bowlCode = (match.bowlingTeam.code || match.bowlingTeam.shortName || '').toUpperCase();

  const allVerified = Object.values(VERIFIED_PLAYERS);
  const batSquad = allVerified.filter((p) => {
    const tc = p.teamCode.toUpperCase();
    return tc === batCode || match.battingTeam.name.toUpperCase().includes(tc);
  });
  const bowlSquad = allVerified.filter((p) => {
    const tc = p.teamCode.toUpperCase();
    return tc === bowlCode || match.bowlingTeam.name.toUpperCase().includes(tc);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full Scorecard and Playing XI"
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-full bg-white dark:bg-[#060d1f] border-l border-slate-300 dark:border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-950 dark:text-white"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-black uppercase tracking-wider truncate">
                Full Scorecard &amp; Playing XI
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {match.battingTeam.name} vs {match.bowlingTeam.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scorecard"
            className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-2 shrink-0 bg-slate-100/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('innings1')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'innings1'
                ? 'bg-sky-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            {firstInn?.teamCode || match.battingTeam.shortName} 1st Inn
          </button>

          <button
            type="button"
            disabled={!secondInn}
            onClick={() => setActiveTab('innings2')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 ${
              activeTab === 'innings2'
                ? 'bg-sky-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            {secondInn ? `${secondInn.teamCode || match.bowlingTeam.shortName} 2nd Inn` : '2nd Inn (Pending)'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('squads')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'squads'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white dark:bg-slate-900 text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white border border-slate-300 dark:border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Playing XI</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/70 dark:bg-transparent">
          {activeTab === 'squads' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team 1 Squad */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-4 space-y-3 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <TeamFlag
                    teamName={match.battingTeam.name}
                    teamCode={match.battingTeam.code}
                    logoUrl={match.battingTeam.logoUrl}
                    size="xs"
                  />
                  <span className="font-black text-sm text-slate-950 dark:text-white truncate">
                    {match.battingTeam.name}
                  </span>
                </div>
                <div className="space-y-2">
                  {(batSquad.length > 0
                    ? batSquad
                    : [
                        {
                          id: match.striker.playerId,
                          name: match.striker.name,
                          role: 'Batter',
                          teamCode: batCode,
                          jerseyNumber: match.striker.jerseyNumber
                        },
                        {
                          id: match.nonStriker.playerId,
                          name: match.nonStriker.name,
                          role: 'Batter',
                          teamCode: batCode,
                          jerseyNumber: match.nonStriker.jerseyNumber
                        }
                      ]
                  ).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80"
                    >
                      <PlayerAvatar
                        playerId={p.id}
                        name={p.name}
                        teamCode={match.battingTeam.code}
                        jerseyNumber={p.jerseyNumber}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 dark:text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400">{p.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 Squad */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-4 space-y-3 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <TeamFlag
                    teamName={match.bowlingTeam.name}
                    teamCode={match.bowlingTeam.code}
                    logoUrl={match.bowlingTeam.logoUrl}
                    size="xs"
                  />
                  <span className="font-black text-sm text-slate-950 dark:text-white truncate">
                    {match.bowlingTeam.name}
                  </span>
                </div>
                <div className="space-y-2">
                  {(bowlSquad.length > 0
                    ? bowlSquad
                    : [
                        {
                          id: match.currentBowler.playerId,
                          name: match.currentBowler.name,
                          role: 'Bowler',
                          teamCode: bowlCode,
                          jerseyNumber: match.currentBowler.jerseyNumber
                        }
                      ]
                  ).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80"
                    >
                      <PlayerAvatar
                        playerId={p.id}
                        name={p.name}
                        teamCode={match.bowlingTeam.code}
                        jerseyNumber={p.jerseyNumber}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 dark:text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400">{p.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeInnings ? (
            <>
              {/* Batting Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    {activeInnings.teamName} Batting
                  </span>
                  <div className="grid grid-cols-5 gap-2 w-48 text-center font-score text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    <span>R</span>
                    <span>B</span>
                    <span>4s</span>
                    <span>6s</span>
                    <span>SR</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
                  {activeInnings.batting.map((batter) => (
                    <div key={batter.playerId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerAvatar
                          playerId={batter.playerId}
                          name={batter.name}
                          imageUrl={batter.imageUrl}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white truncate">
                            {batter.name}
                            {batter.isNotOut && <span className="text-amber-600 dark:text-amber-400 ml-1">*</span>}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {batter.dismissal || (batter.isNotOut ? 'not out' : 'out')}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 w-48 text-center font-score text-xs shrink-0">
                        <span className="font-black text-slate-950 dark:text-white">{batter.runs}</span>
                        <span className="text-slate-600 dark:text-slate-400">{batter.balls}</span>
                        <span className="text-slate-700 dark:text-slate-300">{batter.fours}</span>
                        <span className="text-slate-700 dark:text-slate-300">{batter.sixes}</span>
                        <span className="text-slate-600 dark:text-slate-400">{batter.strikeRate.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 font-score">
                    <span>Extras</span>
                    <span className="text-slate-900 dark:text-slate-200 font-semibold">
                      {activeInnings.extras.total} (wd {activeInnings.extras.wides}, nb{' '}
                      {activeInnings.extras.noBalls}, b {activeInnings.extras.byes}, lb{' '}
                      {activeInnings.extras.legByes})
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-950 dark:text-white">
                    <span>Total Score</span>
                    <span className="font-score text-base text-amber-700 dark:text-amber-300">
                      {activeInnings.totalRuns}/{activeInnings.totalWickets} ({activeInnings.totalOvers}{' '}
                      ov • RR {activeInnings.runRate})
                    </span>
                  </div>
                </div>

                {activeInnings.yetToBat && activeInnings.yetToBat.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold mr-1.5">Yet to Bat:</span>
                    <span className="text-slate-800 dark:text-slate-200">{activeInnings.yetToBat.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Bowling Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Bowling Figures
                  </span>
                  <div className="grid grid-cols-5 gap-2 w-48 text-center font-score text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    <span>O</span>
                    <span>M</span>
                    <span>R</span>
                    <span>W</span>
                    <span>ECON</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800/70">
                  {activeInnings.bowling.map((bowler) => (
                    <div key={bowler.playerId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerAvatar
                          playerId={bowler.playerId}
                          name={bowler.name}
                          imageUrl={bowler.imageUrl}
                          size="xs"
                        />
                        <span className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white truncate">
                          {bowler.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2 w-48 text-center font-score text-xs shrink-0">
                        <span className="text-slate-800 dark:text-slate-200">{bowler.overs}</span>
                        <span className="text-slate-600 dark:text-slate-400">{bowler.maidens}</span>
                        <span className="text-slate-800 dark:text-slate-200">{bowler.runs}</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300">{bowler.wickets}</span>
                        <span className="text-slate-600 dark:text-slate-400">{bowler.economy.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fall of Wickets */}
              {activeInnings.fallOfWickets && activeInnings.fallOfWickets.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-4 space-y-2.5 shadow-sm dark:shadow-none">
                  <div className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Fall of Wickets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeInnings.fallOfWickets.map((fow) => (
                      <span
                        key={`${fow.wicketNumber}_${fow.over}`}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-score text-slate-800 dark:text-slate-200"
                      >
                        <strong className="text-rose-700 dark:text-rose-300">{fow.score}/{fow.wicketNumber}</strong> ({fow.playerOut},{' '}
                        {fow.over} ov)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
              Is innings ka scorecard data abhi available nahi hai.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
