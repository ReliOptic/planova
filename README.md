# Planova

Drag-and-drop task scheduling on a visual timeline.

## Features

- **Visual Timeline** - Day view with 15-minute snap grid. Drag tasks from backlog onto your schedule.
- **Drag & Drop** - Move tasks between backlog and timeline, or reposition scheduled blocks.
- **Resize Blocks** - Drag top/bottom edges of task blocks to adjust start time or duration.
- **Double-Click Edit** - Double-click any scheduled task to edit title, duration, priority, or deadline.
- **Task Lifecycle** - 4 states: Pending → Scheduled → In Progress → Completed.
- **Overdue Detection** - Tasks past their end time get flagged automatically.
- **Work Hours** - Configurable start/end hours (Settings page, persisted in localStorage).
- **Google Auth** - Sign in with Google via Firebase Authentication.
- **Real-time Sync** - Firestore-backed. Changes sync instantly across tabs.
- **Current Time Marker** - Red line on today's timeline shows where you are right now.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Firebase (Auth + Firestore)
- dnd-kit (drag and drop)
- Motion (animations)
- Lucide React (icons)

## Getting Started

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```

2. Add your Firebase config to `firebase-applet-config.json`.

3. Enable Google sign-in in your Firebase Console under Authentication > Sign-in method.

4. Add `localhost` to Authorized domains in Firebase Console (Authentication > Settings).

5. Run the dev server:
   ```
   npm run dev
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Type-check with `tsc --noEmit` |
