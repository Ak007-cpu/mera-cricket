import React from 'react';
import { MatchState } from '../../types/cricket';
import { HeroScorecard } from './HeroScorecard';
import { LivePlayersCard } from './LivePlayersCard';
import { PlayerAvatar } from '../PlayerAvatar';
import { PlayerStatComponent } from './PlayerStatComponent';
import { RecentOversBar } from './RecentOversBar';
import { MatchMilestonesCard } from './MatchMilestonesCard';
import { WinProbabilityChart } from './WinProbabilityChart';
import { Activity, Flame, Shield, TrendingUp, Users, Zap } from 'lucide-react';

interface LiveScoreViewProps {
  match: MatchState;
  onTriggerMilestoneAlert?: (type: 'century' | 'fifty' | 'five_wickets' | 'wicket' | 'thirty' | 'three_wickets' | 'maiden') => void;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
}

export const LiveScoreView: React.FC<LiveScoreViewProps> = ({
  match,
  onTriggerMilestoneAlert,
  onSelectPlayer
}) => {
  const { battingTeam, bowlingTeam, currentRunRate, requiredRunRate, target } = match;

  // Projected score calculation for 20 overs
  const totalOvers = match.matchType === 'ODI' ? 50 : 20;
  const currentOversDecimal = battingTeam.score.overs + battingTeam.score.balls / 6;
  const remainingOvers = Math.max(0, totalOvers - currentOversDecimal);
  const projectedAtCurrentRR = Math.round(battingTeam.score.runs + remainingOvers * currentRunRate);
  const projectedAt8RR = Math.round(battingTeam.score.runs + remainingOvers * 8.5);
  const projectedAt10RR = Math.round(battingTeam.score.runs + remainingOvers * 10);

  // Win probability estimation
  let winProbBatting = 50;
  if (target && target > 0) {
    const runsNeeded = target - battingTeam.score.runs;
    const ballsLeft = remainingOvers * 6;
    if (runsNeeded <= 0) winProbBatting = 100;
    else if (ballsLeft <= 0 || battingTeam.score.wickets >= 10) winProbBatting = 0;
    else {
      const rrr = (runsNeeded / ballsLeft) * 6;
      if (rrr <= 6) winProbBatting = 85;
      else if (rrr <= 8) winProbBatting = 70;
      else if (rrr <= 10) winProbBatting = 50;
      else if (rrr <= 12) winProbBatting = 30;
      else winProbBatting = 15;
    }
  } else {
    // 1st innings estimation
    if (currentRunRate >= 9.5) winProbBatting = 72;
    else if (currentRunRate >= 8.5) winProbBatting = 62;
    else if (currentRunRate >= 7.5) winProbBatting = 52;
    else winProbBatting = 42;
  }
  const winProbBowling = 100 - winProbBatting;

  return (
    <div className="space-y-3.5">
      {/* Top Main Scorecard Card */}
      <HeroScorecard match={match} />

      {/* Match Milestones Feature Alert Card (100*, 50*, 5-Wickets) */}
      <MatchMilestonesCard
        match={match}
        onTriggerTest={onTriggerMilestoneAlert}
      />

      {/* Dedicated PlayerStatComponent: Active Batters & Bowler Detailed Performance Cards */}
      <PlayerStatComponent match={match} onSelectPlayer={onSelectPlayer} />

      {/* D3 Win Probability Trend Line Chart & Excitement Curve */}
      <WinProbabilityChart match={match} />

      {/* Projected Scores Card (1st Innings) or Target Equation (2nd Innings) */}
      {target && target > 0 ? (
        <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Zap className="w-3.5 h-3.5" />
              Equation to Win
            </span>
            <span className="text-amber-400 font-bold font-mono">Target: {target}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">Need</div>
              <div className="text-base font-bold text-white">
                {Math.max(0, target - battingTeam.score.runs)}
              </div>
              <div className="text-[9px] text-slate-500">runs</div>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">From</div>
              <div className="text-base font-bold text-white">
                {Math.max(0, Math.round(remainingOvers * 6))}
              </div>
              <div className="text-[9px] text-slate-500">balls</div>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">Req RR</div>
              <div className="text-base font-bold text-rose-400">
                {requiredRunRate ? requiredRunRate.toFixed(2) : '—'}
              </div>
              <div className="text-[9px] text-slate-500">per over</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Activity className="w-3.5 h-3.5" />
              Projected Total ({totalOvers} Overs)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">At current & varied rates</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">At Current RR ({currentRunRate.toFixed(1)})</div>
              <div className="text-base font-bold text-white">{projectedAtCurrentRR}</div>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">At 8.5 RPO</div>
              <div className="text-base font-bold text-amber-400">{projectedAt8RR}</div>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">At 10.0 RPO</div>
              <div className="text-base font-bold text-emerald-400">{projectedAt10RR}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Overs with colored pills */}
      <RecentOversBar recentBalls={match.recentBalls} />
    </div>
  );
};
