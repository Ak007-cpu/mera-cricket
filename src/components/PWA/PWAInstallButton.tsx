import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running inside an installed PWA, do not display install buttons
  if (isInstalled) {
    if (variant === 'banner') return null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Installed App</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) setInstallSuccess(true);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If not installable and not iOS (e.g. desktop browser that already installed or doesn't support), hide
  if (!isInstallable && !isIOS && !installSuccess) {
    return null;
  }

  if (installSuccess) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span>App Installed!</span>
      </div>
    );
  }

  return (
    <>
      {variant === 'banner' ? (
        <div className={`bg-gradient-to-r from-blue-900/90 to-indigo-950/90 border border-blue-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon-192.png" alt="Live Cricket HD" className="w-12 h-12 rounded-xl shadow-md shrink-0 border border-blue-400/30" />
            <div className="min-w-0">
              <h4 className="text-sm font-black text-white tracking-tight uppercase">Install LIVE CRICKET HD</h4>
              <p className="text-[11px] text-blue-200 truncate">
                Get full-screen live scorecards, match alerts, and fast offline updates.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Install</span>
          </button>
        </div>
      ) : variant === 'full' ? (
        <button
          onClick={handleInstallClick}
          className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Install LIVE CRICKET HD</span>
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          title="Install Live Cricket HD"
          className={`px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Guided Install Sheet */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <img src="/icon-192.png" alt="App Icon" className="w-12 h-12 rounded-2xl shadow-md border border-slate-700" />
              <div>
                <h3 className="text-base font-black text-white">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-400">Add LIVE CRICKET HD to Home Screen</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">1</span>
                <span className="flex items-center gap-1.5">
                  Tap the <Share2 className="w-4 h-4 text-blue-400 inline" /> <strong>Share</strong> button in Safari toolbar.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">2</span>
                <span className="flex items-center gap-1.5">
                  Scroll down and tap <PlusSquare className="w-4 h-4 text-emerald-400 inline" /> <strong>Add to Home Screen</strong>.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">3</span>
                <span>Open from your Home Screen for the full-screen HD experience!</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
