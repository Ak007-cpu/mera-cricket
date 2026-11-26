import React, { useEffect, useMemo } from 'react';
import { MatchState } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import { normalizePlayerName } from '../../data/playersRegistry';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { Trophy, X, Award } from 'lucide-react';

export type SummaryPhase = 'innings_break' | 'match_completed';

interface MatchSummaryModalProps {
  match: MatchState;
  phase: SummaryPhase;
  isOpen: boolean;
  onClose: () => void;
}

interface TopScorerInfo {
  playerId: string;
  name: string;
  teamCode: string;
  imageUrl?: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isNotOut: boolean;
  dismissal: string;
}

interface BestBowlerInfo {
  playerId: string;
  name: string;
  teamCode: string;
  imageUrl?: string;
  wickets: number;
  runs: number;
  overs: number;
  maidens: number;
  economy: number;
}

function getFormatMaxOversNum(matchType: MatchState['matchType']): number | null {
  if (matchType === 'T10') return 10;
  if (matchType === 'T20') return 20;
  if (matchType === 'ODI') return 50;
  return null;
}

export function detectSummaryPhase(match: MatchState | null | undefined): SummaryPhase | null {
  if (!match) return null;

  const statusLower = (match.statusText || '').toLowerCase();
  const isCompletedStatus =
    match.gameState === 'completed' ||
    /(won by|win by|won the|beat |defeated|champion|match tied|tied|no result)/i.test(statusLower);

  if (isCompletedStatus) {
    return 'match_completed';
  }

  // Chase target achieved in 2nd innings
  if (
    match.currentInnings === 2 &&
    typeof match.target === 'number' &&
    match.target > 0 &&
    match.battingTeam?.score?.runs >= match.target
  ) {
    return 'match_completed';
  }

  if (match.gameState === 'innings_break') {
    return 'innings_break';
  }

  if (
    match.currentInnings === 1 &&
    (/innings break|end of innings|end of 1st innings|target\s+\d+/i.test(statusLower))
  ) {
    return 'innings_break';
  }

  // Check if 1st innings naturally completed (all out or max overs bowled) while still marked innings 1
  if (match.currentInnings === 1 && match.battingTeam?.score) {
    const maxOv = match.dlsDetails?.applied
      ? match.dlsDetails.revisedOvers
      : getFormatMaxOversNum(match.matchType);
    const { wickets, overs, balls } = match.battingTeam.score;
    if (wickets >= 10 || (maxOv !== null && overs >= maxOv && balls === 0)) {
      return 'innings_break';
    }
  }

  return null;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  match,
  phase,
  isOpen,
  onClose
}) => {
  const { players: managedPlayers } = useContent();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cmsPlayerMap = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl?: string }>();
    managedPlayers.forEach((p) => {
      const k1 = normalizePlayerName(p.name);
      if (k1) map.set(k1, p);
      if (p.originalName) {
        const k2 = normalizePlayerName(p.originalName);
        if (k2) map.set(k2, p);
      }
      if (p.id) map.set(p.id.toLowerCase(), p);
    });
    return map;
  }, [managedPlayers]);

  const { topScorer, bestBowler, teamTotals } = useMemo(() => {
    const resolveCms = (name: string, playerId: string, imageUrl?: string) => {
      const norm = normalizePlayerName(name) || playerId.toLowerCase();
      const ov = cmsPlayerMap.get(norm) || cmsPlayerMap.get(playerId.toLowerCase());
      return {
        name: ov?.name || name,
        imageUrl: ov?.imageUrl || imageUrl
      };
    };

    // Collect batters across available scorecards + live crease batters
    const battersMap = new Map<string, TopScorerInfo>();
    const upsertBatter = (b: TopScorerInfo) => {
      const key = `${normalizePlayerName(b.name)}_${b.teamCode}`;
      const existing = battersMap.get(key);
      if (!existing || b.runs > existing.runs || (b.runs === existing.runs && b.balls > existing.balls)) {
        battersMap.set(key, b);
      }
    };

    const inningsCards = [match.scorecards?.firstInnings, match.scorecards?.secondInnings].filter(Boolean);
    inningsCards.forEach((inn) => {
      if (!inn) return;
      inn.batting?.forEach((row) => {
        if (row.runs <= 0 && row.balls <= 0) return;
        const resolved = resolveCms(row.name, row.playerId || row.name, row.imageUrl);
        upsertBatter({
          playerId: row.playerId || row.name,
          name: resolved.name,
          teamCode: inn.teamCode || match.battingTeam.code,
          imageUrl: resolved.imageUrl,
          runs: row.runs,
          balls: row.balls,
          fours: row.fours,
          sixes: row.sixes,
          strikeRate: row.strikeRate,
          isNotOut: row.isNotOut,
          dismissal: row.dismissal || (row.isNotOut ? 'not out' : '')
        });
      });
    });

    [match.striker, match.nonStriker].forEach((liveBat) => {
      if (!liveBat || !liveBat.name || (liveBat.runs <= 0 && liveBat.balls <= 0)) return;
      const resolved = resolveCms(liveBat.name, liveBat.playerId || liveBat.name, liveBat.imageUrl);
      upsertBatter({
        playerId: liveBat.playerId || liveBat.name,
        name: resolved.name,
        teamCode: match.battingTeam.code,
        imageUrl: resolved.imageUrl,
        runs: liveBat.runs,
        balls: liveBat.balls,
        fours: liveBat.fours,
        sixes: liveBat.sixes,
        strikeRate: liveBat.strikeRate,
        isNotOut: !liveBat.outDesc || liveBat.outDesc.toLowerCase() === 'not out',
        dismissal: liveBat.outDesc || 'not out'
      });
    });

    const sortedBatters = Array.from(battersMap.values()).sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      if (b.strikeRate !== a.strikeRate) return b.strikeRate - a.strikeRate;
      return a.balls - b.balls;
    });

    // Collect bowlers across available scorecards + live bowler
    const bowlersMap = new Map<string, BestBowlerInfo>();
    const upsertBowler = (bw: BestBowlerInfo) => {
      if (bw.overs <= 0 && bw.wickets <= 0 && bw.runs <= 0) return;
      const key = `${normalizePlayerName(bw.name)}_${bw.teamCode}`;
      const existing = bowlersMap.get(key);
      if (
        !existing ||
        bw.wickets > existing.wickets ||
        (bw.wickets === existing.wickets && bw.overs > existing.overs)
      ) {
        bowlersMap.set(key, bw);
      }
    };

    inningsCards.forEach((inn) => {
      if (!inn) return;
      const oppCode =
        inn.teamCode === match.battingTeam.code ? match.bowlingTeam.code : match.battingTeam.code;
      inn.bowling?.forEach((row) => {
        const resolved = resolveCms(row.name, row.playerId || row.name, row.imageUrl);
        upsertBowler({
          playerId: row.playerId || row.name,
          name: resolved.name,
          teamCode: oppCode,
          imageUrl: resolved.imageUrl,
          wickets: row.wickets,
          runs: row.runs,
          overs: row.overs,
          maidens: row.maidens,
          economy: row.economy
        });
      });
    });

    if (match.currentBowler && match.currentBowler.name) {
      const resolved = resolveCms(
        match.currentBowler.name,
        match.currentBowler.playerId || match.currentBowler.name,
        match.currentBowler.imageUrl
      );
      upsertBowler({
        playerId: match.currentBowler.playerId || match.currentBowler.name,
        name: resolved.name,
        teamCode: match.bowlingTeam.code,
        imageUrl: resolved.imageUrl,
        wickets: match.currentBowler.wickets,
        runs: match.currentBowler.runs,
        overs: match.currentBowler.overs,
        maidens: match.currentBowler.maidens,
        economy: match.currentBowler.economy
      });
    }

    const sortedBowlers = Array.from(bowlersMap.values()).sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      if (a.runs !== b.runs) return a.runs - b.runs;
      if (a.economy !== b.economy) return a.economy - b.economy;
      return b.overs - a.overs;
    });

    // Team totals: in 2nd innings, bowlingTeam batted 1st and battingTeam batted 2nd
    const firstTeam =
      match.currentInnings === 2 ? match.bowlingTeam : match.battingTeam;
    const secondTeam =
      match.currentInnings === 2 ? match.battingTeam : match.bowlingTeam;

    const firstHasScore =
      firstTeam.score.runs > 0 ||
      firstTeam.score.wickets > 0 ||
      firstTeam.score.overs > 0 ||
      firstTeam.score.balls > 0;
    const secondHasScore =
      secondTeam.score.runs > 0 ||
      secondTeam.score.wickets > 0 ||
      secondTeam.score.overs > 0 ||
      secondTeam.score.balls > 0;

    return {
      topScorer: sortedBatters[0] || null,
      bestBowler: sortedBowlers[0] || null,
      teamTotals: [
        { team: firstTeam, hasScore: firstHasScore, inningsLabel: '1st Innings' },
        { team: secondTeam, hasScore: secondHasScore, inningsLabel: '2nd Innings' }
      ]
    };
  }, [match, cmsPlayerMap]);

  if (!isOpen) return null;

  const isMatchOver = phase === 'match_completed';
  const headline = isMatchOver ? 'Match Summary' : 'Innings Summary';
  const phaseSubtitle = isMatchOver
    ? match.statusText || 'Full-Time Match Summary'
    : match.target
    ? `Innings Break · Target ${match.target}`
    : match.statusText || 'End of Innings';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-summary-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#0a1329]/95 border border-slate-300 dark:border-sky-400/30 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-auto text-slate-950 dark:text-white">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span
                className={
                  isMatchOver
                    ? 'text-amber-700 dark:text-amber-300 font-bold'
                    : 'text-sky-700 dark:text-sky-300 font-bold'
                }
              >
                {isMatchOver ? 'Final Result' : 'Innings Break'}
              </span>
              {match.series && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{match.series}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{match.matchType}</span>
            </div>
            <h2
              id="match-summary-modal-title"
              className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight mt-0.5 flex items-center gap-2"
            >
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{headline}</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Match Summary"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700/80 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Result Line */}
        <div className="px-5 py-3 sm:px-6 bg-amber-50 dark:bg-slate-950/65 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-2.5">
          <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 tracking-wide">
            {phaseSubtitle}
          </p>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Team Totals */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Team Totals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teamTotals.map(({ team, hasScore, inningsLabel }) => {
                const totalOversDecimal = team.score.overs + team.score.balls / 6;
                const rr =
                  hasScore && totalOversDecimal > 0
                    ? (team.score.runs / totalOversDecimal).toFixed(2)
                    : null;

                return (
                  <div
                    key={`${team.code}_${inningsLabel}`}
                    className="bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800/90 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamFlag
                        teamName={team.name}
                        teamCode={team.code}
                        logoUrl={team.logoUrl}
                        size="md"
                        className="border border-slate-300 dark:border-slate-600/80 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          {inningsLabel}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate">
                          {team.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {hasScore ? (
                        <>
                          <div className="font-score text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-none">
                            {team.score.runs}/{team.score.wickets}
                          </div>
                          <div className="text-[11px] font-score text-slate-600 dark:text-slate-400 mt-1">
                            {team.score.overs}.{team.score.balls} ov
                            {rr ? ` · RR ${rr}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Yet to Bat
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Scorer & Best Bowler */}
          {(topScorer || bestBowler) && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Top Performers
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Scorer Card */}
                {topScorer && (
                  <div className="bg-amber-50/70 dark:bg-slate-950/70 border border-amber-400/50 dark:border-amber-400/25 rounded-xl p-4 flex items-center gap-3.5">
                    <PlayerAvatar
                      playerId={topScorer.playerId}
                      name={topScorer.name}
                      teamCode={topScorer.teamCode}
                      imageUrl={topScorer.imageUrl}
                      size="md"
                      ringVariant="gold"
                      showJerseyNumber={false}
                      showStrikeBadge={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Top Scorer · {topScorer.teamCode}
                      </div>
                      <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate mt-0.5">
                        {topScorer.name}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-score text-xl font-black text-amber-700 dark:text-amber-300 leading-none">
                          {topScorer.runs}
                          {topScorer.isNotOut ? '*' : ''}
                        </span>
                        <span className="font-score text-xs text-slate-600 dark:text-slate-400">
                          ({topScorer.balls}b)
                        </span>
                      </div>
                      <div className="text-[11px] font-score text-slate-600 dark:text-slate-400 mt-1">
                        4s {topScorer.fours} · 6s {topScorer.sixes} · SR{' '}
                        {topScorer.strikeRate.toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Best Bowler Card */}
                {bestBowler && (
                  <div className="bg-emerald-50/70 dark:bg-slate-950/70 border border-emerald-500/40 dark:border-emerald-400/25 rounded-xl p-4 flex items-center gap-3.5">
                    <PlayerAvatar
                      playerId={bestBowler.playerId}
                      name={bestBowler.name}
                      teamCode={bestBowler.teamCode}
                      imageUrl={bestBowler.imageUrl}
                      size="md"
                      ringVariant="green"
                      showJerseyNumber={false}
                      showStrikeBadge={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Best Bowler · {bestBowler.teamCode}
                      </div>
                      <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate mt-0.5">
                        {bestBowler.name}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-score text-xl font-black text-emerald-700 dark:text-emerald-300 leading-none">
                          {bestBowler.wickets}/{bestBowler.runs}
                        </span>
                        <span className="font-score text-xs text-slate-600 dark:text-slate-400">
                          ({bestBowler.overs} ov)
                        </span>
                      </div>
                      <div className="text-[11px] font-score text-slate-600 dark:text-slate-400 mt-1">
                        Econ {bestBowler.economy.toFixed(2)} · Maidens {bestBowler.maidens}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="px-5 py-3.5 sm:px-6 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {match.venue || match.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Back to Broadcast
          </button>
        </div>
      </div>
    </div>
  );
};
