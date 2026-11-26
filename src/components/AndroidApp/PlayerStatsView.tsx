import React, { useState, useEffect } from 'react';
import { MatchState, PlayerDetailedStats } from '../../types/cricket';
import { fetchPlayerStats } from '../../services/api';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import {
  TrendingUp,
  Award,
  Zap,
  Target,
  Search,
  Activity,
  Calendar,
  RotateCw,
  Flame,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface PlayerStatsViewProps {
  match: MatchState | null;
  selectedPlayerName?: string;
  selectedPlayerTeam?: string;
  selectedPlayerId?: string;
  onSelectPlayer?: (player: { name: string; team?: string; id?: string }) => void;
}

export const PlayerStatsView: React.FC<PlayerStatsViewProps> = ({
  match,
  selectedPlayerName: initialName,
  selectedPlayerTeam: initialTeam,
  selectedPlayerId: initialId,
  onSelectPlayer
}) => {
  // Determine active player name to load
  const defaultPlayerName = initialName || match?.striker?.name || 'Amir Jangoo';
  const defaultTeam = initialTeam || match?.battingTeam?.code || 'WI';
  const defaultId = initialId || match?.striker?.playerId;

  const [activePlayerName, setActivePlayerName] = useState<string>(defaultPlayerName);
  const [activeTeamCode, setActiveTeamCode] = useState<string>(defaultTeam);
  const [activePlayerId, setActivePlayerId] = useState<string | undefined>(defaultId);

  const [selectedFormat, setSelectedFormat] = useState<'test' | 'odi' | 't20i' | 'ipl'>('test');
  const [statsData, setStatsData] = useState<PlayerDetailedStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync with prop changes if passed from parent
  useEffect(() => {
    if (initialName && initialName !== activePlayerName) {
      setActivePlayerName(initialName);
      if (initialTeam) setActiveTeamCode(initialTeam);
      if (initialId) setActivePlayerId(initialId);
    }
  }, [initialName, initialTeam, initialId]);

  // Fetch dynamic stats when active player changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPlayerStats(activePlayerName, activeTeamCode, activePlayerId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setStatsData(data);
          // Auto select format available for player
          if (data.formats.test) setSelectedFormat('test');
          else if (data.formats.odi) setSelectedFormat('odi');
          else if (data.formats.t20i) setSelectedFormat('t20i');
          else if (data.formats.ipl) setSelectedFormat('ipl');
        } else {
          setError('Unable to load statistics for this player.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Network error retrieving player statistics.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePlayerName, activeTeamCode, activePlayerId]);

  const handleSwitchPlayer = (name: string, team: string, id?: string) => {
    setActivePlayerName(name);
    setActiveTeamCode(team);
    setActivePlayerId(id);
    if (onSelectPlayer) {
      onSelectPlayer({ name, team, id });
    }
  };

  // Compile list of players from the active live match for quick selection
  const liveMatchPlayers = React.useMemo(() => {
    if (!match) {
      return [
        { name: 'Amir Jangoo', team: 'WI', role: 'Wicketkeeper' },
        { name: 'Kavem Hodge', team: 'WI', role: 'All-rounder' },
        { name: 'Nayeem Hasan', team: 'BAN', role: 'Bowler' },
        { name: 'Virat Kohli', team: 'IND', role: 'Batter' },
        { name: 'Jasprit Bumrah', team: 'IND', role: 'Bowler' },
        { name: 'Babar Azam', team: 'PAK', role: 'Batter' },
        { name: 'Pat Cummins', team: 'AUS', role: 'Bowler' }
      ];
    }

    const list: Array<{ name: string; team: string; id?: string; role?: string; isLive?: boolean }> = [];
    const seen = new Set<string>();

    const addP = (name: string, team: string, id?: string, role?: string, isLive?: boolean) => {
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      list.push({ name, team, id, role, isLive });
    };

    // Current live key players first
    addP(match.striker.name, match.battingTeam.code, match.striker.playerId, 'Striker (Batting)', true);
    addP(match.nonStriker.name, match.battingTeam.code, match.nonStriker.playerId, 'Non-Striker (Batting)', true);
    addP(match.currentBowler.name, match.bowlingTeam.code, match.currentBowler.playerId, 'Active Bowler', true);

    // Scorecard players if any
    [match.scorecards.firstInnings, match.scorecards.secondInnings].forEach((inn) => {
      if (!inn) return;
      inn.batting.forEach((b) => addP(b.name, match.battingTeam.code, b.playerId, 'Batter'));
      inn.bowling.forEach((bw) => addP(bw.name, match.bowlingTeam.code, bw.playerId, 'Bowler'));
    });

    // Add star international quick-picks
    [
      { name: 'Virat Kohli', team: 'IND' },
      { name: 'Jasprit Bumrah', team: 'IND' },
      { name: 'Babar Azam', team: 'PAK' },
      { name: 'Pat Cummins', team: 'AUS' },
      { name: 'Travis Head', team: 'AUS' }
    ].forEach((star) => {
      if (!seen.has(star.name.toLowerCase())) {
        list.push({ name: star.name, team: star.team, role: 'International Star' });
      }
    });

    return list;
  }, [match]);

  const filteredPlayers = searchQuery.trim()
    ? liveMatchPlayers.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : liveMatchPlayers;

  const activeStats = statsData?.formats[selectedFormat] || statsData?.formats.test || statsData?.formats.odi || statsData?.formats.t20i;
  const isBowlerOrAllRounder = statsData?.player.role === 'Bowler' || statsData?.player.role === 'All-rounder';

  return (
    <div className="space-y-3.5 pb-6">
      {/* Search & Active Match Players Quick-Switch Bar */}
      <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" /> Select Player
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {liveMatchPlayers.length} Match Players Available
          </span>
        </div>

        {/* Search input with clean unboxed style */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search player name (e.g. Amir Jangoo, Nayeem Hasan, Kohli)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Horizontal Player Quick-Selection Bar */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          {filteredPlayers.map((p) => {
            const isSelected = p.name.toLowerCase() === activePlayerName.toLowerCase();
            return (
              <button
                key={p.name}
                onClick={() => handleSwitchPlayer(p.name, p.team, p.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all shrink-0 text-left ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500/80 text-white shadow-sm ring-1 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <PlayerAvatar
                  playerId={p.id}
                  name={p.name}
                  teamCode={p.team}
                  size="xs"
                />
                <div className="min-w-0 pr-1">
                  <div className="text-xs font-bold truncate flex items-center gap-1">
                    <span>{p.name}</span>
                    {p.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Live in match" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {p.team} · {p.role || 'Player'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              playerId={activePlayerId || statsData?.player.id}
              name={activePlayerName}
              teamCode={activeTeamCode}
              jerseyNumber={statsData?.player.jerseyNumber}
              imageUrl={statsData?.player.imageUrl}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TeamFlag
                  teamName={statsData?.player.team || activeTeamCode}
                  teamCode={activeTeamCode}
                  size="xs"
                />
                <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                  {statsData?.player.team || activeTeamCode}
                </span>
                {statsData?.player.jerseyNumber && (
                  <span className="text-[10px] font-mono text-slate-400">
                    #{statsData.player.jerseyNumber}
                  </span>
                )}
              </div>

              <h2 className="text-lg font-black text-white truncate tracking-tight mt-0.5">
                {statsData?.player.name || activePlayerName}
              </h2>

              {/* Clean unboxed metadata with subtle typographic separators */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap mt-0.5">
                <span className="text-blue-400 font-semibold">{statsData?.player.role || 'Cricketer'}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{statsData?.player.battingStyle || 'Right-hand bat'}</span>
                {statsData?.player.bowlingStyle && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="truncate">{statsData.player.bowlingStyle}</span>
                  </>
                )}
                {statsData?.player.age && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-500 font-mono">Age {statsData.player.age}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchPlayerStats(activePlayerName, activeTeamCode, activePlayerId)
                .then((d) => setStatsData(d))
                .finally(() => setLoading(false));
            }}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-white transition-colors"
            title="Refresh Player Stats"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Live Match Performance Spotlight Banner (If active in current live match) */}
        {statsData?.currentMatchPerformance && (
          <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/50 to-slate-900 border border-blue-500/30 rounded-xl p-3 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold font-mono uppercase tracking-wider text-emerald-400">
                  Live Match Form
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {statsData.currentMatchPerformance.isCurrentlyBatting
                    ? 'In the middle batting now'
                    : statsData.currentMatchPerformance.isCurrentlyBowling
                    ? 'Currently bowling in attack'
                    : 'Performance in this match'}
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              {statsData.currentMatchPerformance.runs !== undefined && (
                <div>
                  <span className="text-base font-black text-amber-400">
                    {statsData.currentMatchPerformance.runs}
                  </span>
                  <span className="text-xs text-slate-400">
                    * ({statsData.currentMatchPerformance.balls || 0}b)
                  </span>
                  <div className="text-[10px] text-slate-400">
                    SR: {statsData.currentMatchPerformance.strikeRate?.toFixed(1) || '0.0'} · {statsData.currentMatchPerformance.fours || 0}x4, {statsData.currentMatchPerformance.sixes || 0}x6
                  </div>
                </div>
              )}
              {statsData.currentMatchPerformance.wickets !== undefined && (
                <div>
                  <span className="text-base font-black text-emerald-400">
                    {statsData.currentMatchPerformance.wickets}/{statsData.currentMatchPerformance.runsConceded || 0}
                  </span>
                  <span className="text-xs text-slate-400">
                    {' '}({statsData.currentMatchPerformance.overs} ov)
                  </span>
                  <div className="text-[10px] text-slate-400">
                    Econ: {statsData.currentMatchPerformance.economy?.toFixed(2) || '0.00'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Format Switcher Segmented Control */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
        {(['test', 'odi', 't20i', 'ipl'] as const).map((fmt) => {
          const isAvail = !!statsData?.formats[fmt];
          const isSelected = selectedFormat === fmt;
          const label = fmt === 'test' ? 'Test' : fmt === 'odi' ? 'ODI' : fmt === 't20i' ? 'T20I' : 'T20 / League';
          return (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              disabled={!isAvail}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isAvail
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 cursor-not-allowed opacity-40'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Loading state skeleton */}
      {loading && !statsData && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-center space-y-3">
          <RotateCw className="w-7 h-7 text-blue-400 animate-spin mx-auto opacity-70" />
          <div className="text-xs text-slate-400 font-mono">Fetching authentic career records and strike rates...</div>
        </div>
      )}

      {/* Error state */}
      {error && !statsData && (
        <div className="bg-slate-900 rounded-2xl p-6 border border-rose-500/30 text-center space-y-2">
          <div className="text-xs font-bold text-rose-400">{error}</div>
          <button
            onClick={() => setActivePlayerName(defaultPlayerName)}
            className="px-3 py-1.5 bg-slate-800 text-xs font-semibold text-white rounded-lg hover:bg-slate-700"
          >
            Reset to Match Striker
          </button>
        </div>
      )}

      {/* Career Batting Statistics Card (Highlighting Strike Rate & Average) */}
      {activeStats && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-xs uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Batting Averages & Strike Rate ({selectedFormat.toUpperCase()})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeStats.matches} Matches · {activeStats.innings} Innings
            </span>
          </div>

          {/* Primary Key Metrics (Average & Strike Rate Prominent Hero Badges) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Batting Average Hero Box */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 relative overflow-hidden">
              <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                Batting Average
              </div>
              <div className="text-2xl font-black text-white font-mono mt-0.5">
                {activeStats.battingAverage.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Runs/Innings dismissals
              </div>
            </div>

            {/* Strike Rate Hero Box */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 relative overflow-hidden">
              <div className="text-[10px] font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" /> Strike Rate (SR)
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                {activeStats.strikeRate.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Runs per 100 balls faced
              </div>
            </div>
          </div>

          {/* Comprehensive Batting Breakdown Matrix */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Runs</div>
              <div className="text-sm font-bold text-white mt-0.5">{activeStats.runs.toLocaleString()}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Highest (HS)</div>
              <div className="text-sm font-bold text-white mt-0.5">{activeStats.highestScore}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">100s</div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">{activeStats.centuries}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">50s</div>
              <div className="text-sm font-bold text-blue-400 mt-0.5">{activeStats.fifties}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Fours (4s)</div>
              <div className="text-sm font-bold text-slate-200 mt-0.5">{activeStats.fours}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Sixes (6s)</div>
              <div className="text-sm font-bold text-purple-400 mt-0.5">{activeStats.sixes}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Not Outs</div>
              <div className="text-sm font-bold text-slate-300 mt-0.5">{activeStats.notOuts}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">30s</div>
              <div className="text-sm font-bold text-sky-400 mt-0.5">{activeStats.thirties || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bowling Figures Card (If bowler or all-rounder) */}
      {activeStats && (activeStats.wickets !== undefined || isBowlerOrAllRounder) && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              Bowling Performance & Economy ({selectedFormat.toUpperCase()})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeStats.wickets || 0} Total Wickets
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Bowling Average Hero Box */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                Bowling Average
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                {activeStats.bowlingAverage ? activeStats.bowlingAverage.toFixed(2) : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Runs conceded per wicket
              </div>
            </div>

            {/* Economy Rate Hero Box */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                Economy Rate (Econ)
              </div>
              <div className="text-2xl font-black text-white font-mono mt-0.5">
                {activeStats.economyRate ? activeStats.economyRate.toFixed(2) : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Runs conceded per over
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Overs</div>
              <div className="text-sm font-bold text-white mt-0.5">{activeStats.oversBowled || 0}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Wickets</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">{activeStats.wickets || 0}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Best (BBI)</div>
              <div className="text-sm font-bold text-white mt-0.5">{activeStats.bestBowlingInnings || '—'}</div>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">5W Hauls</div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">{activeStats.fiveWicketHauls || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Performance Data Log (Last 5 Matches) */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-bold text-xs uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Recent Match Performance Logs
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Last 5 Matches</span>
        </div>

        {statsData?.recentMatches && statsData.recentMatches.length > 0 ? (
          <div className="space-y-2">
            {statsData.recentMatches.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TeamFlag
                      teamName={log.opponent}
                      teamCode={log.opponentCode}
                      size="xs"
                    />
                    <span className="font-bold text-xs text-white truncate">
                      vs {log.opponent}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                      {log.format}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {log.date}
                  </span>
                </div>

                {/* Performance stats row */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    {log.runsScored !== undefined && (
                      <span className="font-mono font-bold text-white">
                        <span className="text-amber-400 text-sm">{log.runsScored}</span>
                        <span className="text-[11px] text-slate-400"> ({log.ballsFaced}b)</span>
                      </span>
                    )}
                    {log.strikeRate !== undefined && log.runsScored !== undefined && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        SR: <span className="text-slate-200">{log.strikeRate.toFixed(1)}</span>
                      </span>
                    )}
                    {log.wicketsTaken !== undefined && (
                      <span className="font-mono font-bold text-emerald-400">
                        {log.wicketsTaken}/{log.runsConceded || 0}
                        <span className="text-[10px] text-slate-400"> ({log.oversBowled} ov)</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px] text-right">
                    {log.result || log.venue || 'Match Completed'}
                  </div>
                </div>

                {log.dismissal && (
                  <div className="text-[10px] text-slate-500 font-mono italic">
                    Dismissal: {log.dismissal}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500 font-mono">
            No recent match logs available for this player.
          </div>
        )}
      </div>
    </div>
  );
};
