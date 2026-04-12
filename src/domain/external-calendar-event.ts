/**
 * ExternalCalendarEvent — v2 domain type for read-only external calendar events.
 *
 * Phase 3 placeholder: this type defines the shape of events imported from
 * Google Calendar (or other providers). It is intentionally *type-only*:
 *   - No factory / validator.
 *   - No Dexie repository.
 *   - No UI wiring.
 *
 * Actual ingestion, persistence, and rendering land in Phase 3 together with
 * the Google Calendar sync adapter. Until then, this file exists so that code
 * elsewhere can reference the shape without growing an ad-hoc definition.
 *
 * Invariants (to be enforced by a future factory):
 * - `id` is a non-empty provider event id.
 * - `calendarId` is the source calendar id.
 * - `startTime` / `endTime` are ISO 8601 UTC datetime strings.
 * - `scheduledDate` is the local YYYY-MM-DD date that contains `startTime`.
 * - `source` identifies the provider.
 * - `fetchedAt` is a Unix epoch ms timestamp from the last sync.
 * - `schemaVersion` is always 2 for v2 entities.
 */
export interface ExternalCalendarEvent {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  /** Start of the event as ISO 8601 UTC. */
  readonly startTime: string;
  /** End of the event as ISO 8601 UTC. Must be after startTime. */
  readonly endTime: string;
  /** Local calendar date containing startTime, in YYYY-MM-DD format. */
  readonly scheduledDate: string;
  /** Provider identifier. Extend the union when new providers land. */
  readonly source: 'google-calendar';
  /** Optional provider etag for incremental sync. */
  readonly etag?: string;
  /** Unix epoch ms of the last successful sync that produced this record. */
  readonly fetchedAt: number;
  readonly schemaVersion: 2;
}

/**
 * isExternalCalendarEvent — structural type guard.
 *
 * Narrow use cases only: defensive checks at integration boundaries where a
 * value of unknown origin may flow into typed code. Does not validate deep
 * field formats (that is the job of the future factory).
 */
export function isExternalCalendarEvent(value: unknown): value is ExternalCalendarEvent {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.calendarId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.startTime === 'string' &&
    typeof v.endTime === 'string' &&
    typeof v.scheduledDate === 'string' &&
    v.source === 'google-calendar' &&
    typeof v.fetchedAt === 'number' &&
    v.schemaVersion === 2
  );
}
