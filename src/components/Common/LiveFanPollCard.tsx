import React, { useEffect, useState } from 'react';
import { MatchPollChoice, MatchPollData, MatchState } from '../../types/cricket';
import { castMatchPollVote, subscribeMatchPoll } from '../../services/firebaseContentService';
import { TeamFlag } from '../TeamFlag';
import { CheckCircle2, Flame, Vote } from 'lucide-react';

interface LiveFanPollCardProps {
  match: MatchState;
  variant?: 'broadcast' | 'mobile';
  isDemoPreview?: boolean;
}

function getPollStorageKey(matchId: string): string {
  return `crex_fan_poll_vote_${matchId.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
}

export const LiveFanPollCard: React.FC<LiveFanPollCardProps> = ({
  match,
  variant = 'broadcast',
  isDemoPreview = false
}) => {
  const pollKeyId = match.matchId || 'live_match';
  const isTestMatch = match.matchType === 'TEST';

  const [pollData, setPollData] = useState<MatchPollData | null>(null);
  const [userChoice, setUserChoice] = useState<MatchPollChoice | null>(() => {
    try {
      const saved = localStorage.getItem(getPollStorageKey(pollKeyId));
      if (saved === 'team1' || saved === 'team2' || saved === 'draw') return saved;
    } catch {}
    return null;
  });
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getPollStorageKey(pollKeyId));
      setUserChoice(saved === 'team1' || saved === 'team2' || saved === 'draw' ? saved : null);
    } catch {
      setUserChoice(null);
    }
    setVoteError(null);

    if (isDemoPreview) return;
    const unsub = subscribeMatchPoll(
      pollKeyId,
      (data) => setPollData(data),
      () => {}
    );
    return () => unsub();
  }, [pollKeyId, isDemoPreview]);

  // Keep consistent Team 1 / Team 2 ordering even if innings switches
  const firstBattingCode = match.scorecards?.firstInnings?.teamCode;
  const teamA =
    firstBattingCode && firstBattingCode.toUpperCase() === match.bowlingTeam.code.toUpperCase()
      ? match.bowlingTeam
      : match.battingTeam;
  const teamB =
    teamA.code.toUpperCase() === match.battingTeam.code.toUpperCase()
      ? match.bowlingTeam
      : match.battingTeam;

  const t1Votes = pollData?.team1Votes ?? 0;
  const t2Votes = pollData?.team2Votes ?? 0;
  const drawVotes = pollData?.drawVotes ?? 0;
  const totalVotes = t1Votes + t2Votes + drawVotes;

  const t1Pct = totalVotes > 0 ? Math.round((t1Votes / totalVotes) * 100) : 50;
  const drawPct =
    isTestMatch && totalVotes > 0 ? Math.round((drawVotes / totalVotes) * 100) : 0;
  const t2Pct =
    totalVotes > 0 ? Math.max(0, 100 - t1Pct - (isTestMatch ? drawPct : 0)) : 50;

  const handleVote = async (choice: MatchPollChoice) => {
    if (isVoting || userChoice) return;
    setVoteError(null);
    setIsVoting(true);

    // Optimistic local state + lock in localStorage immediately
    const prevPoll = pollData;
    setUserChoice(choice);
    try {
      localStorage.setItem(getPollStorageKey(pollKeyId), choice);
    } catch {}

    setPollData((curr) => {
      const base: MatchPollData = curr || {
        id: pollKeyId,
        matchId: pollKeyId,
        team1Code: teamA.shortName || teamA.code,
        team1Name: teamA.name,
        team2Code: teamB.shortName || teamB.code,
        team2Name: teamB.name,
        team1Votes: 0,
        team2Votes: 0,
        drawVotes: 0
      };
      return {
        ...base,
        team1Votes: base.team1Votes + (choice === 'team1' ? 1 : 0),
        team2Votes: base.team2Votes + (choice === 'team2' ? 1 : 0),
        drawVotes: base.drawVotes + (choice === 'draw' ? 1 : 0)
      };
    });

    if (isDemoPreview) {
      setIsVoting(false);
      return;
    }

    try {
      await castMatchPollVote({
        matchId: pollKeyId,
        team1Code: teamA.shortName || teamA.code,
        team1Name: teamA.name,
        team2Code: teamB.shortName || teamB.code,
        team2Name: teamB.name,
        choice
      });
    } catch {
      setPollData(prevPoll);
      setUserChoice(null);
      try {
        localStorage.removeItem(getPollStorageKey(pollKeyId));
      } catch {}
      setVoteError('Vote save nahi ho saka — dobara tap karein.');
    } finally {
      setIsVoting(false);
    }
  };

  const isMobile = variant === 'mobile';

  return (
    <div
      className={`bg-white dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-sm dark:shadow-xl flex flex-col justify-between ${
        isMobile ? 'p-3 space-y-2.5' : 'p-3.5 sm:p-4 h-full space-y-3'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-400/70 dark:border-amber-400/40 flex items-center justify-center shrink-0">
            <Vote className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider truncate">
              Fan Poll — Who Will Win?
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              {userChoice
                ? `Aapka vote save ho gaya (${
                    userChoice === 'team1'
                      ? teamA.shortName || teamA.code
                      : userChoice === 'team2'
                      ? teamB.shortName || teamB.code
                      : 'Draw'
                  })`
                : 'Apni favourite team ko live vote dein'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-800 font-score text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
          <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>{totalVotes.toLocaleString()} {totalVotes === 1 ? 'Vote' : 'Votes'}</span>
        </div>
      </div>

      {/* Voting Buttons */}
      <div className={`grid ${isTestMatch ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
        {/* Team 1 Vote Button */}
        <button
          type="button"
          disabled={isVoting || Boolean(userChoice)}
          onClick={() => handleVote('team1')}
          className={`group relative overflow-hidden rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
            userChoice === 'team1'
              ? 'bg-emerald-50 dark:bg-emerald-950/55 border-emerald-600 dark:border-emerald-400 shadow-sm dark:shadow-[0_0_18px_rgba(16,185,129,0.25)]'
              : userChoice
              ? 'bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 opacity-85'
              : 'bg-slate-50 dark:bg-slate-950/90 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-400/70 active:scale-[0.98]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamFlag
                teamName={teamA.name}
                teamCode={teamA.code}
                logoUrl={teamA.logoUrl}
                size="xs"
              />
              <span className="font-black text-xs sm:text-sm text-slate-950 dark:text-white truncate">
                {teamA.shortName || teamA.code}
              </span>
            </div>
            {userChoice === 'team1' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="font-score text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300">
              {t1Pct}%
            </span>
            <span className="text-[10px] font-score text-slate-600 dark:text-slate-400">
              {t1Votes}
            </span>
          </div>
        </button>

        {/* Optional Draw Vote (Test Matches) */}
        {isTestMatch && (
          <button
            type="button"
            disabled={isVoting || Boolean(userChoice)}
            onClick={() => handleVote('draw')}
            className={`group relative overflow-hidden rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
              userChoice === 'draw'
                ? 'bg-amber-50 dark:bg-amber-950/55 border-amber-600 dark:border-amber-400 shadow-sm dark:shadow-[0_0_18px_rgba(251,191,36,0.25)]'
                : userChoice
                ? 'bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 opacity-85'
                : 'bg-slate-50 dark:bg-slate-950/90 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-amber-600 dark:hover:border-amber-400/70 active:scale-[0.98]'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">DRAW</span>
              {userChoice === 'draw' && (
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-1">
              <span className="font-score text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300">
                {drawPct}%
              </span>
              <span className="text-[10px] font-score text-slate-600 dark:text-slate-400">{drawVotes}</span>
            </div>
          </button>
        )}

        {/* Team 2 Vote Button */}
        <button
          type="button"
          disabled={isVoting || Boolean(userChoice)}
          onClick={() => handleVote('team2')}
          className={`group relative overflow-hidden rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
            userChoice === 'team2'
              ? 'bg-sky-50 dark:bg-sky-950/55 border-sky-600 dark:border-sky-400 shadow-sm dark:shadow-[0_0_18px_rgba(56,189,248,0.25)]'
              : userChoice
              ? 'bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 opacity-85'
              : 'bg-slate-50 dark:bg-slate-950/90 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-sky-600 dark:hover:border-sky-400/70 active:scale-[0.98]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamFlag
                teamName={teamB.name}
                teamCode={teamB.code}
                logoUrl={teamB.logoUrl}
                size="xs"
              />
              <span className="font-black text-xs sm:text-sm text-slate-950 dark:text-white truncate">
                {teamB.shortName || teamB.code}
              </span>
            </div>
            {userChoice === 'team2' && (
              <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="font-score text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300">
              {t2Pct}%
            </span>
            <span className="text-[10px] font-score text-slate-600 dark:text-slate-400">
              {t2Votes}
            </span>
          </div>
        </button>
      </div>

      {/* Live Split Progress Bar */}
      <div className="space-y-1">
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 transition-all duration-500"
            style={{ width: `${t1Pct}%` }}
          />
          {isTestMatch && drawPct > 0 && (
            <div
              className="h-full bg-amber-500 dark:bg-amber-400 transition-all duration-500"
              style={{ width: `${drawPct}%` }}
            />
          )}
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500 transition-all duration-500"
            style={{ width: `${t2Pct}%` }}
          />
        </div>
        {voteError && (
          <p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">{voteError}</p>
        )}
      </div>
    </div>
  );
};
