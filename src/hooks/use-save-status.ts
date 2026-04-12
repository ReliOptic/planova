import { useState, useEffect } from 'react';
import { db } from '../infrastructure/persistence/db';

/**
 * useSaveStatus — tracks when data was last written to IndexedDB.
 * Listens to Dexie's transaction hooks on the tasks and scheduleBlocks tables.
 */
export function useSaveStatus(): { lastSaved: number | null } {
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setLastSaved(Date.now());

    // Dexie hooks: fire after successful creates/updates/deletes
    db.tasks.hook('creating', update);
    db.tasks.hook('updating', update);
    db.tasks.hook('deleting', update);
    db.scheduleBlocks.hook('creating', update);
    db.scheduleBlocks.hook('updating', update);
    db.scheduleBlocks.hook('deleting', update);

    return () => {
      db.tasks.hook('creating').unsubscribe(update);
      db.tasks.hook('updating').unsubscribe(update);
      db.tasks.hook('deleting').unsubscribe(update);
      db.scheduleBlocks.hook('creating').unsubscribe(update);
      db.scheduleBlocks.hook('updating').unsubscribe(update);
      db.scheduleBlocks.hook('deleting').unsubscribe(update);
    };
  }, []);

  return { lastSaved };
}

/** Format a timestamp as relative time in Korean. */
export function formatLastSaved(ts: number | null): string {
  if (ts === null) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return '방금 저장됨';
  if (diff < 60) return `${diff}초 전 저장됨`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장됨`;
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 저장됨';
}
