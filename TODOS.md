# TODOS

## Completed (B3 Roadmap)

### Data Model Split (Plan A)
- ✅ Task ↔ ScheduleBlock decoupled — resize path no longer mutates `Task.durationMinutes`
- ✅ `blockDurationMinutes` derived field added to `TaskViewModel`
- ✅ Timeline components use `blockDurationMinutes ?? durationMinutes`
- ✅ `ExternalCalendarEvent` type defined (`src/domain/external-calendar-event.ts`) — Phase 3 placeholder
- ✅ Timezone bug fixed in resize path (direct UTC arithmetic instead of `buildUTCTime`)

### Tauri 2 Shell Conversion
- ✅ `src-tauri/` scaffolded (Cargo.toml, main.rs, lib.rs, tauri.conf.json, capabilities)
- ✅ `vite-plugin-pwa`, `workbox-window`, service worker registration removed
- ✅ `public/_headers`, `public/_redirects`, `broadcast.ts`, `register-sw.ts` deleted
- ✅ Vite config migrated: `base: './'`, `target: chrome120`, `clearScreen: false`, `strictPort: true`
- ✅ CSP moved to `tauri.conf.json` (`connect-src` allows `openrouter.ai`)
- ✅ Single-instance enforcement via `tauri-plugin-single-instance`
- ✅ Backup Export/Import wired to native file dialogs (`tauri-plugin-dialog` + `tauri-plugin-fs`)
- ✅ Bundle config: MSI + NSIS, `com.planova.app` identifier
- ✅ CI workflow: GitHub Actions with `ubuntu-latest` test + `windows-latest` tauri build
- ✅ Smoke test checklist: `docs/SMOKE.md`
- ✅ README rewritten for desktop-only target

### AI Recommendation Engine
- ✅ Pattern detector: weekday-time, recurring-title, title-cluster detectors
- ✅ Heuristic recommender: deterministic recommendations (works offline)
- ✅ LLM recommender: OpenRouter-based enrichment with JSON schema validation, 10s timeout, graceful fallback
- ✅ `useRecommendations` hook: orchestrates pipeline, daily LLM limit (2/day), 7-day pattern cooldown
- ✅ `RecommendationsPanel` component in Sidebar: accept → create Task, dismiss → 7-day hide
- ✅ Settings toggle: "작업 추천 사용" checkbox in AI section

## Phase 4 (Post-B3)

### API Key Security Upgrade
- Migrate API key storage from plaintext IndexedDB to OS keyring (Windows Credential Manager)
- Consider `tauri-plugin-stronghold` or system keyring wrapper
- Requires migration logic for existing users
- **Why:** Desktop app has better options than browser storage, but adds Rust-side complexity and UX changes (master password)

### Code Signing
- Obtain Azure Trusted Signing or OV code signing certificate
- Integrate into `tauri:build` pipeline
- **Why:** Removes SmartScreen first-launch warning for end users

### Auto-Update
- Set up `tauri-plugin-updater` with a static file server (GitHub Releases or S3)
- **Why:** Currently users must manually re-download and install new versions

### Native OS Features
- System tray icon with status display
- Startup on boot option
- OS toast notifications for overdue tasks
- **Why:** Enhances desktop integration, but not needed for MVP

### Multi-Block Scheduling
- Allow a single Task to have multiple ScheduleBlocks (spread across days)
- Update `composeViewModels` to return `scheduleBlockIds: readonly string[]`
- New UI for split-scheduling
- **Why:** Current 1:1 assumption limits multi-day task planning

### Google Calendar Sync (Phase 3)
- Implement `ExternalCalendarEvent` ingestion via Google Calendar API
- Add Dexie repository + table for external events
- Read-only timeline overlay
- **Why:** The `ExternalCalendarEvent` type is defined but has no plumbing yet

### Projects & Analytics
- Task grouping by project
- Time-per-project tracking, completion trends
- **Why:** Deferred from original Phase 2 to focus on core scheduling loop

### Accessibility
- Focus rings (`:focus-visible`) on all interactive elements
- `aria-label` on icon-only buttons
- Skip-nav link, `aria-live` for toasts
- Landmark roles (`main`, `navigation`, `complementary`)
