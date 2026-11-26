import React, { useEffect, useState } from 'react';
import { MatchPushNotification } from '../../types/cricket';
import { X, Radio, Trophy, AlertCircle, Clock, Sparkles } from 'lucide-react';

interface AndroidPushNotificationBannerProps {
  notification: MatchPushNotification | null;
  onDismiss: () => void;
  onActionClick: () => void;
}

export const AndroidPushNotificationBanner: React.FC<AndroidPushNotificationBannerProps> = ({
  notification,
  onDismiss,
  onActionClick
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;

    setProgress(100);
    const startTime = Date.now();
    const duration = 7000; // 7 seconds heads-up display

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification?.id]);

  if (!notification) return null;

  const getEventAccent = (type: MatchPushNotification['type']) => {
    switch (type) {
      case 'wicket':
        return {
          border: 'border-rose-500/80',
          bg: 'bg-rose-950/90',
          badge: 'bg-rose-600 text-white',
          icon: <AlertCircle className="w-4 h-4 text-white" />
        };
      case 'century':
      case 'milestone':
        return {
          border: 'border-amber-400',
          bg: 'bg-amber-950/90',
          badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black',
          icon: <Trophy className="w-4 h-4 text-slate-950" />
        };
      case 'innings_break':
        return {
          border: 'border-blue-400',
          bg: 'bg-blue-950/90',
          badge: 'bg-blue-600 text-white',
          icon: <Clock className="w-4 h-4 text-white" />
        };
      case 'six':
        return {
          border: 'border-purple-500',
          bg: 'bg-purple-950/90',
          badge: 'bg-purple-600 text-white',
          icon: <Sparkles className="w-4 h-4 text-white" />
        };
      default:
        return {
          border: 'border-blue-500',
          bg: 'bg-slate-900',
          badge: 'bg-blue-600 text-white',
          icon: <Radio className="w-4 h-4 text-white" />
        };
    }
  };

  const accent = getEventAccent(notification.type);

  return (
    <div className="absolute top-10 left-3 right-3 z-50 animate-in slide-in-from-top duration-300 select-none">
      <div
        className={`rounded-2xl border-2 ${accent.border} ${accent.bg} backdrop-blur-xl shadow-2xl overflow-hidden p-3 text-white transition-all`}
      >
        {/* App Title & Time Header */}
        <div className="flex items-center justify-between text-[11px] text-slate-300 pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-md bg-blue-600 flex items-center justify-center">
              <Radio className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-bold tracking-wider text-[10px] text-slate-200">LIVE CRICKET HD</span>
            <span className="text-slate-400">• now</span>
          </div>

          <button
            onClick={onDismiss}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex items-start gap-3 pt-2">
          <div className={`p-2 rounded-xl shrink-0 ${accent.badge} shadow-md`}>
            {accent.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-black text-xs sm:text-sm tracking-tight text-white uppercase drop-shadow">
                {notification.title}
              </h4>
            </div>
            <p className="text-xs text-slate-200 mt-0.5 leading-snug line-clamp-2">
              {notification.body}
            </p>
            {notification.matchScore && (
              <div className="text-[10px] text-amber-300 font-mono mt-1 font-semibold">
                Score: {notification.matchScore}
              </div>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-white/10">
          <button
            onClick={onDismiss}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={onActionClick}
            className="px-3 py-1 text-[11px] font-bold text-slate-950 bg-white hover:bg-slate-200 rounded-lg shadow-sm transition-colors"
          >
            View Match
          </button>
        </div>

        {/* Retract Progress Bar */}
        <div className="w-full bg-white/10 h-0.5 mt-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
