import React, { useCallback, useEffect, useRef } from 'react';
import { vibrateDevice } from '../services/api';

/**
 * Hidden Mobile & Desktop touch/click shortcut hook to open Studio Admin:
 * - Mobile Long-Press: Hold the hotspot / LIVE badge for 1.2s (vibrates subtly on trigger)
 * - Fast Multi-Tap: 5 rapid taps within 2.5s
 */
export function useSecretAdminGesture(
  onTrigger?: () => void,
  disabled: boolean = false
) {
  const tapCountRef = useRef(0);
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPress();
      if (tapResetTimerRef.current) {
        clearTimeout(tapResetTimerRef.current);
      }
    };
  }, [clearLongPress]);

  const fireTrigger = useCallback(() => {
    if (disabled || !onTrigger) return;
    tapCountRef.current = 0;
    vibrateDevice([40, 30, 40]);
    onTrigger();
  }, [disabled, onTrigger]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !onTrigger) return;
      if (e.button !== undefined && e.button !== 0) return;
      longPressTriggeredRef.current = false;
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        fireTrigger();
      }, 1200);
    },
    [disabled, onTrigger, clearLongPress, fireTrigger]
  );

  const onPointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const onClick = useCallback(() => {
    if (disabled || !onTrigger) return;
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    tapCountRef.current += 1;
    if (tapResetTimerRef.current) {
      clearTimeout(tapResetTimerRef.current);
    }
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      fireTrigger();
      return;
    }
    tapResetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2500);
  }, [disabled, onTrigger, fireTrigger]);

  return {
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerLeave: onPointerUp
  };
}
