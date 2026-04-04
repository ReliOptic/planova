import React from 'react';
import { Search, Bell, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';
import { logout } from '../firebase';

interface TopBarProps {
  user: User | null;
}

export const TopBar: React.FC<TopBarProps> = ({ user }) => {
  return (
    <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl flex justify-between items-center px-8 h-16 pl-72">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            placeholder="Search tasks or projects..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative text-slate-500 hover:text-primary transition-colors">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-tertiary rounded-full border-2 border-white"></span>
        </button>
        
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-surface-container-highest">
            <div className="text-right">
              <p className="text-xs font-bold text-on-surface">{user.displayName || 'Architect'}</p>
              <p className="text-[10px] text-on-surface-variant">{user.email}</p>
            </div>
            <img
              alt="User profile"
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              src={user.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => logout()}
              className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
