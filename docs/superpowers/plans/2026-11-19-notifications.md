# Notifications That Respect You — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything a bot does on its own lands in a notification inbox that survives reloads; whether it also pings you (toast, system notification, or a Web Push when Grid isn't open) follows clear rules: per-bot mute, quiet hours, and how much the result matters.

**Architecture:** A `notifications` table written by the reminder and routine deliverers through one `notify()` that applies the ping rules and publishes a `notification` event. The open app shows toasts and system notifications from that event; when no app is connected, `notify()` sends a Web Push (web-push 3.6.7, VAPID keys sealed in the vault) to subscribed browsers and the service worker shows it. Unread counts come from the server. Bots get `muted_until`; settings get `quietHours` and `pingFor`; routine runs get a `rate_result` tool.

**Tech Stack:** as features 1–2, plus web-push 3.6.7 (+ @types/web-push 3.6.4).

**Spec:** `docs/superpowers/specs/2026-11-19-next-50-features-design.md` → feature 3.

## Global Constraints

- Ping rules, in order: bot muted → no ping · reminder → ping · inside quiet hours → no ping · routine failed → ping · importance vs `pingFor`: `all` pings high/normal/low, `skip-quiet` (default) pings high/normal, `important` pings high only. A notification that doesn't ping still goes to the inbox, with its reason (`muted` / `quiet-hours` / `not-important`).
- Quiet hours: one window per day in the user's zone, `{ from: "HH:mm", to: "HH:mm" }`, may cross midnight; off by default.
- Mute choices: **1 hour**, **Until tomorrow 9 AM**, **Until I turn it back on** (stored as year 9999).
- `rate_result({ importance: "high" | "normal" | "low", headline })` only in routine runs; headline ≤ 120 characters becomes the notification text; no call → normal, text = routine name.
- Web Push only when no app is connected (open event streams = 0); payload `{ title, body, url, tag }`; expired subscriptions (404/410) are deleted; VAPID subject `mailto:notifications@grid.invalid` (no user details).
- Inbox keeps the newest 500; opening a bot's chat marks its notifications read.
- UI per UI.md; quality bar as before.

## Review Focus

1. **Quiet hours across midnight and DST** → 22:00–07:00 holds a 23:30 and a 06:59 routine, not a 07:00 one. (Task 1 tests.)
2. **Muted bot's reminder** → recorded, not pinged; un-muting later doesn't replay it. (Task 1 test.)
3. **Push service says the subscription is gone (410)** → it's deleted, others still get theirs, nothing throws. (Task 3 test.)
4. **Two tabs open** → each shows the toast for itself, no Web Push sent. (Task 3 test: push only with zero streams.)
5. **Reload** → unread counts and dots come back from the server. (Task 4 e2e.)

---

### Task 1: Inbox storage and ping rules
**Files:** schema (`notifications`, `bots.muted_until`) + migration, `lib/notifications/rules.ts` (`shouldPing`, `inQuietHours`), `lib/notifications/repo.ts` (`notify`, `listNotifications`, `unreadCounts`, `markRead({ botId? , ids? , all? })`), `lib/events.ts` (`notification` event), `lib/reminders/deliver.ts` + `lib/routines/run.ts` call `notify` (their `message` events stay for the chat), settings (`quietHours`, `pingFor`), tests.
- [ ] Failing tests: rules table (each rule above), quiet hours across midnight/DST, notify writes + publishes, mute recorded not pinged, unread counts per bot, markRead by bot and all, trims to 500, deleting a bot removes its notifications, reminders and routines create notifications.
- [ ] Implement; commit `feat(notifications): inbox and ping rules`

### Task 2: API, mute and settings
**Files:** `app/api/notifications/route.ts` (GET list + counts), `app/api/notifications/read/route.ts` (POST), `app/api/bots/[id]` (PATCH `mute: "1h"|"tomorrow"|"forever"|null` → `mutedUntil`), `app/api/settings` (`quietHours`, `pingFor`), tests.
- [ ] Failing route tests; implement; commit `feat(notifications): inbox API, mute and quiet hours`

### Task 3: Web Push and importance
**Files:** `lib/notifications/push.ts` (VAPID keys, `subscribe`, `unsubscribe`, `sendPush`, injectable transport for tests), table `push_subscriptions`, `app/api/push/route.ts` (GET public key, POST subscribe, DELETE), `app/api/events/route.ts` (count open streams), `public/sw.js` (`push` → showNotification), `lib/chat/tools.ts` (`rate_result` when `runId` is given), `lib/routines/run.ts` (importance + headline), mock (`urgent` → high), tests.
- [ ] Failing tests: push sent only with zero streams; 410 deletes the subscription; payload shape; rate_result sets importance and headline; low importance doesn't ping under skip-quiet.
- [ ] Implement; commit `feat(notifications): web push and rated routine results`

### Task 4: UI
**Files:** `components/notifications/inbox.tsx` (bell + count, panel: Today/Earlier, avatar, text, time, unread dot, reason chip for quiet ones, Mark all read, settings link), `components/notifications/notifications-store.ts`, rail + phone header bell, `components/shell/bots-store.tsx` (unread from server), `components/shell/live-events.tsx` (toasts from `notification` events only when `alert`), `components/profile/profile-panel.tsx` (Notifications: On / Muted + choices), `app/settings/notifications/page.tsx` (turn on notifications → permission + push subscribe in production builds, quiet hours, ping level), `e2e/notifications.spec.ts`.
- [ ] Failing e2e: inbox lists a reminder, survives reload, opening the chat clears it; muted bot's reminder lands quietly (no toast); quiet hours hold a routine result; ping level "Only what matters" holds a normal result.
- [ ] Implement; commit `feat(notifications): inbox, mute and settings`

### Task 5: Finish
- [ ] Full suite; visual pass (packaged build: desktop/phone, light/dark, reduced motion; 500 notifications, long text, muted and quiet reasons); real Web Push check in Playwright Chromium against the packaged build (subscribe, close the tab, fire a reminder, see the push); security review; README; commit; push.
