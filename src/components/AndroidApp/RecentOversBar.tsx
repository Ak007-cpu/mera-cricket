import React from 'react';
import { BallEvent } from '../../types/cricket';
import { History } from 'lucide-react';

interface RecentOversBarProps {
  recentBalls: BallEvent[];
}

export const RecentOversBar: React.FC<RecentOversBarProps> = ({ recentBalls }) => {
  const getBadgeStyle = (ball: BallEvent) => {
    if (ball.isWicket) {
      return 'bg-rose-600 text-white font-black border-rose-400/50 shadow-md shadow-rose-600/30 scale-105';
    }
    if (ball.isSix) {
      return 'bg-purple-600 text-white font-black border-purple-400/50 shadow-md shadow-purple-600/30';
    }
    if (ball.isFour) {
      return 'bg-blue-600 text-white font-black border-blue-400/50 shadow-md shadow-blue-600/30';
    }
    if (ball.runs === 0 && !ball.isExtra) {
      return 'bg-slate-800 text-slate-400 font-medium border-slate-700/80';
    }
    return 'bg-slate-700/80 text-white font-semibold border-slate-600';
  };

  const getBallLabel = (ball: BallEvent) => {
    if (ball.isWicket) return 'W';
    if (ball.isSix) return '6';
    if (ball.isFour) return '4';
    if (ball.isExtra) {
      if (ball.extraType === 'wide') return `${ball.runs}Wd`;
      if (ball.extraType === 'no-ball') return `${ball.runs}Nb`;
    }
    if (ball.runs === 0) return '•';
    return String(ball.runs);
  };

  // Group balls by over if needed or show chronological sequence
  const displayBalls = recentBalls.slice(0, 12);

  return (
    <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 shadow-md">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <History className="w-3.5 h-3.5 text-blue-400" />
          <span>Recent Deliveries</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Last 12 balls</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {displayBalls.length > 0 ? (
          displayBalls.map((ball, idx) => (
            <div key={ball.id || idx} className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-mono border transition-transform duration-200 ${getBadgeStyle(
                  ball
                )}`}
                title={`${ball.ballNumber}: ${ball.commentary}`}
              >
                {getBallLabel(ball)}
              </div>
              <span className="text-[9px] text-slate-500 font-mono">{ball.ballNumber}</span>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-500 py-2">Waiting for first delivery...</div>
        )}
      </div>
    </div>
  );
};
