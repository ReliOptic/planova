import type React from 'react';
import { CSS } from '@dnd-kit/utilities';
import type { Transform } from '@dnd-kit/utilities';
import { SLOT_HEIGHT_PX } from './TimelineShared';

/**
 * buildBlockStyle — computes absolute positioning CSS for a task block within
 * the timeline column layout.
 */
export function buildBlockStyle(
  topPx: number,
  heightPx: number,
  column: number,
  totalColumns: number,
  transform: Transform | null,
  isDragging: boolean,
  isResizing: boolean,
): React.CSSProperties {
  const leftBase = 96;
  const rightGap = 16;
  const colWidth =
    totalColumns > 1
      ? `calc((100% - ${leftBase + rightGap}px) / ${totalColumns} - 4px)`
      : `calc(100% - ${leftBase + rightGap}px)`;
  const colLeft =
    totalColumns > 1
      ? `calc(${leftBase}px + ${column} * (100% - ${leftBase + rightGap}px) / ${totalColumns})`
      : `${leftBase}px`;

  return {
    transform: isResizing ? undefined : CSS.Translate.toString(transform),
    top: `${topPx}px`,
    height: `${Math.max(heightPx, 24)}px`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging || isResizing ? 100 : 10,
    left: colLeft,
    width: colWidth,
  };
}

/**
 * startResize — attaches pointer/touch listeners for drag-to-resize on a block edge.
 * Cleans up all listeners on pointer release.
 */
export function startResize(
  e: React.MouseEvent | React.TouchEvent,
  edge: 'top' | 'bottom',
  taskId: string,
  onResize: (taskId: string, edge: 'top' | 'bottom', deltaSlots: number) => void,
  setIsResizing: (v: boolean) => void,
): void {
  e.stopPropagation();
  e.preventDefault();
  setIsResizing(true);
  const isTouch = 'touches' in e;
  const startY = isTouch ? e.touches[0].clientY : e.clientY;
  const slotPx = SLOT_HEIGHT_PX / 4;

  const cleanup = (): void => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };

  const finish = (endY: number): void => {
    const deltaSlots = Math.round((endY - startY) / slotPx);
    if (deltaSlots !== 0) onResize(taskId, edge, deltaSlots);
    setIsResizing(false);
    cleanup();
  };

  const onMove = (ev: MouseEvent): void => { ev.preventDefault(); };
  const onEnd = (ev: MouseEvent): void => finish(ev.clientY);
  const onTouchMove = (ev: TouchEvent): void => { ev.preventDefault(); };
  const onTouchEnd = (ev: TouchEvent): void => finish(ev.changedTouches[0].clientY);

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}
