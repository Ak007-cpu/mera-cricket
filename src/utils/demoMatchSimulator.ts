import {
  MatchState,
  BallEvent,
  BattingScorecardRow,
  BowlingScorecardRow
} from '../types/cricket';

export type DemoSpeed = 'slow' | 'normal' | 'fast';
export type DemoBallOutcome =
  | 'dot'
  | '1'
  | '2'
  | '3'
  | '4'
  | '6'
  | 'wicket'
  | 'wide'
  | 'no-ball';

export type DemoMatchStatePreset =
  | 'live_chase'
  | 'tight_finish'
  | 'innings_break'
  | 'match_won'
  | 'no_match';

export const SPEED_MS: Record<DemoSpeed, number> = {
  slow: 5500,
  normal: 3500,
  fast: 1500
};

const TEAM_A_BATTERS = [
  { playerId: 'demo_a_1', name: 'Aarav Khan', shortName: 'A. Khan', jerseyNumber: 18 },
  { playerId: 'demo_a_2', name: 'Rohan Sharma', shortName: 'R. Sharma', jerseyNumber: 45 },
  { playerId: 'demo_a_3', name: 'Sohaib Malik', shortName: 'S. Malik', jerseyNumber: 7 },
  { playerId: 'demo_a_4', name: 'Danish Verma', shortName: 'D. Verma', jerseyNumber: 33 },
  { playerId: 'demo_a_5', name: 'Kamil Raza', shortName: 'K. Raza', jerseyNumber: 12 },
  { playerId: 'demo_a_6', name: 'Hamza Ali', shortName: 'H. Ali', jerseyNumber: 9 },
  { playerId: 'demo_a_7', name: 'Zain Ahmed', shortName: 'Z. Ahmed', jerseyNumber: 24 },
  { playerId: 'demo_a_8', name: 'Bilal Tariq', shortName: 'B. Tariq', jerseyNumber: 55 },
  { playerId: 'demo_a_9', name: 'Usman Shah', shortName: 'U. Shah', jerseyNumber: 99 },
  { playerId: 'demo_a_10', name: 'Faizan Mir', shortName: 'F. Mir', jerseyNumber: 11 },
  { playerId: 'demo_a_11', name: 'Tariq Noor', shortName: 'T. Noor', jerseyNumber: 3 }
];

const TEAM_B_BOWLERS = [
  { playerId: 'demo_b_1', name: 'Mitchell Vance', shortName: 'M. Vance', jerseyNumber: 56 },
  { playerId: 'demo_b_2', name: 'Jofra Cole', shortName: 'J. Cole', jerseyNumber: 22 },
  { playerId: 'demo_b_3', name: 'Rashid Qureshi', shortName: 'R. Qureshi', jerseyNumber: 19 },
  { playerId: 'demo_b_4', name: 'Shaheen Baig', shortName: 'S. Baig', jerseyNumber: 10 }
];

export function createInitialDemoMatch(): MatchState {
  const now = Date.now();
  const initialRuns = 128;
  const initialWickets = 3;
  const overs = 14;
  const balls = 2;
  const target = 186;
  const totalOversFloat = overs + balls / 6;
  const remainingBalls = 20 * 6 - (overs * 6 + balls);
  const requiredRuns = target - initialRuns;
  const crr = Number((initialRuns / totalOversFloat).toFixed(2));
  const rrr = Number(((requiredRuns * 6) / remainingBalls).toFixed(2));

  const striker = {
    playerId: TEAM_A_BATTERS[3].playerId,
    name: TEAM_A_BATTERS[3].name,
    shortName: TEAM_A_BATTERS[3].shortName,
    jerseyNumber: TEAM_A_BATTERS[3].jerseyNumber,
    runs: 42,
    balls: 26,
    fours: 4,
    sixes: 2,
    strikeRate: Number(((42 / 26) * 100).toFixed(1)),
    isOnStrike: true
  };

  const nonStriker = {
    playerId: TEAM_A_BATTERS[4].playerId,
    name: TEAM_A_BATTERS[4].name,
    shortName: TEAM_A_BATTERS[4].shortName,
    jerseyNumber: TEAM_A_BATTERS[4].jerseyNumber,
    runs: 21,
    balls: 15,
    fours: 2,
    sixes: 0,
    strikeRate: Number(((21 / 15) * 100).toFixed(1)),
    isOnStrike: false
  };

  const currentBowler = {
    playerId: TEAM_B_BOWLERS[0].playerId,
    name: TEAM_B_BOWLERS[0].name,
    shortName: TEAM_B_BOWLERS[0].shortName,
    jerseyNumber: TEAM_B_BOWLERS[0].jerseyNumber,
    overs: 3.2,
    maidens: 0,
    runs: 29,
    wickets: 1,
    economy: 8.7
  };

  const recentBalls: BallEvent[] = [
    {
      id: `demo_init_${now}_2`,
      ballNumber: '14.2',
      overNumber: 14,
      ballInOver: 2,
      runs: 4,
      isWicket: false,
      isFour: true,
      isSix: false,
      isExtra: false,
      batsmanName: striker.name,
      bowlerName: currentBowler.name,
      commentary: 'Crisp cover drive racing away to the boundary!',
      timestamp: now - 4000,
      pitchLength: 'full',
      pitchX: 78,
      pitchY: 28
    },
    {
      id: `demo_init_${now}_1`,
      ballNumber: '14.1',
      overNumber: 14,
      ballInOver: 1,
      runs: 1,
      isWicket: false,
      isFour: false,
      isSix: false,
      isExtra: false,
      batsmanName: nonStriker.name,
      bowlerName: currentBowler.name,
      commentary: 'Pushed gently into mid-on for a quick single.',
      timestamp: now - 8000,
      pitchLength: 'good',
      pitchX: 54,
      pitchY: 46
    }
  ];

  const battingRows: BattingScorecardRow[] = [
    {
      playerId: TEAM_A_BATTERS[0].playerId,
      name: TEAM_A_BATTERS[0].name,
      runs: 34,
      balls: 22,
      fours: 4,
      sixes: 1,
      strikeRate: 154.5,
      dismissal: 'c Cole b Vance',
      isNotOut: false
    },
    {
      playerId: TEAM_A_BATTERS[1].playerId,
      name: TEAM_A_BATTERS[1].name,
      runs: 18,
      balls: 14,
      fours: 2,
      sixes: 0,
      strikeRate: 128.6,
      dismissal: 'b Qureshi',
      isNotOut: false
    },
    {
      playerId: TEAM_A_BATTERS[2].playerId,
      name: TEAM_A_BATTERS[2].name,
      runs: 8,
      balls: 9,
      fours: 1,
      sixes: 0,
      strikeRate: 88.9,
      dismissal: 'lbw b Baig',
      isNotOut: false
    },
    {
      playerId: striker.playerId,
      name: striker.name,
      runs: striker.runs,
      balls: striker.balls,
      fours: striker.fours,
      sixes: striker.sixes,
      strikeRate: striker.strikeRate,
      dismissal: 'batting',
      isNotOut: true
    },
    {
      playerId: nonStriker.playerId,
      name: nonStriker.name,
      runs: nonStriker.runs,
      balls: nonStriker.balls,
      fours: nonStriker.fours,
      sixes: nonStriker.sixes,
      strikeRate: nonStriker.strikeRate,
      dismissal: 'batting',
      isNotOut: true
    }
  ];

  const bowlingRows: BowlingScorecardRow[] = [
    {
      playerId: TEAM_B_BOWLERS[0].playerId,
      name: TEAM_B_BOWLERS[0].name,
      overs: 3.2,
      maidens: 0,
      runs: 29,
      wickets: 1,
      economy: 8.7,
      noBalls: 0,
      wides: 1
    },
    {
      playerId: TEAM_B_BOWLERS[1].playerId,
      name: TEAM_B_BOWLERS[1].name,
      overs: 4,
      maidens: 0,
      runs: 36,
      wickets: 0,
      economy: 9.0,
      noBalls: 0,
      wides: 2
    },
    {
      playerId: TEAM_B_BOWLERS[2].playerId,
      name: TEAM_B_BOWLERS[2].name,
      overs: 4,
      maidens: 0,
      runs: 31,
      wickets: 1,
      economy: 7.75,
      noBalls: 0,
      wides: 0
    },
    {
      playerId: TEAM_B_BOWLERS[3].playerId,
      name: TEAM_B_BOWLERS[3].name,
      overs: 3,
      maidens: 0,
      runs: 27,
      wickets: 1,
      economy: 9.0,
      noBalls: 1,
      wides: 0
    }
  ];

  return {
    matchId: 'demo_sim_team_a_vs_team_b',
    title: 'Team A vs Team B — Demo T20 Showcase',
    matchType: 'T20',
    series: 'Studio Animation Test Match (Demo Mode)',
    venue: 'Champions National Stadium (Simulation)',
    toss: 'Team B won the toss and elected to bat',
    statusText: `Team A need ${requiredRuns} runs in ${remainingBalls} balls`,
    gameState: 'live',
    currentInnings: 2,
    target,
    requiredRuns,
    remainingBalls,
    currentRunRate: crr,
    requiredRunRate: rrr,
    battingTeam: {
      name: 'Team A',
      shortName: 'TMA',
      code: 'TMA',
      logoUrl: '',
      primaryColor: '#0284c7',
      secondaryColor: '#38bdf8',
      score: {
        runs: initialRuns,
        wickets: initialWickets,
        overs,
        balls
      }
    },
    bowlingTeam: {
      name: 'Team B',
      shortName: 'TMB',
      code: 'TMB',
      logoUrl: '',
      primaryColor: '#e11d48',
      secondaryColor: '#fb7185',
      score: {
        runs: 185,
        wickets: 6,
        overs: 20,
        balls: 0
      }
    },
    striker,
    nonStriker,
    currentBowler,
    recentBalls,
    currentPartnership: {
      runs: 49,
      balls: 31,
      player1Runs: 30,
      player2Runs: 19
    },
    lastUpdated: now,
    scorecards: {
      secondInnings: {
        teamName: 'Team A',
        teamCode: 'TMA',
        inningsNumber: 2,
        totalRuns: initialRuns,
        totalWickets: initialWickets,
        totalOvers: `${overs}.${balls}`,
        runRate: crr,
        extras: { total: 5, wides: 3, noBalls: 1, byes: 0, legByes: 1 },
        batting: battingRows,
        bowling: bowlingRows,
        fallOfWickets: [],
        yetToBat: TEAM_A_BATTERS.slice(5).map((p) => p.name)
      }
    }
  };
}

export function createDemoPresetMatch(preset: DemoMatchStatePreset): MatchState | null {
  if (preset === 'no_match') return null;
  const base = createInitialDemoMatch();

  if (preset === 'live_chase') {
    return base;
  }

  if (preset === 'tight_finish') {
    const runs = 180;
    const wickets = 7;
    const overs = 19;
    const balls = 2;
    const target = 186;
    const requiredRuns = target - runs;
    const remainingBalls = 4;
    return {
      ...base,
      gameState: 'live',
      statusText: `Team A need ${requiredRuns} runs in ${remainingBalls} balls`,
      requiredRuns,
      remainingBalls,
      currentRunRate: Number(((runs * 6) / (19 * 6 + 2)).toFixed(2)),
      requiredRunRate: Number(((requiredRuns * 6) / remainingBalls).toFixed(2)),
      battingTeam: {
        ...base.battingTeam,
        score: { runs, wickets, overs, balls }
      },
      striker: {
        ...base.striker,
        runs: 64,
        balls: 34,
        fours: 6,
        sixes: 4,
        strikeRate: 188.2
      }
    };
  }

  if (preset === 'innings_break') {
    return {
      ...base,
      gameState: 'innings_break',
      currentInnings: 1,
      statusText: 'Innings Break — Team A need 186 runs to win',
      requiredRuns: 186,
      remainingBalls: 120,
      battingTeam: {
        ...base.bowlingTeam,
        score: { runs: 185, wickets: 6, overs: 20, balls: 0 }
      },
      bowlingTeam: {
        ...base.battingTeam,
        score: { runs: 0, wickets: 0, overs: 0, balls: 0 }
      }
    };
  }

  // match_won
  return {
    ...base,
    gameState: 'completed',
    statusText: 'Team A won by 6 wickets',
    requiredRuns: 0,
    remainingBalls: 4,
    currentRunRate: 9.72,
    requiredRunRate: 0,
    battingTeam: {
      ...base.battingTeam,
      score: { runs: 188, wickets: 4, overs: 19, balls: 2 }
    },
    striker: {
      ...base.striker,
      runs: 78,
      balls: 41,
      fours: 7,
      sixes: 5,
      strikeRate: 190.2
    }
  };
}

function pickRandomOutcome(): DemoBallOutcome {
  const pool: DemoBallOutcome[] = [
    'dot',
    'dot',
    'dot',
    '1',
    '1',
    '1',
    '1',
    '2',
    '2',
    '3',
    '4',
    '4',
    '4',
    '6',
    '6',
    'wicket',
    'wide',
    'no-ball'
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function oversNotationToBalls(oversVal: number): number {
  const whole = Math.floor(oversVal);
  const rem = Math.round((oversVal - whole) * 10);
  return whole * 6 + Math.min(5, Math.max(0, rem));
}

function ballsToOversNotation(totalBalls: number): number {
  const whole = Math.floor(totalBalls / 6);
  const rem = totalBalls % 6;
  return Number(`${whole}.${rem}`);
}

export function simulateDemoDelivery(
  prev: MatchState,
  requestedOutcome?: DemoBallOutcome
): MatchState {
  // Auto-reset cleanly if simulated innings reached end so demo keeps flowing smoothly
  if (
    prev.gameState !== 'live' ||
    prev.battingTeam.score.wickets >= 10 ||
    prev.battingTeam.score.overs >= 20 ||
    (prev.target && prev.battingTeam.score.runs >= prev.target)
  ) {
    return createInitialDemoMatch();
  }

  const outcome = requestedOutcome || pickRandomOutcome();
  const now = Date.now();
  const uniqueSuffix = `${now}_${Math.floor(Math.random() * 100000)}`;

  const isWide = outcome === 'wide';
  const isNoBall = outcome === 'no-ball';
  const isExtra = isWide || isNoBall;
  const isWicket = outcome === 'wicket';
  const isFour = outcome === '4';
  const isSix = outcome === '6';
  const runsOnBat =
    outcome === '1'
      ? 1
      : outcome === '2'
      ? 2
      : outcome === '3'
      ? 3
      : outcome === '4'
      ? 4
      : outcome === '6'
      ? 6
      : 0;
  const totalRunsAdded = isExtra ? 1 : runsOnBat;

  const curScore = prev.battingTeam.score;
  const newTeamRuns = curScore.runs + totalRunsAdded;
  const newWickets = isWicket ? Math.min(10, curScore.wickets + 1) : curScore.wickets;

  let nextBallInOver = curScore.balls + (isExtra ? 0 : 1);
  let nextOvers = curScore.overs;
  const overCompleted = !isExtra && nextBallInOver >= 6;
  if (overCompleted) {
    nextOvers += 1;
    nextBallInOver = 0;
  }

  const ballDisplayNumber = isExtra
    ? `${curScore.overs}.${curScore.balls + 1}`
    : overCompleted
    ? `${curScore.overs}.6`
    : `${nextOvers}.${nextBallInOver}`;

  let pitchLength: 'full' | 'good' | 'bouncer' = 'good';
  let pitchX = 56;
  let pitchY = 48;
  if (isFour) {
    pitchLength = 'full';
    pitchX = 74 + Math.round(Math.random() * 14);
    pitchY = Math.random() > 0.5 ? 24 + Math.round(Math.random() * 14) : 64 + Math.round(Math.random() * 12);
  } else if (isSix) {
    pitchLength = Math.random() > 0.35 ? 'full' : 'bouncer';
    pitchX = pitchLength === 'full' ? 76 + Math.round(Math.random() * 12) : 28 + Math.round(Math.random() * 12);
    pitchY = 42 + Math.round(Math.random() * 18);
  } else if (isWicket) {
    pitchLength = 'good';
    pitchX = 58 + Math.round(Math.random() * 14);
    pitchY = 46 + Math.round(Math.random() * 8);
  } else if (isWide) {
    pitchLength = 'good';
    pitchX = 52 + Math.round(Math.random() * 12);
    pitchY = Math.random() > 0.5 ? 12 : 88;
  } else if (outcome === 'dot') {
    pitchLength = Math.random() > 0.65 ? 'bouncer' : 'good';
    pitchX = pitchLength === 'bouncer' ? 30 + Math.round(Math.random() * 10) : 52 + Math.round(Math.random() * 12);
    pitchY = 38 + Math.round(Math.random() * 20);
  } else {
    pitchLength = Math.random() > 0.5 ? 'good' : 'full';
    pitchX = pitchLength === 'full' ? 70 + Math.round(Math.random() * 12) : 50 + Math.round(Math.random() * 14);
    pitchY = 30 + Math.round(Math.random() * 40);
  }

  const commentaryMap: Record<DemoBallOutcome, string> = {
    dot: 'Tight line around off stump, defended solidly back to the bowler.',
    '1': 'Tucked neatly into the leg side for a brisk single.',
    '2': 'Pierced the gap through deep midwicket, easy two runs.',
    '3': 'Great timing down the ground, batters sprint back for three!',
    '4': 'FOUR! Cracked past extra cover — races away to the fence!',
    '6': 'SIX! Launched cleanly over long-on into the upper tier!',
    wicket: 'WICKET! Clean strike through the gate, huge roar from the crowd!',
    wide: 'Wide signaled! Drifted well outside the off-stump tramline.',
    'no-ball': 'No ball! Overstepped at the popping crease — free hit coming up.'
  };

  const newBallEvent: BallEvent = {
    id: `demo_ball_${uniqueSuffix}`,
    ballNumber: ballDisplayNumber,
    overNumber: curScore.overs,
    ballInOver: isExtra ? curScore.balls : overCompleted ? 6 : nextBallInOver,
    runs: totalRunsAdded,
    isWicket,
    wicketType: isWicket ? 'bowled' : undefined,
    isFour,
    isSix,
    isExtra,
    extraType: isWide ? 'wide' : isNoBall ? 'no-ball' : undefined,
    batsmanName: prev.striker.name,
    bowlerName: prev.currentBowler.name,
    commentary: commentaryMap[outcome],
    timestamp: now,
    pitchLength,
    pitchX,
    pitchY
  };

  const strikerBalls = prev.striker.balls + (isWide ? 0 : 1);
  const strikerRuns = prev.striker.runs + runsOnBat;
  const updatedStriker = {
    ...prev.striker,
    runs: strikerRuns,
    balls: strikerBalls,
    fours: prev.striker.fours + (isFour ? 1 : 0),
    sixes: prev.striker.sixes + (isSix ? 1 : 0),
    strikeRate: strikerBalls > 0 ? Number(((strikerRuns / strikerBalls) * 100).toFixed(1)) : 0
  };

  const prevBowlerBalls = oversNotationToBalls(prev.currentBowler.overs);
  const newBowlerBalls = prevBowlerBalls + (isExtra ? 0 : 1);
  const newBowlerOvers = ballsToOversNotation(newBowlerBalls);
  const newBowlerRuns = prev.currentBowler.runs + totalRunsAdded;
  const newBowlerWickets = prev.currentBowler.wickets + (isWicket ? 1 : 0);
  const updatedBowler = {
    ...prev.currentBowler,
    overs: newBowlerOvers,
    runs: newBowlerRuns,
    wickets: newBowlerWickets,
    economy: newBowlerBalls > 0 ? Number(((newBowlerRuns * 6) / newBowlerBalls).toFixed(2)) : 0
  };

  let nextStriker = updatedStriker;
  let nextNonStriker = prev.nonStriker;
  let nextPartnership = {
    runs: prev.currentPartnership.runs + totalRunsAdded,
    balls: prev.currentPartnership.balls + (isWide ? 0 : 1),
    player1Runs: prev.currentPartnership.player1Runs + runsOnBat,
    player2Runs: prev.currentPartnership.player2Runs
  };

  const existingBattingRows = [...(prev.scorecards.secondInnings?.batting || [])];
  const strikerRowIdx = existingBattingRows.findIndex((r) => r.playerId === updatedStriker.playerId);
  if (strikerRowIdx >= 0) {
    existingBattingRows[strikerRowIdx] = {
      ...existingBattingRows[strikerRowIdx],
      runs: updatedStriker.runs,
      balls: updatedStriker.balls,
      fours: updatedStriker.fours,
      sixes: updatedStriker.sixes,
      strikeRate: updatedStriker.strikeRate,
      dismissal: isWicket ? `b ${prev.currentBowler.shortName}` : 'batting',
      isNotOut: !isWicket
    };
  }

  if (isWicket) {
    const usedIds = new Set(existingBattingRows.map((r) => r.playerId));
    const incomingBatter =
      TEAM_A_BATTERS.find((b) => !usedIds.has(b.playerId)) ||
      TEAM_A_BATTERS[(newWickets + 2) % TEAM_A_BATTERS.length];

    nextStriker = {
      playerId: incomingBatter.playerId,
      name: incomingBatter.name,
      shortName: incomingBatter.shortName,
      jerseyNumber: incomingBatter.jerseyNumber,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      isOnStrike: true
    };
    existingBattingRows.push({
      playerId: incomingBatter.playerId,
      name: incomingBatter.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      dismissal: 'batting',
      isNotOut: true
    });
    nextPartnership = { runs: 0, balls: 0, player1Runs: 0, player2Runs: 0 };
  }

  const shouldSwapForRuns = !isWicket && (runsOnBat === 1 || runsOnBat === 3);
  if (shouldSwapForRuns !== overCompleted) {
    const temp = { ...nextStriker, isOnStrike: false };
    nextStriker = { ...nextNonStriker, isOnStrike: true };
    nextNonStriker = temp;
    nextPartnership = {
      ...nextPartnership,
      player1Runs: nextPartnership.player2Runs,
      player2Runs: nextPartnership.player1Runs
    };
  }

  const existingBowlingRows = [...(prev.scorecards.secondInnings?.bowling || [])];
  const bowlerRowIdx = existingBowlingRows.findIndex((r) => r.playerId === updatedBowler.playerId);
  if (bowlerRowIdx >= 0) {
    existingBowlingRows[bowlerRowIdx] = {
      ...existingBowlingRows[bowlerRowIdx],
      overs: updatedBowler.overs,
      runs: updatedBowler.runs,
      wickets: updatedBowler.wickets,
      economy: updatedBowler.economy,
      wides: existingBowlingRows[bowlerRowIdx].wides + (isWide ? 1 : 0),
      noBalls: existingBowlingRows[bowlerRowIdx].noBalls + (isNoBall ? 1 : 0)
    };
  }

  let nextBowler = updatedBowler;
  if (overCompleted) {
    const currentIdx = TEAM_B_BOWLERS.findIndex((b) => b.playerId === updatedBowler.playerId);
    const nextRosterBowler = TEAM_B_BOWLERS[(currentIdx + 1) % TEAM_B_BOWLERS.length];
    const existingRow = existingBowlingRows.find((r) => r.playerId === nextRosterBowler.playerId);
    nextBowler = {
      playerId: nextRosterBowler.playerId,
      name: nextRosterBowler.name,
      shortName: nextRosterBowler.shortName,
      jerseyNumber: nextRosterBowler.jerseyNumber,
      overs: existingRow ? existingRow.overs : 0,
      maidens: existingRow ? existingRow.maidens : 0,
      runs: existingRow ? existingRow.runs : 0,
      wickets: existingRow ? existingRow.wickets : 0,
      economy: existingRow ? existingRow.economy : 0
    };
  }

  const totalBallsBowled = nextOvers * 6 + nextBallInOver;
  const remainingBalls = Math.max(0, 120 - totalBallsBowled);
  const target = prev.target || 186;
  const requiredRuns = Math.max(0, target - newTeamRuns);
  const crr = totalBallsBowled > 0 ? Number(((newTeamRuns * 6) / totalBallsBowled).toFixed(2)) : 0;
  const rrr = remainingBalls > 0 ? Number(((requiredRuns * 6) / remainingBalls).toFixed(2)) : 0;

  let statusText = `Team A need ${requiredRuns} runs in ${remainingBalls} balls`;
  let gameState: MatchState['gameState'] = 'live';
  if (requiredRuns <= 0) {
    statusText = `Team A won by ${10 - newWickets} wickets (Demo Completed)`;
    gameState = 'completed';
  } else if (newWickets >= 10 || remainingBalls === 0) {
    statusText = `Team B won by ${requiredRuns - 1} runs (Demo Completed)`;
    gameState = 'completed';
  }

  return {
    ...prev,
    statusText,
    gameState,
    requiredRuns,
    remainingBalls,
    currentRunRate: crr,
    requiredRunRate: rrr,
    battingTeam: {
      ...prev.battingTeam,
      score: {
        runs: newTeamRuns,
        wickets: newWickets,
        overs: nextOvers,
        balls: nextBallInOver
      }
    },
    striker: nextStriker,
    nonStriker: nextNonStriker,
    currentBowler: nextBowler,
    recentBalls: [newBallEvent, ...(prev.recentBalls || [])].slice(0, 14),
    currentPartnership: nextPartnership,
    lastUpdated: now,
    scorecards: {
      ...prev.scorecards,
      secondInnings: {
        ...(prev.scorecards.secondInnings || {
          teamName: 'Team A',
          teamCode: 'TMA',
          inningsNumber: 2,
          totalRuns: newTeamRuns,
          totalWickets: newWickets,
          totalOvers: `${nextOvers}.${nextBallInOver}`,
          runRate: crr,
          extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          batting: existingBattingRows,
          bowling: existingBowlingRows,
          fallOfWickets: [],
          yetToBat: []
        }),
        totalRuns: newTeamRuns,
        totalWickets: newWickets,
        totalOvers: `${nextOvers}.${nextBallInOver}`,
        runRate: crr,
        batting: existingBattingRows,
        bowling: existingBowlingRows
      }
    }
  };
}
