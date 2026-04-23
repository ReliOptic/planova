import { beforeEach, describe, expect, it, vi } from 'vitest';

const pointerWithinMock = vi.fn();
const rectIntersectionMock = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  pointerWithin: (...args: unknown[]) => pointerWithinMock(...args),
  rectIntersection: (...args: unknown[]) => rectIntersectionMock(...args),
}));

import { slotFriendlyCollisionDetection } from '../../../src/utils/drag-drop';

describe('slotFriendlyCollisionDetection', () => {
  const args = { collisions: [] } as never;

  beforeEach(() => {
    pointerWithinMock.mockReset();
    rectIntersectionMock.mockReset();
  });

  it('prefers pointer collisions for dense slot grids', () => {
    const pointerCollisions = [{ id: 'slot-2026-04-13-10-15' }];
    pointerWithinMock.mockReturnValue(pointerCollisions);

    const result = slotFriendlyCollisionDetection(args);

    expect(result).toBe(pointerCollisions);
    expect(rectIntersectionMock).not.toHaveBeenCalled();
  });

  it('falls back to rectangle overlap when pointerWithin finds nothing', () => {
    const rectCollisions = [{ id: 'pending-column' }];
    pointerWithinMock.mockReturnValue([]);
    rectIntersectionMock.mockReturnValue(rectCollisions);

    const result = slotFriendlyCollisionDetection(args);

    expect(pointerWithinMock).toHaveBeenCalledWith(args);
    expect(rectIntersectionMock).toHaveBeenCalledWith(args);
    expect(result).toBe(rectCollisions);
  });
});
