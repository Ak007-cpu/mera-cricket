import React from 'react';
import { ActiveAutoBallEvent } from '../../hooks/useAutoBallAnimation';

interface AutoBallAnimationOverlayProps {
  event: ActiveAutoBallEvent | null;
  enabled: boolean;
  variant?: 'broadcast' | 'obs';
}

export const AutoBallAnimationOverlay: React.FC<AutoBallAnimationOverlayProps> = ({
  event,
  enabled,
  variant = 'broadcast'
}) => {
  if (!enabled || !event) return null;

  const isObs = variant === 'obs';
  const isMajor = event.type === 'four' || event.type === 'six' || event.type === 'wicket';

  const animClass =
    event.type === 'six'
      ? 'animate-six-zoom'
      : event.durationMs === 3000
      ? 'animate-ball-3s'
      : 'animate-ball-1s';

  const flashClass =
    event.type === 'wicket'
      ? 'bg-rose-600/25 ring-4 sm:ring-[6px] ring-inset ring-rose-500/90'
      : event.type === 'six'
      ? 'bg-amber-400/20 ring-4 sm:ring-[6px] ring-inset ring-amber-300/90'
      : event.type === 'four'
      ? 'bg-blue-600/20 ring-4 sm:ring-[6px] ring-inset ring-sky-400/90'
      : '';

  const cardThemeClass =
    event.type === 'wicket'
      ? 'bg-gradient-to-r from-rose-950/95 via-rose-700/95 to-rose-950/95 border-rose-300 text-white shadow-[0_14px_40px_rgba(225,29,72,0.55)]'
      : event.type === 'six'
      ? 'bg-gradient-to-r from-amber-950/95 via-amber-500/95 to-amber-950/95 border-amber-200 text-white shadow-[0_14px_40px_rgba(245,158,11,0.55)]'
      : event.type === 'four'
      ? 'bg-gradient-to-r from-blue-950/95 via-blue-600/95 to-blue-950/95 border-sky-300 text-white shadow-[0_14px_40px_rgba(37,99,235,0.55)]'
      : event.type === 'dot'
      ? 'bg-slate-800/95 border-slate-400 text-slate-100 shadow-lg'
      : event.type === 'wide'
      ? 'bg-cyan-700/95 border-cyan-300 text-white shadow-lg'
      : event.type === 'no-ball'
      ? 'bg-orange-700/95 border-orange-300 text-white shadow-lg'
      : 'bg-white/95 border-slate-200 text-slate-950 shadow-xl';

  const sublineClass =
    event.type === 'single' ||
    event.type === 'two' ||
    event.type === 'three' ||
    event.type === 'bye' ||
    event.type === 'leg-bye'
      ? 'text-slate-700'
      : 'text-white/90';

  if (isObs) {
    return (
      <>
        {/* Transparent OBS Edge Flash (GPU opacity only, zero backdrop blur to avoid OBS lag) */}
        {isMajor && (
          <div
            key={`obs-flash-${event.key}`}
            className={`fixed inset-0 pointer-events-none z-40 animate-flash-3s ${flashClass}`}
          />
        )}

        <div
          key={`obs-banner-${event.key}`}
          className={`max-w-5xl mx-auto w-full flex justify-center pointer-events-none z-50 ${animClass}`}
        >
          <div
            className={`w-fit max-w-[92vw] sm:max-w-lg rounded-2xl border-2 px-4 py-2 sm:px-6 sm:py-2.5 text-center ${cardThemeClass}`}
          >
            <div className="font-score text-xl sm:text-3xl font-black tracking-[0.16em] leading-none">
              {event.headline}
            </div>
            {event.subline && (
              <div
                className={`mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate ${sublineClass}`}
              >
                {event.subline}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Broadcast Flash Overlay (Blue = Four, Gold = Six, Red = Wicket) */}
      {isMajor && (
        <div
          key={`flash-${event.key}`}
          className={`fixed inset-0 pointer-events-none z-40 animate-flash-3s ${flashClass}`}
        />
      )}

      {/* Broadcast Ball Callout Banner */}
      <div
        key={`banner-${event.key}`}
        className={`fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[92vw] max-w-md sm:max-w-lg ${animClass}`}
      >
        <div className={`rounded-2xl border-2 px-4 py-3 sm:px-6 sm:py-3.5 text-center ${cardThemeClass}`}>
          <div
            className={`font-score font-black tracking-[0.18em] leading-none ${
              isMajor ? 'text-3xl sm:text-5xl' : 'text-xl sm:text-3xl'
            }`}
          >
            {event.headline}
          </div>
          {event.subline && (
            <div
              className={`mt-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate ${sublineClass}`}
            >
              {event.subline}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
