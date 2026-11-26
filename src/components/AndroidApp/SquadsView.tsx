import React from 'react';
import { MatchState } from '../../types/cricket';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { MapPin, Trophy, ShieldCheck, Flag } from 'lucide-react';

import { VERIFIED_PLAYERS } from '../../data/playersRegistry';

interface SquadsViewProps {
  match: MatchState;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
}

export const SquadsView: React.FC<SquadsViewProps> = ({ match, onSelectPlayer }) => {
  const batTeamCode = (match.battingTeam.code || match.battingTeam.name || 'CRX').toUpperCase();
  const bowlTeamCode = (match.bowlingTeam.code || match.bowlingTeam.name || 'CRX').toUpperCase();

  // Find squad players from registry matching batting & bowling teams
  const allVerified = Object.values(VERIFIED_PLAYERS);
  
  const battingPlayers = allVerified.filter((p) => {
    const tc = p.teamCode.toUpperCase();
    return tc === batTeamCode || match.battingTeam.name.toUpperCase().includes(tc) || tc.includes(batTeamCode);
  });

  const bowlingPlayers = allVerified.filter((p) => {
    const tc = p.teamCode.toUpperCase();
    return tc === bowlTeamCode || match.bowlingTeam.name.toUpperCase().includes(tc) || tc.includes(bowlTeamCode);
  });

  // Ensure current active players are included
  const finalBatting = battingPlayers.length > 0 ? battingPlayers : [
    { id: match.striker.playerId, name: match.striker.name, shortName: match.striker.shortName, teamCode: batTeamCode, role: 'Batter' as const, jerseyNumber: match.striker.jerseyNumber || 18 },
    { id: match.nonStriker.playerId, name: match.nonStriker.name, shortName: match.nonStriker.shortName, teamCode: batTeamCode, role: 'Batter' as const, jerseyNumber: match.nonStriker.jerseyNumber || 7 }
  ];

  const finalBowling = bowlingPlayers.length > 0 ? bowlingPlayers : [
    { id: match.currentBowler.playerId, name: match.currentBowler.name, shortName: match.currentBowler.shortName, teamCode: bowlTeamCode, role: 'Bowler' as const, jerseyNumber: match.currentBowler.jerseyNumber || 24 }
  ];

  return (
    <div className="space-y-4">
      {/* Match Meta Card */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3">
        <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
          <Trophy className="w-4 h-4" /> Match Information
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Series</span>
            <span className="text-white font-medium">{match.series}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Venue</span>
            <span className="text-white font-medium text-right max-w-[200px]">{match.venue}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Toss</span>
            <span className="text-amber-400 font-medium text-right">{match.toss}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Format</span>
            <span className="text-white font-bold">{match.matchType} International</span>
          </div>
        </div>
      </div>

      {/* Playing Teams Squad Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Batting Team */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TeamFlag
                teamName={match.battingTeam.name}
                teamCode={match.battingTeam.code}
                logoUrl={match.battingTeam.logoUrl}
                size="xs"
              />
              <span className="font-bold text-white text-sm">{match.battingTeam.name} Squad</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">tap player for stats</span>
          </div>
          <div className="space-y-2">
            {finalBatting.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPlayer?.({ name: p.name, team: match.battingTeam.code, id: p.id })}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer transition-all active:scale-[0.99] border border-transparent hover:border-slate-700"
                title="View Player Stats"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    playerId={p.id}
                    name={p.name}
                    teamCode={match.battingTeam.code}
                    jerseyNumber={p.jerseyNumber}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.role}</div>
                  </div>
                </div>
                <span className="text-[10px] text-blue-400 font-bold shrink-0">Stats →</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bowling Team */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TeamFlag
                teamName={match.bowlingTeam.name}
                teamCode={match.bowlingTeam.code}
                logoUrl={match.bowlingTeam.logoUrl}
                size="xs"
              />
              <span className="font-bold text-white text-sm">{match.bowlingTeam.name} Squad</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">tap player for stats</span>
          </div>
          <div className="space-y-2">
            {finalBowling.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectPlayer?.({ name: p.name, team: match.bowlingTeam.code, id: p.id })}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer transition-all active:scale-[0.99] border border-transparent hover:border-slate-700"
                title="View Player Stats"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    playerId={p.id}
                    name={p.name}
                    teamCode={match.bowlingTeam.code}
                    jerseyNumber={p.jerseyNumber}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.role}</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold shrink-0">Stats →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
