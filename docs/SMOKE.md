# Smoke test checklist — Tauri desktop build

Run this list on a clean Windows 11 machine after `npm run tauri:dev` or after installing a fresh MSI/NSIS bundle. Each item is a manual check; there is no automated runner for Tauri-specific paths.

## Environment

- [ ] Windows 11 host
- [ ] WebView2 Runtime present (default on Win11)
- [ ] Rust 1.77+ (`rustc --version`)
- [ ] Node 20+ (`node --version`)
- [ ] Visual Studio Build Tools 2022 with "Desktop development with C++" installed

## First boot

- [ ] `npm install` completes without errors
- [ ] `npm run tauri:dev` launches a single window titled "Planova"
- [ ] DevTools console has no red errors, no CSP violations
- [ ] The IndexedDB database `planova` appears in DevTools → Application → IndexedDB

## Backlog + CRUD

- [ ] "새 작업" / "+ Add task" opens the modal
- [ ] Creating a task with a title saves it and closes the modal
- [ ] The new task appears in the Pending column
- [ ] Editing a task (title, duration, priority) persists across reload
- [ ] Deleting a task prompts for confirmation and removes it

## Timeline scheduling

- [ ] Dragging a backlog task onto a timeline slot schedules it
- [ ] The dropped block renders at the correct slot with correct height
- [ ] Dragging the bottom edge of a scheduled block resizes the block only
  - [ ] `Task.durationMinutes` (planned) does **not** change in IndexedDB after the resize
  - [ ] `ScheduleBlock.endTime` advances correctly
- [ ] Dragging the top edge of a block shifts the start time without touching the plan
- [ ] Dragging a scheduled block back to the Pending column removes its ScheduleBlock

## Persistence

- [ ] Quit the app fully, relaunch via `tauri:dev`
- [ ] All tasks and scheduled blocks reappear exactly as left
- [ ] API key entered in Settings → AI is still present after relaunch

## Backup / Restore

- [ ] Settings → 내보내기 opens a native Save As dialog with default filename `planova-backup-YYYY-MM-DD.json`
- [ ] Cancelling the save dialog produces no error toast
- [ ] Accepting the save writes a valid JSON file to disk
- [ ] Settings → 가져오기 opens a native Open dialog filtered to `.json`
- [ ] Picking a valid backup shows the confirm modal with task/block counts
- [ ] "교체" replaces all data, "병합" adds non-conflicting rows
- [ ] Picking a malformed JSON file shows the "유효하지 않은 백업 파일입니다" error toast

## Online / offline

- [ ] With network up, Settings → AI section shows online state
- [ ] Disable the network adapter; the AI section reflects offline and disables model calls
- [ ] Re-enable the network; the section returns to online without a restart

## AI recommendations (Section 3)

- [ ] With < 10 completed ScheduleBlocks, the sidebar shows the "활성화까지 X개 남음" progress badge
- [ ] After seeding ≥ 10 completions spanning ≥ 4 weeks, recommendation cards appear
- [ ] "추가" creates a Pending task with the recommended title
- [ ] "숨기기" removes the card for 7 days

## Single instance

- [ ] Launching a second Planova shortcut while the app is running brings the existing window to front (no duplicate window)

## Installer (`tauri:build` run)

- [ ] `npm run tauri:build` completes
- [ ] `src-tauri/target/release/bundle/msi/*.msi` exists
- [ ] `src-tauri/target/release/bundle/nsis/*-setup.exe` exists
- [ ] MSI install on a clean Win11 box adds "Planova" to the Start Menu
- [ ] NSIS installer runs per-user without UAC
- [ ] Uninstall via Settings → Apps removes the shortcut (data in `%LOCALAPPDATA%\com.planova.app\` is intentionally preserved — mention in release notes)

Tick every box before cutting a release tag.
