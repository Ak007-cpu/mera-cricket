import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchState, BattingScorecardRow } from '../types/cricket';

export type AutoBallEventType =
  | 'dot'
  | 'single'
  | 'two'
  | 'three'
  | 'four'
  | 'six'
  | 'wicket'
  | 'wide'
  | 'no-ball'
  | 'bye'
  | 'leg-bye';

export interface ActiveAutoBallEvent {
  type: AutoBallEventType;
  headline: string;
  subline: string;
  durationMs: 1000 | 3000;
  key: number;
  isReplay?: boolean;
}

function getTotalBalls(match: MatchState): number {
  const overs = Number(match.battingTeam?.score?.overs || 0);
  const balls = Number(match.battingTeam?.score?.balls || 0);
  return overs * 6 + balls;
}

function findBatterInScorecard(
  match: MatchState,
  nameOrId: string
): BattingScorecardRow | undefined {
  const target = nameOrId.trim().toLowerCase();
  if (!target) return undefined;
  const rows = [
    ...(match.scorecards?.secondInnings?.batting || []),
    ...(match.scorecards?.firstInnings?.batting || [])
  ];
  return rows.find(
    (r) =>
      r.playerId?.toLowerCase() === target ||
      r.name?.trim().toLowerCase() === target
  );
}

function resolveDismissedBatterSummary(prev: MatchState, curr: MatchState): string {
  const currBall = curr.recentBalls?.[0];
  const prevStriker = prev.striker;
  const prevNonStriker = prev.nonStriker;
  const currStrikerName = curr.striker?.name?.trim().toLowerCase();
  const currNonStrikerName = curr.nonStriker?.name?.trim().toLowerCase();

  let outName = currBall?.batsmanName?.trim() || '';
  let outRuns: number | undefined;
  let outBalls: number | undefined;

  // Check if striker or non-striker from previous snapshot got replaced
  const strikerStillAtCrease =
    prevStriker?.name &&
    (prevStriker.name.trim().toLowerCase() === currStrikerName ||
      prevStriker.name.trim().toLowerCase() === currNonStrikerName);

  const nonStrikerStillAtCrease =
    prevNonStriker?.name &&
    (prevNonStriker.name.trim().toLowerCase() === currStrikerName ||
      prevNonStriker.name.trim().toLowerCase() === currNonStrikerName);

  if (!strikerStillAtCrease && prevStriker?.name) {
    outName = prevStriker.name;
    outRuns = prevStriker.runs;
    outBalls = prevStriker.balls;
  } else if (!nonStrikerStillAtCrease && prevNonStriker?.name) {
    outName = prevNonStriker.name;
    outRuns = prevNonStriker.runs;
    outBalls = prevNonStriker.balls;
  } else if (outName) {
    const norm = outName.toLowerCase();
    if (prevStriker?.name?.trim().toLowerCase() === norm) {
      outRuns = prevStriker.runs;
      outBalls = prevStriker.balls;
    } else if (prevNonStriker?.name?.trim().toLowerCase() === norm) {
      outRuns = prevNonStriker.runs;
      outBalls = prevNonStriker.balls;
    }
  }

  // Prefer finalized scorecard stats if present
  if (outName) {
    const scRow = findBatterInScorecard(curr, outName);
    if (scRow) {
      outName = scRow.name;
      outRuns = scRow.runs;
      outBalls = scRow.balls;
    }
  }

  const teamCode = curr.battingTeam.shortName || curr.battingTeam.code;
  const scorePart = `${teamCode} ${curr.battingTeam.score.runs}/${curr.battingTeam.score.wickets}`;

  if (outName && outRuns !== undefined) {
    const ballsText = outBalls !== undefined ? ` (${outBalls}b)` : '';
    return `${outName} ${outRuns}${ballsText} • ${scorePart}`;
  }
  if (outName) {
    return `${outName} • ${scorePart}`;
  }
  return scorePart;
}

export function useAutoBallAnimation(
  match: MatchState | null,
  enabled: boolean = true
) {
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  const [activeBallEvent, setActiveBallEvent] = useState<ActiveAutoBallEvent | null>(null);

  const prevMatchRef = useRef<MatchState | null>(null);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Immediately clear any running animation if admin disables Ball Animation
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActiveBallEvent(null);
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!match) {
      prevMatchRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActiveBallEvent(null);
      return;
    }

    const prev = prevMatchRef.current;

    // First mount, page refresh, or match/innings switch: set baseline silently (NO animation)
    if (
      !prev ||
      prev.matchId !== match.matchId ||
      prev.currentInnings !== match.currentInnings
    ) {
      prevMatchRef.current = match;
      return;
    }

    const prevRuns = Number(prev.battingTeam?.score?.runs || 0);
    const currRuns = Number(match.battingTeam?.score?.runs || 0);
    const prevWickets = Number(prev.battingTeam?.score?.wickets || 0);
    const currWickets = Number(match.battingTeam?.score?.wickets || 0);
    const prevBalls = getTotalBalls(prev);
    const currBalls = getTotalBalls(match);

    const deltaRuns = currRuns - prevRuns;
    const deltaWickets = currWickets - prevWickets;
    const deltaBalls = currBalls - prevBalls;

    const prevBallId = prev.recentBalls?.[0]?.id || '';
    const currBall = match.recentBalls?.[0];
    const currBallId = currBall?.id || '';
    const hasNewBallRecord = Boolean(currBallId && currBallId !== prevBallId);

    // Update baseline before deciding whether to animate
    prevMatchRef.current = match;

    if (deltaRuns === 0 && deltaWickets === 0 && deltaBalls === 0 && !hasNewBallRecord) {
      return;
    }

    if (enabled && (deltaRuns !== 0 || deltaWickets !== 0 || deltaBalls !== 0)) {
      setScoreAnimKey((k) => k + 1);
    }

    if (!enabled) {
      return;
    }

    // Ambiguous / rollback / multi-ball catchup guard: show nothing if diff is unclear
    if (
      deltaRuns < 0 ||
      deltaWickets < 0 ||
      deltaBalls < 0 ||
      deltaWickets > 1 ||
      deltaBalls > 2 ||
      deltaRuns > 7
    ) {
      return;
    }

    const batterLabel = currBall?.batsmanName || match.striker?.name || '';
    const bowlerLabel = currBall?.bowlerName || match.currentBowler?.name || '';
    const overLabel = currBall?.ballNumber
      ? `Over ${currBall.ballNumber}`
      : `${match.battingTeam.score.overs}.${match.battingTeam.score.balls} ov`;
    const defaultSubline =
      batterLabel && bowlerLabel
        ? `${batterLabel} vs ${bowlerLabel} • ${overLabel}`
        : overLabel;

    let nextEvent: Omit<ActiveAutoBallEvent, 'key'> | null = null;

    // 1. WICKET (3s)
    if (deltaWickets === 1 || (hasNewBallRecord && currBall?.isWicket && deltaWickets <= 1)) {
      nextEvent = {
        type: 'wicket',
        headline: 'WICKET!',
        subline: resolveDismissedBatterSummary(prev, match),
        durationMs: 3000
      };
    }
    // 2. EXTRAS: Wide / No ball / Bye / Leg bye — ONLY show when explicit extraType data is clear
    else if (hasNewBallRecord && currBall?.isExtra && currBall.extraType) {
      const ex = currBall.extraType;
      if (ex === 'wide' && deltaBalls === 0 && deltaRuns >= 1 && deltaRuns <= 5) {
        nextEvent = {
          type: 'wide',
          headline: deltaRuns > 1 ? `WIDE +${deltaRuns}` : 'WIDE!',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (ex === 'no-ball' && deltaBalls === 0 && deltaRuns >= 1 && deltaRuns <= 7) {
        nextEvent = {
          type: 'no-ball',
          headline: deltaRuns > 1 ? `NO BALL +${deltaRuns}` : 'NO BALL!',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (ex === 'bye' && deltaBalls >= 1 && deltaBalls <= 2 && deltaRuns >= 1 && deltaRuns <= 4) {
        nextEvent = {
          type: 'bye',
          headline: deltaRuns > 1 ? `${deltaRuns} BYES` : 'BYE',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (ex === 'leg-bye' && deltaBalls >= 1 && deltaBalls <= 2 && deltaRuns >= 1 && deltaRuns <= 4) {
        nextEvent = {
          type: 'leg-bye',
          headline: deltaRuns > 1 ? `${deltaRuns} LEG BYES` : 'LEG BYE',
          subline: defaultSubline,
          durationMs: 1000
        };
      }
    }
    // 3. LIVE SCORE-DRIVEN DELIVERIES (single on 1, four on 4, six on 6, dot on legal 0)
    else if (deltaWickets === 0 && (deltaBalls >= 1 || (deltaRuns >= 1 && deltaRuns <= 6))) {
      if (deltaRuns === 6) {
        nextEvent = {
          type: 'six',
          headline: 'SIX!',
          subline: defaultSubline,
          durationMs: 3000
        };
      } else if (deltaRuns === 5) {
        nextEvent = {
          type: 'four',
          headline: '5 RUNS!',
          subline: defaultSubline,
          durationMs: 3000
        };
      } else if (deltaRuns === 4) {
        nextEvent = {
          type: 'four',
          headline: 'FOUR!',
          subline: defaultSubline,
          durationMs: 3000
        };
      } else if (deltaRuns === 3) {
        nextEvent = {
          type: 'three',
          headline: 'THREE RUNS',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (deltaRuns === 2) {
        nextEvent = {
          type: 'two',
          headline: 'TWO RUNS',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (deltaRuns === 1) {
        nextEvent = {
          type: 'single',
          headline: 'SINGLE',
          subline: defaultSubline,
          durationMs: 1000
        };
      } else if (deltaRuns === 0 && deltaBalls >= 1) {
        nextEvent = {
          type: 'dot',
          headline: 'DOT BALL',
          subline: defaultSubline,
          durationMs: 1000
        };
      }
    }

    if (!nextEvent) {
      return;
    }

    // Cancel any active animation timer immediately so new update takes over cleanly
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const key = ++seqRef.current;
    setActiveBallEvent({ ...nextEvent, key, isReplay: false });

    timerRef.current = setTimeout(() => {
      setActiveBallEvent((curr) => (curr && curr.key === key ? null : curr));
      timerRef.current = null;
    }, nextEvent.durationMs);
  }, [match, enabled]);

  const triggerReplay = useCallback((event: Omit<ActiveAutoBallEvent, 'key' | 'isReplay'>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const key = ++seqRef.current;
    setActiveBallEvent({ ...event, key, isReplay: true });

    timerRef.current = setTimeout(() => {
      setActiveBallEvent((curr) => (curr && curr.key === key ? null : curr));
      timerRef.current = null;
    }, event.durationMs);
  }, []);

  return {
    scoreAnimKey,
    activeBallEvent,
    triggerReplay
  };
}
