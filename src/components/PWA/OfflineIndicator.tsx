import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 border border-amber-400/40 p-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-bounce">
      <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-amber-200" />
      </div>
      <div className="flex-1">
        <div className="font-bold">Offline Mode Active</div>
        <div className="text-[11px] text-amber-100 font-normal">
          Showing cached scores. Reconnecting to live stream...
        </div>
      </div>
      <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
    </div>
  );
};
