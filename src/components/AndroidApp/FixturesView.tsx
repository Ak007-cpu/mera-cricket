import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Trophy, Bell, BellRing, Filter } from 'lucide-react';
import { TeamFlag } from '../TeamFlag';

export interface CricketFixture {
  id: string;
  series: string;
  matchNumber: string;
  format: 'T20' | 'ODI' | 'TEST';
  dateStr: string;
  timeStr: string;
  venue: string;
  city: string;
  team1: {
    name: string;
    code: string;
    logoUrl: string;
  };
  team2: {
    name: string;
    code: string;
    logoUrl: string;
  };
  statusCountdown: string;
}

const UPCOMING_FIXTURES: CricketFixture[] = [
  {
    id: 'fix_1',
    series: "ICC Men's T20 World Cup 2026",
    matchNumber: 'Semi Final 1',
    format: 'T20',
    dateStr: 'Tomorrow',
    timeStr: '07:30 PM IST (14:00 GMT)',
    venue: 'Kensington Oval, Bridgetown',
    city: 'Barbados',
    team1: {
      name: 'India',
      code: 'IND',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png'
    },
    team2: {
      name: 'England',
      code: 'ENG',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/ENG.png'
    },
    statusCountdown: 'Starts in 19h 45m'
  },
  {
    id: 'fix_2',
    series: "ICC Men's T20 World Cup 2026",
    matchNumber: 'Semi Final 2',
    format: 'T20',
    dateStr: 'Thursday, Nov 05',
    timeStr: '08:00 PM IST (14:30 GMT)',
    venue: 'Brian Lara Stadium, Tarouba',
    city: 'Trinidad',
    team1: {
      name: 'Australia',
      code: 'AUS',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png'
    },
    team2: {
      name: 'South Africa',
      code: 'SA',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/SA.png'
    },
    statusCountdown: 'Starts in 2 days'
  },
  {
    id: 'fix_3',
    series: 'Border-Gavaskar Trophy - 1st Test',
    matchNumber: 'Day 1 of 5',
    format: 'TEST',
    dateStr: 'Friday, Nov 22',
    timeStr: '05:50 AM IST (00:20 GMT)',
    venue: 'Optus Stadium, Perth',
    city: 'Australia',
    team1: {
      name: 'Australia',
      code: 'AUS',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/AUS.png'
    },
    team2: {
      name: 'India',
      code: 'IND',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/IND.png'
    },
    statusCountdown: 'Starts in 2 weeks'
  },
  {
    id: 'fix_4',
    series: 'Pakistan Tour of South Africa - 1st ODI',
    matchNumber: '1st ODI',
    format: 'ODI',
    dateStr: 'Sunday, Dec 10',
    timeStr: '04:30 PM IST (11:00 GMT)',
    venue: 'SuperSport Park, Centurion',
    city: 'South Africa',
    team1: {
      name: 'South Africa',
      code: 'SA',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/SA.png'
    },
    team2: {
      name: 'Pakistan',
      code: 'PAK',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/PAK.png'
    },
    statusCountdown: 'Scheduled'
  },
  {
    id: 'fix_5',
    series: 'New Zealand vs Sri Lanka Series',
    matchNumber: '2nd T20I',
    format: 'T20',
    dateStr: 'Saturday, Dec 14',
    timeStr: '11:40 AM IST (06:10 GMT)',
    venue: 'Bay Oval, Mount Maunganui',
    city: 'New Zealand',
    team1: {
      name: 'New Zealand',
      code: 'NZ',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/NZ.png'
    },
    team2: {
      name: 'Sri Lanka',
      code: 'SL',
      logoUrl: 'https://images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/SL.png'
    },
    statusCountdown: 'Scheduled'
  }
];

export const FixturesView: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<'ALL' | 'T20' | 'ODI' | 'TEST'>('ALL');
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  const toggleReminder = (fixtureId: string) => {
    setReminders((prev) => ({
      ...prev,
      [fixtureId]: !prev[fixtureId]
    }));
  };

  const filteredFixtures =
    selectedFormat === 'ALL'
      ? UPCOMING_FIXTURES
      : UPCOMING_FIXTURES.filter((f) => f.format === selectedFormat);

  return (
    <div className="space-y-3.5">
      {/* Header & Format Filter Pill Strip */}
      <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Upcoming Fixtures</h3>
              <p className="text-[11px] text-slate-400">Official scheduled cricket matches</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {filteredFixtures.length} Matches
          </span>
        </div>

        {/* Format Selector Pills */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {(['ALL', 'T20', 'ODI', 'TEST'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`flex-1 py-1 rounded-lg font-bold transition-all text-center ${
                selectedFormat === fmt
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Fixtures List */}
      <div className="space-y-3">
        {filteredFixtures.map((fix) => {
          const isReminded = reminders[fix.id];
          return (
            <div
              key={fix.id}
              className="bg-slate-900 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3"
            >
              {/* Series header & format badge */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 truncate max-w-[230px]">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-slate-200 truncate">{fix.series}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      fix.format === 'T20'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : fix.format === 'ODI'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {fix.format}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{fix.matchNumber}</span>
                </div>
              </div>

              {/* Match Faceoff Card */}
              <div className="grid grid-cols-2 gap-3 items-center py-1">
                {/* Team 1 */}
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <TeamFlag
                    teamName={fix.team1.name}
                    teamCode={fix.team1.code}
                    logoUrl={fix.team1.logoUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs sm:text-sm truncate">
                      {fix.team1.name}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {fix.team1.code}
                    </span>
                  </div>
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <TeamFlag
                    teamName={fix.team2.name}
                    teamCode={fix.team2.code}
                    logoUrl={fix.team2.logoUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs sm:text-sm truncate">
                      {fix.team2.name}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {fix.team2.code}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date, Time & Countdown Bar */}
              <div className="flex items-center justify-between text-xs bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-slate-300">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>{fix.dateStr} • {fix.timeStr.split('(')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    <span className="truncate max-w-[200px]">{fix.venue}, {fix.city}</span>
                  </div>
                </div>

                {/* Reminder button */}
                <button
                  onClick={() => toggleReminder(fix.id)}
                  className={`p-2 rounded-xl border transition-all flex items-center gap-1 text-[11px] font-bold ${
                    isReminded
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title={isReminded ? 'Reminder set!' : 'Set match reminder'}
                >
                  {isReminded ? (
                    <>
                      <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span className="hidden sm:inline">Notifying</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remind</span>
                    </>
                  )}
                </button>
              </div>

              {/* Countdown badge */}
              <div className="text-center">
                <span className="text-[10px] font-mono font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {fix.statusCountdown}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
