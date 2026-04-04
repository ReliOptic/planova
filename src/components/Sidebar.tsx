import React from 'react';
import { LayoutDashboard, FolderOpen, BarChart3, History, Settings, HelpCircle, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddTask: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onAddTask }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-50 bg-slate-50 flex flex-col py-6 px-4">
      <div className="mb-10 px-2">
        <h1 className="text-lg font-black text-primary font-headline tracking-tight uppercase">Planova</h1>
        <p className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-bold mt-1">Professional Lead</p>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="text-[10px] font-bold text-slate-400 tracking-[0.1em] px-2 mb-4 uppercase">Workspace</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm",
              activeTab === item.id
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 pt-6 border-t border-surface-container-high">
        <button 
          onClick={onAddTask}
          className="w-full mb-4 py-3 px-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span className="text-sm">Add Task</span>
        </button>
        
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-all text-sm font-medium">
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-all text-sm font-medium">
          <HelpCircle size={18} />
          <span>Support</span>
        </button>
      </div>
    </aside>
  );
};
