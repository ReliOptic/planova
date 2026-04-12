import React from 'react';
import { useOnlineStatus } from '../hooks/use-online-status.ts';

/** TopBar — fixed header showing the app title bar. Auth removed in Wave 2a. */
export const TopBar: React.FC = () => {
  const isOnline = useOnlineStatus();

  return (
    <header role="banner" className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 pl-72">
      <div className="flex-1" />
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          <span>오프라인</span>
        </div>
      )}
    </header>
  );
};
