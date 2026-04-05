import React from 'react';
import { LayoutDashboard, History, Settings, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddTask: () => void;
  pendingCount?: number;
  completedCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onAddTask, pendingCount, completedCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: pendingCount },
    { id: 'history', label: 'History', icon: History, badge: completedCount },
    { id: 'settings', label: 'Settings', icon: Settings, badge: undefined },
  ];

  return (
    <aside role="navigation" aria-label="Main navigation" className="h-screen w-64 fixed left-0 top-0 z-50 bg-slate-50 flex flex-col py-6 px-4">
      <div className="mb-10 px-2">
        <h1 className="text-lg font-black text-primary font-headline tracking-tight uppercase">Planova</h1>
        <p className="text-[10px] uppercase tracking-[0.05em] text-on-surface-variant font-bold mt-1">Schedule</p>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="text-[10px] font-bold text-slate-400 tracking-[0.1em] px-2 mb-4 uppercase">Workspace</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              activeTab === item.id
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600 hover:bg-slate-200"
            )}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary min-w-[20px] text-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 pt-6 border-t border-surface-container-high">
        <button
          onClick={onAddTask}
          aria-label="Add new task"
          className="w-full mb-4 py-3 px-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <Plus size={18} />
          <span className="text-sm">Add Task</span>
        </button>

      </div>
    </aside>
  );
};
