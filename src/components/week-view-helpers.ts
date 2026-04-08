/**
 * week-view-helpers — pure date utilities for the week-view calendar.
 */

/** Compute the ISO Monday date string of the week containing a given YYYY-MM-DD. */
export function getWeekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Abbreviated day labels Mon–Sun. */
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Descriptor for a single 15-minute time slot. */
export interface SlotDescriptor {
  readonly hour: number;
  readonly minute: number;
  readonly isHourStart: boolean;
  readonly label: string;
}

/**
 * buildWeekSlots — generates 15-minute slot descriptors for the given hour range.
 *
 * @param startHour - First work hour (inclusive).
 * @param endHour   - Last work hour (exclusive).
 */
export function buildWeekSlots(startHour: number, endHour: number): SlotDescriptor[] {
  const slots: SlotDescriptor[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(2000, 0, 1, h, m);
      const label = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      slots.push({ hour: h, minute: m, isHourStart: m === 0, label });
    }
  }
  return slots;
}
