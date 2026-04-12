import { describe, it, expect } from 'vitest';
import {
  isExternalCalendarEvent,
  type ExternalCalendarEvent,
} from '../../../src/domain/external-calendar-event';

const validEvent: ExternalCalendarEvent = {
  id: 'gcal-evt-1',
  calendarId: 'primary',
  title: 'Weekly sync',
  startTime: '2026-04-13T09:00:00.000Z',
  endTime: '2026-04-13T10:00:00.000Z',
  scheduledDate: '2026-04-13',
  source: 'google-calendar',
  fetchedAt: 1_712_000_000_000,
  schemaVersion: 2,
};

describe('ExternalCalendarEvent type guard', () => {
  it('accepts a fully-formed event', () => {
    expect(isExternalCalendarEvent(validEvent)).toBe(true);
  });

  it('accepts a fully-formed event with optional etag', () => {
    expect(isExternalCalendarEvent({ ...validEvent, etag: 'W/"abc"' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'event'],
    ['array', [] as unknown],
  ])('rejects non-object %s', (_label, value) => {
    expect(isExternalCalendarEvent(value)).toBe(false);
  });

  it('rejects wrong source', () => {
    expect(isExternalCalendarEvent({ ...validEvent, source: 'outlook' })).toBe(false);
  });

  it('rejects wrong schemaVersion', () => {
    expect(isExternalCalendarEvent({ ...validEvent, schemaVersion: 1 })).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { id: _id, ...missingId } = validEvent;
    void _id;
    expect(isExternalCalendarEvent(missingId)).toBe(false);
  });

  it('rejects non-string id', () => {
    expect(isExternalCalendarEvent({ ...validEvent, id: 123 })).toBe(false);
  });

  it('rejects non-number fetchedAt', () => {
    expect(isExternalCalendarEvent({ ...validEvent, fetchedAt: '2026' })).toBe(false);
  });
});
