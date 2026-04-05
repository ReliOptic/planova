import React from 'react';
import { LogOut } from 'lucide-react';
import { User } from 'firebase/auth';
import { logout } from '../firebase';

interface TopBarProps {
  user: User | null;
  onError?: (msg: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onError }) => {
  return (
    <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 pl-72">
      <div className="flex-1" />

      <div className="flex items-center gap-6">
        {user && (
          <div className="flex items-center gap-3 pl-4">
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface">{user.displayName || 'User'}</p>
              <p className="text-[10px] text-on-surface-variant">{user.email}</p>
            </div>
            {user.photoURL ? (
              <img
                alt="User profile"
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                src={user.photoURL}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={async () => {
                try { await logout(); }
                catch { onError?.('Sign-out failed. Please try again.'); }
              }}
              className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="Logout"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
