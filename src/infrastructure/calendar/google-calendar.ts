import { ok, err, type Result } from '../../domain/result';
import type { AppError } from '../../domain/errors';
import type { ExternalCalendarEvent } from '../../domain/external-calendar-event';
import { getValidToken } from './oauth';

const GCAL_API = 'https://www.googleapis.com/calendar/v3';

interface GCalEvent {
  readonly id: string;
  readonly summary?: string;
  readonly start: { dateTime?: string; date?: string };
  readonly end: { dateTime?: string; date?: string };
  readonly etag?: string;
}

interface GCalEventsResponse {
  readonly items: readonly GCalEvent[];
}

/**
 * Fetch events from Google Calendar for a date range.
 *
 * @param startDate - YYYY-MM-DD inclusive start
 * @param endDate   - YYYY-MM-DD inclusive end
 * @param calendarId - Calendar ID (default: 'primary')
 */
export async function fetchGoogleCalendarEvents(
  startDate: string,
  endDate: string,
  calendarId = 'primary',
): Promise<Result<readonly ExternalCalendarEvent[], AppError>> {
  const tokenResult = await getValidToken('google');
  if (!tokenResult.ok) return tokenResult as unknown as Result<never, AppError>;

  const timeMin = `${startDate}T00:00:00Z`;
  const timeMax = `${endDate}T23:59:59Z`;

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  try {
    const response = await fetch(
      `${GCAL_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.value}` },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return err({ kind: 'repo/write-failed', cause: `Google Calendar API error: ${text}` });
    }

    const data = (await response.json()) as GCalEventsResponse;
    const now = Date.now();

    const events: ExternalCalendarEvent[] = data.items
      .filter((e) => e.start.dateTime && e.end.dateTime) // skip all-day events
      .map((e) => ({
        id: e.id,
        calendarId,
        title: e.summary ?? '(제목 없음)',
        startTime: e.start.dateTime!,
        endTime: e.end.dateTime!,
        scheduledDate: e.start.dateTime!.slice(0, 10),
        source: 'google-calendar' as const,
        etag: e.etag,
        fetchedAt: now,
        schemaVersion: 2 as const,
      }));

    return ok(events);
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: `Google Calendar fetch error: ${String(e)}` });
  }
}
