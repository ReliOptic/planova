import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';

/**
 * Prefer the pointer position for dense calendar slots, then fall back to
 * rectangle overlap when the pointer is outside every droppable.
 */
export const slotFriendlyCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};
