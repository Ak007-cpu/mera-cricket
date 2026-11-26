import React, { useEffect, useRef } from 'react';
import { audioController } from '../../utils/AudioController';

interface AudioSoundWaveProps {
  isSoundOn: boolean;
  isCrowdActive: boolean;
  crowdVolume: number;
  reducedMotion?: boolean;
}

const BAR_COUNT = 5;
const BAR_WEIGHTS = [0.74, 0.94, 1.0, 0.9, 0.72];

export const AudioSoundWave: React.FC<AudioSoundWaveProps> = ({
  isSoundOn,
  isCrowdActive,
  crowdVolume,
  reducedMotion = false
}) => {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const smoothedRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.18));

  useEffect(() => {
    const applyBars = (values: number[], opacityValues?: number[]) => {
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        el.style.transform = `scaleY(${values[i].toFixed(3)})`;
        if (opacityValues) {
          el.style.opacity = opacityValues[i].toFixed(2);
        }
      }
    };

    if (!isSoundOn || crowdVolume <= 0) {
      smoothedRef.current.fill(0.16);
      applyBars(smoothedRef.current, new Array(BAR_COUNT).fill(0.45));
      return;
    }

    let rafId = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const opacities = new Array<number>(BAR_COUNT).fill(0.7);

    const sampleAndPaint = () => {
      if (stopped) return;
      const { levels, overall, isActive } = audioController.getCrowdWaveLevels(BAR_COUNT);
      const volFactor = Math.max(0.12, Math.min(1, crowdVolume / 100));

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 0.2;
        if (isActive && isCrowdActive && overall > 0.008) {
          const bandLevel = levels[i] ?? overall;
          const weighted = bandLevel * BAR_WEIGHTS[i] * (0.55 + 0.45 * volFactor);
          target = Math.max(0.22, Math.min(1, 0.2 + weighted * 0.8));
          opacities[i] = Math.min(1, 0.65 + bandLevel * 0.35);
        } else {
          target = 0.2;
          opacities[i] = isCrowdActive ? 0.65 : 0.42;
        }

        const prev = smoothedRef.current[i] ?? 0.2;
        const attack = target > prev ? 0.38 : 0.22;
        smoothedRef.current[i] = prev + (target - prev) * attack;
      }

      applyBars(smoothedRef.current, opacities);
    };

    if (reducedMotion) {
      sampleAndPaint();
      intervalId = setInterval(sampleAndPaint, 240);
    } else {
      const tick = () => {
        sampleAndPaint();
        if (!stopped) {
          rafId = window.requestAnimationFrame(tick);
        }
      };
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSoundOn, isCrowdActive, crowdVolume, reducedMotion]);

  const activeColorClass = isSoundOn
    ? isCrowdActive && crowdVolume > 0
      ? 'bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.45)]'
      : 'bg-emerald-600/65 dark:bg-emerald-500/55'
    : 'bg-slate-400 dark:bg-slate-600';

  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-[2.5px] h-3.5 px-1 select-none"
      title={
        !isSoundOn
          ? 'Crowd audio muted'
          : isCrowdActive && crowdVolume > 0
          ? 'Live crowd ambience level'
          : 'Sound ON (waiting for live crowd audio)'
      }
    >
      {Array.from({ length: BAR_COUNT }).map((_, idx) => (
        <span
          key={idx}
          ref={(el) => {
            barRefs.current[idx] = el;
          }}
          style={{ transform: 'scaleY(0.18)', opacity: isSoundOn ? 0.75 : 0.45 }}
          className={`w-[2.5px] h-full rounded-full origin-center will-change-transform ${
            reducedMotion ? 'transition-transform duration-200' : 'transition-colors duration-200'
          } ${activeColorClass}`}
        />
      ))}
    </span>
  );
};
