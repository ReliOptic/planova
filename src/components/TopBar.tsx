import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/use-online-status.ts';
import { useSaveStatus, formatLastSaved } from '../hooks/use-save-status';

/** TopBar — fixed header showing the app title bar. Auth removed in Wave 2a. */
export const TopBar: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lastSaved } = useSaveStatus();
  const [display, setDisplay] = useState('');

  // Update display every 10s to keep relative time fresh
  useEffect(() => {
    setDisplay(formatLastSaved(lastSaved));
    if (lastSaved === null) return;
    const interval = setInterval(() => setDisplay(formatLastSaved(lastSaved)), 10_000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  return (
    <header role="banner" className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 pl-72">
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {display && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            <span>{display}</span>
          </div>
        )}
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            <span>오프라인</span>
          </div>
        )}
      </div>
    </header>
  );
};
