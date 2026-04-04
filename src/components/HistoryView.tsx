import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { VELOCITY_DATA } from '@/src/constants';
import { Filter, Download, Compass, FileText, Paintbrush, Users, CheckCircle2, Timer, Lightbulb } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const tasks = [
    {
      id: '1',
      title: 'Site Plan Revision - Zone A',
      description: 'Updated topographic markers and adjusted building footprint for better drainage flow.',
      priority: 'Low',
      duration: '4h 20m',
      date: 'Oct 27, 2023',
      progress: 100,
      icon: Compass,
      color: 'bg-secondary-container text-primary'
    },
    {
      id: '2',
      title: 'Structural Integrity Report',
      description: 'Final sign-off for the concrete foundation stress tests on the North Tower.',
      priority: 'High',
      duration: '1h 45m',
      date: 'Oct 26, 2023',
      progress: 100,
      icon: FileText,
      color: 'bg-tertiary-container/10 text-tertiary'
    },
    {
      id: '3',
      title: 'Facade Material Selection',
      description: 'Postponed due to delay in sample shipping from the vendor. Awaiting limestone slabs.',
      priority: 'Medium',
      duration: '--',
      date: 'Oct 26, 2023',
      progress: 15,
      icon: Paintbrush,
      color: 'bg-surface-container-highest text-on-surface-variant'
    },
    {
      id: '4',
      title: 'Client Feedback Sync',
      description: 'Stakeholder review of the 3D model. Clients requested minor changes to the entryway width.',
      priority: 'Medium',
      duration: '50m',
      date: 'Oct 25, 2023',
      progress: 100,
      icon: Users,
      color: 'bg-primary-fixed text-primary'
    }
  ];

  return (
    <div className="p-12 space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant tracking-[0.2em] uppercase mb-2">Retrospective</p>
          <h2 className="text-5xl font-extrabold font-headline text-on-surface tracking-tighter">History</h2>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex bg-surface-container-high p-1 rounded-lg">
            {['Day', 'Week', 'Month', 'Year'].map(label => (
              <button
                key={label}
                className={`px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded transition-colors ${label === 'Week' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-lowest'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-surface-container-low px-4 py-2 rounded-lg flex flex-col items-end border border-outline-variant/20">
            <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">Week 42</span>
            <span className="font-headline font-bold text-primary">Oct 23 - Oct 29</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="font-headline text-xl font-bold mb-1">Weekly Velocity</h3>
              <p className="text-on-surface-variant text-sm">Completed vs. Planned output</p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold tracking-widest uppercase">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span> Done
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-surface-container-highest"></span> Remaining
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={VELOCITY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#424752' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="done" stackId="a" fill="#00488d" radius={[0, 0, 0, 0]} barSize={40} />
                <Bar dataKey="remaining" stackId="a" fill="#e1e3e4" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 bg-surface-container-highest p-8 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: 78 }, { value: 22 }]}
                  innerRadius={60}
                  outerRadius={75}
                  startAngle={90}
                  endAngle={450}
                  dataKey="value"
                >
                  <Cell fill="#00488d" />
                  <Cell fill="#f3f4f5" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-headline font-extrabold text-on-surface">78%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Completion</span>
            </div>
          </div>
          <h4 className="font-headline font-bold text-lg">Focus Score</h4>
          <p className="text-sm text-on-surface-variant">Increased by 12% from last week</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-headline text-2xl font-bold">Weekly Log</h3>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-surface-container-high rounded text-sm font-medium flex items-center gap-2">
              <Filter size={16} /> Filter
            </button>
            <button className="px-4 py-2 bg-surface-container-high rounded text-sm font-medium flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="group flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl hover:bg-surface-container-high transition-colors border border-transparent hover:border-outline-variant/10">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${task.color}`}>
                  <task.icon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-headline font-bold text-on-surface">{task.title}</h4>
                    <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full uppercase tracking-widest">
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant max-w-lg">{task.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-12 text-right">
                <div className="hidden md:block">
                  <span className="text-[10px] block font-bold text-on-surface-variant uppercase tracking-widest">Duration</span>
                  <span className="font-headline font-bold text-on-surface">{task.duration}</span>
                </div>
                <div>
                  <span className="text-[10px] block font-bold text-on-surface-variant uppercase tracking-widest">Date</span>
                  <span className="font-headline font-bold text-on-surface">{task.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md">{task.progress}%</span>
                  <div className={`flex items-center gap-2 ${task.progress === 100 ? 'text-primary' : 'text-outline'}`}>
                    {task.progress === 100 ? <CheckCircle2 size={20} fill="currentColor" className="text-white" /> : <Timer size={20} />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-container p-8 rounded-xl flex items-start gap-12 border-l-4 border-primary">
        <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
          <Lightbulb className="text-primary" size={24} />
        </div>
        <div>
          <h4 className="font-headline font-bold text-lg mb-2">Weekly Insight</h4>
          <p className="text-on-surface-variant leading-relaxed max-w-3xl">
            You performed <span className="font-bold text-on-surface">15% better</span> during early morning hours (8 AM - 11 AM) than in the afternoons. Most high-priority tasks were completed on Wednesday. Suggesting a lighter schedule for Thursday afternoons to prevent burnout based on your velocity patterns.
          </p>
          <div className="mt-4 flex gap-4">
            <button className="text-primary text-sm font-bold tracking-widest uppercase hover:underline">Adjust Planner Settings</button>
            <button className="text-on-surface-variant text-sm font-bold tracking-widest uppercase hover:underline">Dismiss</button>
          </div>
        </div>
      </section>
    </div>
  );
};
