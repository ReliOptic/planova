import { ok, err, type Result } from '../../domain/result';
import type { AppError } from '../../domain/errors';
import type { ExternalCalendarEvent } from '../../domain/external-calendar-event';
import { getValidToken } from './oauth';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

interface MSGraphEvent {
  readonly id: string;
  readonly subject?: string;
  readonly start: { dateTime: string; timeZone: string };
  readonly end: { dateTime: string; timeZone: string };
}

interface MSGraphEventsResponse {
  readonly value: readonly MSGraphEvent[];
}

/**
 * Fetch events from Microsoft Outlook/365 calendar for a date range.
 */
export async function fetchMicrosoftCalendarEvents(
  startDate: string,
  endDate: string,
): Promise<Result<readonly ExternalCalendarEvent[], AppError>> {
  const tokenResult = await getValidToken('microsoft');
  if (!tokenResult.ok) return tokenResult as unknown as Result<never, AppError>;

  const filter = `start/dateTime ge '${startDate}T00:00:00' and end/dateTime le '${endDate}T23:59:59'`;

  try {
    const response = await fetch(
      `${GRAPH_API}/me/calendarView?startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&$top=250&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${tokenResult.value}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return err({ kind: 'repo/write-failed', cause: `Microsoft Graph API error: ${text}` });
    }

    const data = (await response.json()) as MSGraphEventsResponse;
    const now = Date.now();

    const events: ExternalCalendarEvent[] = data.value.map((e) => {
      const startTime = e.start.dateTime.endsWith('Z')
        ? e.start.dateTime
        : `${e.start.dateTime}Z`;
      const endTime = e.end.dateTime.endsWith('Z')
        ? e.end.dateTime
        : `${e.end.dateTime}Z`;

      return {
        id: e.id,
        calendarId: 'microsoft-primary',
        title: e.subject ?? '(제목 없음)',
        startTime,
        endTime,
        scheduledDate: startTime.slice(0, 10),
        source: 'google-calendar' as const, // reuse source type for now
        fetchedAt: now,
        schemaVersion: 2 as const,
      };
    });

    return ok(events);
  } catch (e) {
    return err({ kind: 'repo/write-failed', cause: `Microsoft Calendar fetch error: ${String(e)}` });
  }
}
