# TODOS

## Phase 1: Schedule Spine

### Admin Bootstrap
- Auto-create `users/{uid}` doc on first login with `role: 'user'`
- Document in README how to promote first admin via Firestore console
- **Why:** Removing hardcoded admin email leaves no entry point for the role-based admin system
- **Depends on:** Firestore rules update (remove hardcoded email)

### HistoryView Empty State
- Replace hardcoded demo data with empty state UI after deleting constants.ts
- Show: "No completed tasks yet. Complete tasks from your timeline to see your velocity here."
- **Why:** Prevents broken History tab between Phase 1 (delete demo data) and Phase 2 (wire real data)
- **Depends on:** Deleting constants.ts

### Firestore Composite Indexes
- Create `firestore.indexes.json` with indexes: `uid + status`, `uid + status + completedAt`, `uid + startTime`
- Include in setup docs and README
- **Why:** Status-based queries require composite indexes. Without them, queries fail at runtime.
- **Depends on:** Status-based query strategy

### Critical Error Handling Gaps
- Add error handling for localStorage write failures in Settings (storage full or disabled)
- Add user-visible feedback for failed Firestore operations (currently console.error only)
- Add confirmation + error handling for concurrent task deletion
- **Why:** 2 critical failure modes with silent failures identified in review

### Create DESIGN.md via /design-consultation
- Document the existing design system: Material Design 3 tokens, Manrope+Inter typography, 5-level surface hierarchy, component patterns, state color map
- Include: color tokens, spacing scale, border radius convention, typography scale, component inventory
- **Why:** Implicit design system works for solo dev but breaks when contributors guess patterns. Documented system prevents drift.
- **Depends on:** Phase 1 completion (so the design system is stable before documenting)

### Data Model Split (CEO Review — Codex finding)
- Split single Task type into: `Task` (backlog item), `ScheduleBlock` (time allocation on timeline), `ExternalCalendarEvent` (GCal read-only, Phase 3 type definition only)
- Task has many ScheduleBlocks. ScheduleBlock references parent Task.
- Add `schemaVersion: number` to all documents for versioned migration
- **Why:** Overloaded Task record becomes unmaintainable when GCal sync and AI scheduling land. Codex flagged this as the #1 architectural concern.
- **Effort:** M (CC: ~15 min)
- **Priority:** P1 — foundation change, do first
- **Depends on:** Nothing. Blocks everything else in Phase 1.

### Timeline 15-min Snap Grid (CEO Review — Codex finding)
- Implement 15-minute snap grid for drag-to-schedule
- Tasks visually sized by their actual duration (not fixed 1-hour blocks)
- No collision prevention (tasks can stack/overlap visually)
- Tasks extending past workday end show clip indicator
- **Why:** Without this, any non-1-hour task renders incorrectly on the timeline. The current drag primitive is "drop on hour slot = 1 hour" which breaks with 15m/30m/2h tasks.
- **Effort:** S (CC: ~10 min)
- **Priority:** P1 — blocks Phase 1 timeline rewrite
- **Depends on:** getTaskPosition rewrite, Data Model Split

### Defer Projects & Analytics Tabs (CEO Review — scope reduction)
- Defer Projects tab (task grouping by project) and Analytics tab (time-per-project, completion trends) to post-Phase 3
- Remove or hide Projects/Analytics nav items in Phase 1 to avoid dead UI
- Phase 2 slimmed to: History + Settings only
- **Why:** Proves GCal thesis faster. Projects and Analytics aren't blocking for the core scheduling loop.
- **Effort:** S to remove nav items. M to build later.
- **Priority:** P3 (post-GCal)
- **Depends on:** Phase 3 completion, real usage data

### Basic Accessibility Pass
- Add focus rings (`:focus-visible`) on all interactive elements
- Add `aria-label` on icon-only buttons (logout, add task, nav collapse, complete, delete)
- Add skip-nav link for keyboard users
- Add `aria-live="polite"` region for toast notifications
- Add `role="main"`, `role="navigation"`, `role="complementary"` landmarks
- **Why:** Zero a11y in current code. For open source, basic a11y is the difference between usable and hostile.
- **Depends on:** Phase 1 completion
