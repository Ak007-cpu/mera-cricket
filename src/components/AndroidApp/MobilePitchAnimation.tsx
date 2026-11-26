import React from 'react';
import { ActiveAutoBallEvent } from '../../hooks/useAutoBallAnimation';

interface MobilePitchAnimationProps {
  event: ActiveAutoBallEvent | null;
  battingColor?: string;
}

export const MobilePitchAnimation: React.FC<MobilePitchAnimationProps> = ({
  event,
  battingColor = '#10b981'
}) => {
  const type = event?.type;
  const isFour = type === 'four';
  const isSix = type === 'six';
  const isWicket = type === 'wicket';
  const isDot = type === 'dot';
  const isRuns = type === 'single' || type === 'two' || type === 'three' || type === 'bye' || type === 'leg-bye';
  const isExtra = type === 'wide' || type === 'no-ball';

  const ballAnimClass = isWicket
    ? 'animate-pitch-ball-wicket'
    : isSix
    ? 'animate-pitch-ball-six'
    : isFour
    ? 'animate-pitch-ball-four'
    : isRuns
    ? 'animate-pitch-ball-run'
    : isExtra
    ? 'animate-pitch-ball-wide'
    : isDot
    ? 'animate-pitch-ball-dot'
    : '';

  const ballColorClass = isWicket
    ? 'bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.95)]'
    : isSix
    ? 'bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,1)]'
    : isFour
    ? 'bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,1)]'
    : isExtra
    ? 'bg-amber-200 shadow-[0_0_12px_rgba(252,211,77,0.85)]'
    : 'bg-white shadow-[0_0_14px_rgba(255,255,255,0.95)]';

  const trailColorClass = isWicket
    ? 'bg-rose-500/55'
    : isSix
    ? 'bg-amber-400/60'
    : isFour
    ? 'bg-blue-400/60'
    : 'bg-white/45';

  // Extract batter name cleanly from wicket subline ("Babar Azam 42 (28b) • PAK 57/1")
  const dismissedText = isWicket && event?.subline ? event.subline.split('•')[0].trim() : '';

  return (
    <section
      aria-label="Live Pitch View"
      className="relative z-10 w-full h-[116px] sm:h-[126px] rounded-2xl overflow-hidden border border-emerald-400/25 bg-[#063826] shadow-[inset_0_0_32px_rgba(0,0,0,0.55),0_8px_24px_rgba(0,0,0,0.45)] shrink-0 flex items-center justify-center"
    >
      {/* Top-Down Lush Green Outfield + Mowing Stripes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, #15803d 0%, #166534 52%, #064e3b 88%, #022c22 100%)'
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 18px, transparent 18px, transparent 36px)'
        }}
      />

      {/* Calm Idle Stadium Glow on Pitch when waiting between deliveries */}
      {!event && (
        <div
          className="pointer-events-none absolute inset-0 animate-pitch-idle"
          style={{
            background: `radial-gradient(ellipse at center, ${battingColor}33 0%, rgba(255,255,255,0.08) 40%, transparent 72%)`
          }}
        />
      )}

      {/* Event-Specific Stadium Flash (Blue for Four, Gold for Six, Red for Wicket) */}
      {event && (isFour || isSix || isWicket) && (
        <div
          key={`flash-${event.key}`}
          className="pointer-events-none absolute inset-0 z-20 animate-flash-3s"
          style={{
            background: isWicket
              ? 'radial-gradient(circle at center, rgba(225, 29, 72, 0.65) 0%, rgba(136, 19, 55, 0.35) 75%)'
              : isSix
              ? 'radial-gradient(circle at center, rgba(251, 191, 36, 0.62) 0%, rgba(180, 83, 9, 0.3) 75%)'
              : 'radial-gradient(circle at center, rgba(37, 99, 235, 0.6) 0%, rgba(30, 58, 138, 0.3) 75%)'
          }}
        />
      )}

      {/* Fixed-Scale Top-Down 320x114 Cricket Ground Stage */}
      <div className="relative w-[320px] h-[114px] shrink-0">
        {/* Boundary Oval Rope */}
        <div
          className={`absolute inset-x-3 inset-y-2 rounded-[999px] border-2 transition-colors duration-200 ${
            isFour
              ? 'border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.85)]'
              : isSix
              ? 'border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]'
              : isWicket
              ? 'border-rose-400/80 shadow-[0_0_14px_rgba(244,63,94,0.65)]'
              : 'border-white/35'
          }`}
        />

        {/* 30-Yard Inner Circle */}
        <div className="absolute left-12 right-12 top-5 bottom-5 rounded-[999px] border border-dashed border-white/25" />

        {/* Central Brown Cricket Pitch Strip (Bhuri Pitch) */}
        <div
          className="absolute left-[78px] top-[41px] w-[164px] h-[32px] rounded-md border border-amber-950/50 shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
          style={{
            background: 'linear-gradient(90deg, #8b653d 0%, #c19765 50%, #8b653d 100%)'
          }}
        >
          {/* Bowler End Creases */}
          <div className="absolute left-[10px] inset-y-0 w-[1.5px] bg-white/75" />
          <div className="absolute left-[22px] inset-y-0.5 w-[1.5px] bg-white/85" />
          {/* Batsman End Creases */}
          <div className="absolute right-[10px] inset-y-0 w-[1.5px] bg-white/75" />
          <div className="absolute right-[22px] inset-y-0.5 w-[1.5px] bg-white/85" />
          {/* Subtle Center Pitch Wear Texture */}
          <div className="absolute left-7 right-7 top-1/2 -translate-y-1/2 h-3 rounded-full bg-amber-950/15" />
        </div>

        {/* Left Stumps (Bowler's End, x=88px) */}
        <div className="absolute left-[87px] top-[50px] flex flex-col gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-amber-200 shadow-sm" />
          <span className="w-[3px] h-[3px] rounded-full bg-amber-200 shadow-sm" />
          <span className="w-[3px] h-[3px] rounded-full bg-amber-200 shadow-sm" />
        </div>

        {/* Right Stumps (Batsman's End, x=230px — scatters on Wicket!) */}
        <div
          key={isWicket && event ? `stumps-${event.key}` : 'stumps-idle'}
          className="absolute left-[229px] top-[50px] flex flex-col gap-[3px]"
        >
          <span
            className={`w-[3.5px] h-[3.5px] rounded-full ${
              isWicket ? 'bg-rose-200 shadow-[0_0_8px_#fb7185] animate-stump-top' : 'bg-amber-200'
            }`}
          />
          <span
            className={`w-[3.5px] h-[3.5px] rounded-full ${
              isWicket ? 'bg-rose-200 shadow-[0_0_8px_#fb7185] animate-stump-mid' : 'bg-amber-200'
            }`}
          />
          <span
            className={`w-[3.5px] h-[3.5px] rounded-full ${
              isWicket ? 'bg-rose-200 shadow-[0_0_8px_#fb7185] animate-stump-bot' : 'bg-amber-200'
            }`}
          />
        </div>

        {/* End Role Labels */}
        <span className="absolute left-[46px] top-1/2 -translate-y-1/2 font-score text-[8px] font-bold tracking-wider text-emerald-100/70 uppercase">
          Bowl
        </span>
        <span className="absolute right-[48px] top-1/2 -translate-y-1/2 font-score text-[8px] font-bold tracking-wider text-amber-100/80 uppercase">
          Bat
        </span>

        {/* Dashing Batters + Outfield Landing Marker on 1, 2, 3 Runs */}
        {event && isRuns && (
          <React.Fragment key={`runs-${event.key}`}>
            {/* Outfield Shot Landing Marker */}
            <div className="absolute left-[172px] top-[18px] w-2.5 h-2.5 rounded-full bg-white border border-emerald-950 shadow-[0_0_10px_#ffffff] animate-outfield-mark" />
            {/* Batter 1 dashing right -> left */}
            <div className="absolute left-[212px] top-[35px] w-3 h-3 rounded-full bg-amber-300 border border-slate-950 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-batter-dash-a" />
            {/* Batter 2 dashing left -> right */}
            <div className="absolute left-[104px] top-[67px] w-3 h-3 rounded-full bg-amber-200 border border-slate-950 shadow-[0_0_8px_rgba(253,224,71,0.85)] animate-batter-dash-b" />
          </React.Fragment>
        )}

        {/* Animated Ball + Luminous Trail */}
        {event && ballAnimClass && (
          <React.Fragment key={`ball-${event.key}`}>
            {/* Faint Trail 2 */}
            <div
              className={`absolute left-[96px] top-[53px] w-2.5 h-2.5 rounded-full blur-[1px] ${trailColorClass} ${ballAnimClass}`}
              style={{ animationDelay: '65ms', opacity: 0.45 }}
            />
            {/* Trail 1 */}
            <div
              className={`absolute left-[96px] top-[53px] w-2.5 h-2.5 rounded-full ${trailColorClass} ${ballAnimClass}`}
              style={{ animationDelay: '32ms', opacity: 0.72 }}
            />
            {/* Main Cricket Ball */}
            <div
              className={`absolute left-[96px] top-[52px] w-3 h-3 rounded-full border border-slate-950/60 z-10 ${ballColorClass} ${ballAnimClass}`}
            />
          </React.Fragment>
        )}

        {/* Live Event Banner inside Pitch Stage */}
        {event && (
          <div
            key={`label-${event.key}`}
            role="status"
            aria-live="polite"
            className={`absolute inset-x-0 bottom-1.5 z-30 flex items-center justify-center pointer-events-none ${
              event.durationMs === 3000
                ? isSix
                  ? 'animate-six-zoom'
                  : 'animate-ball-3s'
                : 'animate-ball-1s'
            }`}
          >
            <div
              className={`px-3 py-1 rounded-full border backdrop-blur-md flex items-center gap-2 shadow-lg ${
                isWicket
                  ? 'bg-rose-600/95 border-rose-200 text-white shadow-[0_0_24px_rgba(225,29,72,0.9)]'
                  : isSix
                  ? 'bg-amber-400/95 border-amber-100 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.95)]'
                  : isFour
                  ? 'bg-blue-600/95 border-sky-200 text-white shadow-[0_0_22px_rgba(37,99,235,0.9)]'
                  : isExtra
                  ? 'bg-slate-900/95 border-amber-400 text-amber-300'
                  : 'bg-slate-950/90 border-white/50 text-white'
              }`}
            >
              <span className="font-score font-black text-xs sm:text-sm tracking-wide leading-none">
                {event.headline}
              </span>
              {dismissedText && (
                <span className="font-cricket font-bold text-[11px] text-rose-100 truncate max-w-[175px]">
                  {dismissedText}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
