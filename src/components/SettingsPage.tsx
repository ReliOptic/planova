import React, { useState, useRef, useEffect } from 'react';
import { getWorkHours, saveWorkHours } from '@/src/utils/settings';

const hourOptions = Array.from({ length: 18 }, (_, i) => {
  const h = i + 5; // 5am to 10pm
  const d = new Date(2000, 0, 1, h);
  return {
    value: h,
    label: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
  };
});

export const SettingsPage: React.FC = () => {
  const initial = getWorkHours();
  const [startHour, setStartHour] = useState(initial.start);
  const [endHour, setEndHour] = useState(initial.end);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleSave = () => {
    const result = saveWorkHours({ start: startHour, end: endHour });
    if (result.success) {
      setMessage({ text: 'Settings saved.', isError: false });
    } else {
      setMessage({ text: result.error || 'Could not save settings', isError: true });
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const inputClass =
    'w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface appearance-none focus:ring-2 focus:ring-primary outline-none transition-all';
  const labelClass =
    'block text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.05em] mb-1.5';

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold font-headline text-on-surface mb-1">Settings</h2>
      <p className="text-sm text-on-surface-variant mb-8">Configure your workspace preferences.</p>

      {/* Work Hours */}
      <section className="mb-8">
        <h3 className="text-sm font-bold text-on-surface mb-4 uppercase tracking-wide">Work Hours</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Start Time</label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className={inputClass}
            >
              {hourOptions.filter((o) => o.value < endHour).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className={inputClass}
            >
              {hourOptions.filter((o) => o.value > startHour).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="mt-4 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white text-sm font-bold rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all"
        >
          Save Work Hours
        </button>
        {message && (
          <p className={`mt-2 text-sm font-medium ${message.isError ? 'text-tertiary' : 'text-green-600'}`}>
            {message.text}
          </p>
        )}
      </section>

      <hr className="border-surface-container-highest mb-8" />

      {/* API Keys (Phase 4) */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">AI Scheduling</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight bg-surface-container-highest text-on-surface-variant rounded-full">Coming Soon</span>
        </div>
        <p className="text-xs text-on-surface-variant">Gemini and OpenRouter API keys for AI-powered scheduling.</p>
      </section>

      <hr className="border-surface-container-highest mb-8" />

      {/* Calendar (Phase 3) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">Google Calendar</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight bg-surface-container-highest text-on-surface-variant rounded-full">Coming Soon</span>
        </div>
        <p className="text-xs text-on-surface-variant">Connect Google Calendar to sync your schedule.</p>
      </section>
    </div>
  );
};
