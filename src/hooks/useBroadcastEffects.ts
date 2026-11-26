import { useEffect, useRef, useState } from 'react';
import { MatchState } from '../types/cricket';

export type BroadcastFlashType = 'four' | 'six' | 'wicket';
export type BroadcastMilestoneType = 'fifty' | 'century';

export interface ActiveBroadcastEvent {
  type: BroadcastFlashType;
  label: string;
  subtitle: string;
  scoreText: string;
  key: number;
}

export interface ActiveBroadcastMilestone {
  type: BroadcastMilestoneType;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  teamCode: string;
  imageUrl?: string;
  key: number;
}

export function useBroadcastEffects(
  match: MatchState | null,
  animationsEnabled: boolean = true
) {
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  const [flashEvent, setFlashEvent] = useState<{ type: BroadcastFlashType | null; key: number }>({
    type: null,
    key: 0
  });
  const [activeEvent, setActiveEvent] = useState<ActiveBroadcastEvent | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<ActiveBroadcastMilestone | null>(null);

  const hasInitializedRef = useRef(false);
  const prevMatchIdRef = useRef<string>('');
  const prevScoreSigRef = useRef<string>('');
  const prevBallIdRef = useRef<string>('');
  const prevAlertIdRef = useRef<string>('');
  const prevBatterRunsRef = useRef<Map<string, number>>(new Map());

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Immediately clear transient overlays if admin turns animations OFF
  useEffect(() => {
    if (!animationsEnabled) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
      setFlashEvent({ type: null, key: 0 });
      setActiveEvent(null);
      setActiveMilestone(null);
    }
  }, [animationsEnabled]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!match) return;

    const currentMatchId = match.matchId || '';
    const scoreSig = `${match.battingTeam.score.runs}/${match.battingTeam.score.wickets}-${match.battingTeam.score.overs}.${match.battingTeam.score.balls}`;
    const latestBall = match.recentBalls?.[0];
    const latestBallId = latestBall?.id || '';
    const alert = match.notificationAlert;
    const alertId = alert?.id || '';

    const strikerKey = (match.striker.playerId || match.striker.name || '').trim().toLowerCase();
    const nonStrikerKey = (match.nonStriker.playerId || match.nonStriker.name || '').trim().toLowerCase();

    // Reset baseline when switching to a brand new match or on first mount
    if (!hasInitializedRef.current || (prevMatchIdRef.current && prevMatchIdRef.current !== currentMatchId)) {
      hasInitializedRef.current = true;
      prevMatchIdRef.current = currentMatchId;
      prevScoreSigRef.current = scoreSig;
      prevBallIdRef.current = latestBallId;
      prevAlertIdRef.current = alertId;
      prevBatterRunsRef.current = new Map();
      if (strikerKey) prevBatterRunsRef.current.set(strikerKey, match.striker.runs);
      if (nonStrikerKey) prevBatterRunsRef.current.set(nonStrikerKey, match.nonStriker.runs);
      return;
    }

    // Smooth score number animation trigger
    if (prevScoreSigRef.current && prevScoreSigRef.current !== scoreSig) {
      if (animationsEnabled) {
        setScoreAnimKey((k) => k + 1);
      }
    }
    prevScoreSigRef.current = scoreSig;

    // Detect 4 / 6 / Wicket from latest ball or live alert
    let detectedEvent: BroadcastFlashType | null = null;
    let eventBatsman = match.striker?.name || 'Batter';
    let eventBowler = match.currentBowler?.name || 'Bowler';

    if (latestBallId && prevBallIdRef.current !== latestBallId) {
      if (latestBall.isWicket) {
        detectedEvent = 'wicket';
        eventBatsman = latestBall.batsmanName || eventBatsman;
        eventBowler = latestBall.bowlerName || eventBowler;
      } else if (latestBall.isSix) {
        detectedEvent = 'six';
        eventBatsman = latestBall.batsmanName || eventBatsman;
        eventBowler = latestBall.bowlerName || eventBowler;
      } else if (latestBall.isFour) {
        detectedEvent = 'four';
        eventBatsman = latestBall.batsmanName || eventBatsman;
        eventBowler = latestBall.bowlerName || eventBowler;
      }
    } else if (alertId && prevAlertIdRef.current !== alertId) {
      if (alert?.type === 'wicket') detectedEvent = 'wicket';
      else if (alert?.type === 'six') detectedEvent = 'six';
      else if (alert?.type === 'four') detectedEvent = 'four';
    }

    // Detect Fifty / Century milestones (via live alert OR batter crossing 50 / 100 organically)
    let detectedMilestone: Omit<ActiveBroadcastMilestone, 'key'> | null = null;

    if (alertId && prevAlertIdRef.current !== alertId) {
      if (alert?.type === 'century') {
        detectedMilestone = {
          type: 'century',
          playerName: match.striker.runs >= 100 ? match.striker.name : match.nonStriker.runs >= 100 ? match.nonStriker.name : match.striker.name,
          runs: match.striker.runs >= 100 ? match.striker.runs : Math.max(100, match.striker.runs),
          balls: match.striker.balls,
          fours: match.striker.fours,
          sixes: match.striker.sixes,
          teamCode: match.battingTeam.code,
          imageUrl: match.striker.imageUrl
        };
      } else if (alert?.type === 'fifty') {
        detectedMilestone = {
          type: 'fifty',
          playerName: match.striker.runs >= 50 ? match.striker.name : match.nonStriker.runs >= 50 ? match.nonStriker.name : match.striker.name,
          runs: match.striker.runs >= 50 ? match.striker.runs : Math.max(50, match.striker.runs),
          balls: match.striker.balls,
          fours: match.striker.fours,
          sixes: match.striker.sixes,
          teamCode: match.battingTeam.code,
          imageUrl: match.striker.imageUrl
        };
      }
    }

    // Organic batter runs threshold crossing check (50 & 100)
    if (!detectedMilestone) {
      for (const [bKey, batter] of [
        [strikerKey, match.striker],
        [nonStrikerKey, match.nonStriker]
      ] as const) {
        if (!bKey || !batter) continue;
        const prevRuns = prevBatterRunsRef.current.get(bKey);
        if (prevRuns !== undefined) {
          if (prevRuns < 100 && batter.runs >= 100) {
            detectedMilestone = {
              type: 'century',
              playerName: batter.name,
              runs: batter.runs,
              balls: batter.balls,
              fours: batter.fours,
              sixes: batter.sixes,
              teamCode: match.battingTeam.code,
              imageUrl: batter.imageUrl
            };
            break;
          }
          if (prevRuns < 50 && batter.runs >= 50) {
            detectedMilestone = {
              type: 'fifty',
              playerName: batter.name,
              runs: batter.runs,
              balls: batter.balls,
              fours: batter.fours,
              sixes: batter.sixes,
              teamCode: match.battingTeam.code,
              imageUrl: batter.imageUrl
            };
            break;
          }
        }
      }
    }

    // Update refs after checks
    if (latestBallId) prevBallIdRef.current = latestBallId;
    if (alertId) prevAlertIdRef.current = alertId;
    if (strikerKey) prevBatterRunsRef.current.set(strikerKey, match.striker.runs);
    if (nonStrikerKey) prevBatterRunsRef.current.set(nonStrikerKey, match.nonStriker.runs);

    if (!animationsEnabled) return;

    if (detectedEvent) {
      const nowKey = Date.now();
      setFlashEvent({ type: detectedEvent, key: nowKey });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashEvent({ type: null, key: nowKey });
      }, 950);

      const scoreText = `${match.battingTeam.code} ${match.battingTeam.score.runs}/${match.battingTeam.score.wickets}`;
      const label =
        detectedEvent === 'four' ? 'FOUR!' : detectedEvent === 'six' ? 'SIX!' : 'WICKET!';
      const subtitle =
        detectedEvent === 'wicket'
          ? `${eventBatsman} • Bowled by ${eventBowler}`
          : detectedEvent === 'six'
          ? `${eventBatsman} launches it off ${eventBowler}`
          : `${eventBatsman} finds the fence off ${eventBowler}`;

      setActiveEvent({
        type: detectedEvent,
        label,
        subtitle,
        scoreText,
        key: nowKey
      });

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setActiveEvent(null);
      }, 3000);
    }

    if (detectedMilestone) {
      const nowKey = Date.now() + 1;
      setActiveMilestone({
        ...detectedMilestone,
        key: nowKey
      });
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
      milestoneTimerRef.current = setTimeout(() => {
        setActiveMilestone(null);
      }, 4000);
    }
  }, [match, animationsEnabled]);

  return {
    scoreAnimKey,
    flashEvent,
    activeEvent,
    activeMilestone
  };
}
