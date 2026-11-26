import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleButtonProps {
  variant?: 'broadcast' | 'mobile';
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  variant = 'broadcast',
  className = ''
}) => {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={!isDark}
        aria-label={isDark ? 'Switch to high-contrast light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light Mode (Daylight)' : 'Dark Mode'}
        className={`min-w-[34px] min-h-[34px] px-2 rounded-xl border flex items-center justify-center gap-1 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shrink-0 ${
          isDark
            ? 'bg-white/[0.08] hover:bg-white/[0.16] border-white/15 text-amber-300'
            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
        } ${className}`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-slate-800 shrink-0" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={!isDark}
      aria-label={isDark ? 'Switch to high-contrast light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to Light Mode for bright daylight' : 'Switch to Dark Mode'}
      className={`inline-flex items-center gap-1.5 font-sans text-xs sm:text-sm font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        isDark
          ? 'border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-100'
          : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-900 shadow-xs'
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-800 shrink-0" />
          <span>Dark</span>
        </>
      )}
    </button>
  );
};
