# Reminders in Plain Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any bot can set, change and cancel reminders from plain words ("remind me Friday 6pm to pay rent", "every 1st of the month"); at the time, the reminder arrives in that bot's chat, live, with Done and Snooze, plus a toast and a system notification.

**Architecture:** A `reminders` table and repo; time parsing with chrono-node and zone-correct repeats with luxon in one shared module (used by server and client); an in-process scheduler started from `instrumentation.ts` that claims due reminders atomically, writes a reminder message into the bot's chat and publishes an event; a Server-Sent Events route the app listens to. Bots get four tools; the chat draws tool results and delivered reminders as cards.

**Tech Stack:** Next.js 16 route handlers + `instrumentation.ts`, PGlite/Drizzle, AI SDK 7 tools and `data-*` message parts, chrono-node 2.10.3, luxon 3.7.2 (+ @types/luxon 3.7.6), Motion, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-next-50-features-design.md` → feature 1.

## Global Constraints

- Quality bar from the spec: tests first; desktop + phone, light + dark, reduced motion, worst-case data; security self-review; commit and push.
- Times are stored in UTC and shown and computed in the user's time zone (setting `timezone`, sent by the browser; fallback: the server's zone).
- A date without a time means **9:00 AM**. An ambiguous hour ("at 6") means its next future occurrence. A time that has already passed today ("today 6pm" at 7pm) is refused with a message the bot relays.
- Repeats: `none | daily | weekdays | weekly | monthly | yearly`, always computed from the original anchor so month-ends and DST don't drift (31st → last day of shorter months, back to 31st after).
- Reminder text: 1–500 characters. A bot may hold at most 200 upcoming reminders.
- Snooze presets: **10 minutes, 1 hour, This evening (6 PM, or +3 h if past 5 PM), Tomorrow 9 AM**.
- Nothing about a reminder is sent anywhere except the user's own Grid; the SSE route is a GET under the existing guard.
- UI follows UI.md: hairline edges, no shadows, presses 0.97, no animation on keyboard actions, reduced motion keeps fades only.

## Review Focus

1. **Grid wasn't running at the due time** → delivered as soon as it starts, marked "Late · was due 6:00 PM"; a repeating reminder that missed several occurrences is delivered once, then moves to the next future one. (Task 2 test `delivers missed reminders once, marked late`.)
2. **Two tabs or two scheduler ticks at once** → each reminder fires exactly once (atomic claim). (Task 2 test `claims each due reminder once`.)
3. **31st of the month, leap day and DST change** → stays on the user's wall-clock time with no drift. (Task 1 tests.)
4. **The bot is deleted with reminders pending** → its reminders go with it and the scheduler keeps running. (Task 2 test `deleting a bot removes its reminders`.)
5. **Unclear or past time from the model or the user** → no reminder is created; the bot asks again. (Task 4 tests.)

---

### Task 1: When-parsing and repeats

**Files:**
- Create: `apps/web/lib/reminders/when.ts`, `apps/web/lib/reminders/when.test.ts`
- Modify: `apps/web/package.json` (add `chrono-node@2.10.3`, `luxon@3.7.2`, dev `@types/luxon@3.7.6`)

**Interfaces:**
- Produces:
  - `type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly"`; `REPEATS: readonly Repeat[]`
  - `parseWhen(text: string, o: { now: Date; zone: string }): { at: Date; timeGuessed: boolean } | { error: "unclear" | "past" }`
  - `nextOccurrence(anchor: Date, repeat: Repeat, after: Date, zone: string): Date | null` (null for `none`)
  - `formatWhen(at: Date, o: { now: Date; zone: string }): string` → "Today, 6:00 PM" / "Tomorrow, 9:00 AM" / "Fri 20 Nov, 6:00 PM" / "21 Nov 2027, 9:00 AM"
  - `repeatLabel(repeat: Repeat, anchor: Date, zone: string): string | null` → "Every day at 9:00 AM", "Weekdays at 8:00 AM", "Every Friday at 6:00 PM", "Every month on the 1st at 9:00 AM", "Every year on 14 Feb at 9:00 AM"
  - `snoozeUntil(preset: "10m" | "1h" | "evening" | "tomorrow", o: { now: Date; zone: string }): Date`

- [ ] **Step 1: Write the failing tests** (`zone = "Asia/Kolkata"`, `now = 2026-11-19T10:00 local` unless stated)
  - `parseWhen("tomorrow at 9am")` → 2026-11-20 09:00 local, `timeGuessed: false`
  - `parseWhen("friday")` (now is Thursday 19 Nov) → Friday 2026-11-20 09:00, `timeGuessed: true`
  - `parseWhen("at 6")` at 10:00 → today 18:00; at 19:00 → tomorrow 06:00
  - `parseWhen("in 3 seconds")` → now + 3 s; `parseWhen("in 2 hours")` → now + 2 h
  - `parseWhen("today 6pm")` at 19:00 → `{ error: "past" }`; `parseWhen("purple")` → `{ error: "unclear" }`
  - `nextOccurrence(Jan 31 09:00, "monthly", after Jan 31 09:00, zone)` → Feb 28 09:00; after Feb 28 → Mar 31 09:00 (from the anchor, no drift)
  - `nextOccurrence(Feb 29 2028, "yearly", …)` → Feb 28 2029
  - `nextOccurrence(Fri 18:00, "weekdays", after Fri 18:00)` → Mon 18:00
  - DST: zone `America/New_York`, anchor 2026-03-07 09:00 daily → next is 2026-03-08 09:00 local (13:00Z, not 14:00Z)
  - `formatWhen` and `repeatLabel` exact strings above; `snoozeUntil("evening")` at 10:00 → 18:00, at 17:30 → 20:30; `"tomorrow"` → next day 09:00
- [ ] **Step 2: Run** `pnpm --filter @grid/web exec vitest run lib/reminders/when.test.ts` → FAIL (module missing)
- [ ] **Step 3: Implement `when.ts`.** chrono `parse(text, { instant: now, timezone: offset-of-zone }, { forwardDate: true })`; if the result's hour isn't `isCertain("hour")` set 09:00; for a passed time that chrono didn't move forward ("today 6pm"), return `past`. Repeats: luxon `DateTime.fromJSDate(anchor, { zone }).plus({ days|weeks|months|years: n })` stepping `n` until after `after`; weekdays steps days and skips Sat/Sun.
- [ ] **Step 4: Run** the test → PASS
- [ ] **Step 5: Commit** `feat(reminders): parse plain-words times and repeats`

### Task 2: Storage, delivery and scheduler

**Files:**
- Modify: `apps/web/lib/db/schema.ts`, `apps/web/lib/settings.ts`, `apps/web/app/api/test/reset/route.ts`
- Create: `apps/web/lib/db/migrations/0001_reminders.sql` (via `drizzle-kit generate`), `apps/web/lib/reminders/repo.ts`, `apps/web/lib/reminders/deliver.ts`, `apps/web/lib/events.ts`, `apps/web/lib/scheduler.ts`, `apps/web/instrumentation.ts`, tests `lib/reminders/repo.test.ts`, `lib/reminders/deliver.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - table `reminders`: `id text pk` (`rem_` + 12 hex), `bot_id → bots.id on delete cascade`, `text`, `anchor_at timestamptz`, `due_at timestamptz`, `repeat text`, `status text ('scheduled' | 'fired' | 'done' | 'cancelled')`, `fired_at`, `late boolean`, `source_message_id text null`, `created_at`
  - `type ReminderView = { id; botId; text; dueAt: string; repeat: Repeat; status; late: boolean; firedAt: string | null }` (in `lib/client-types.ts`)
  - repo: `createReminder({ botId, text, at, repeat, sourceMessageId? })`, `listReminders({ botId?, upcoming? })` (upcoming = scheduled, by due), `getReminder(id)`, `updateReminder(id, { text?, at?, repeat? })`, `snoozeReminder(id, until: Date)`, `completeReminder(id)`, `cancelReminder(id)`; all return `ReminderView` or null; each publishes `{ type: "reminders", botId }`
  - `userZone(): Promise<string>` in settings.ts
  - `events.ts`: `type GridEvent = { type: "message"; botId: string; messageId: string; title?: string; body?: string } | { type: "reminders"; botId: string }`; `publish(e)`, `subscribe(fn): () => void` (singleton on globalThis)
  - `deliverDue(now: Date): Promise<number>`: claims with one `UPDATE … WHERE status='scheduled' AND due_at <= now RETURNING`, writes an assistant message `{ parts: [{ type: "text", text: "⏰ <text>" }, { type: "data-reminder", data: { reminderId, text, dueAt, late } }] }`, sets `late = now - due_at > 2 min`, advances repeating ones to `nextOccurrence(anchor, repeat, now)` and keeps them `scheduled`, publishes `message` (title = bot name, body = text)
  - `scheduler.ts`: `startScheduler()`, `kickScheduler()`, `stopScheduler()`: setTimeout to the next `due_at` (capped at 30 s), runs `deliverDue(new Date())`
- [ ] **Step 1: Write failing tests**: `creates, lists upcoming and cancels`, `refuses a 201st upcoming reminder`, `deleting a bot removes its reminders`, `claims each due reminder once` (two concurrent `deliverDue` → 1 message), `writes the reminder into the chat with a data-reminder part`, `delivers missed reminders once, marked late` (repeating daily, 3 days missed → 1 message, next due tomorrow), `snooze moves a fired reminder back to scheduled`, `publishes events`
- [ ] **Step 2: Run** them → FAIL
- [ ] **Step 3: Implement** schema + `pnpm --filter @grid/web exec drizzle-kit generate --name reminders`, repo, events, deliver, scheduler; `instrumentation.ts` starts the scheduler when `NEXT_RUNTIME === "nodejs"`; reset route also deletes reminders and kicks the scheduler
- [ ] **Step 4: Run** the tests and the whole unit suite → PASS
- [ ] **Step 5: Commit** `feat(reminders): storage, scheduler and delivery`

### Task 3: API

**Files:**
- Create: `apps/web/app/api/reminders/route.ts`, `apps/web/app/api/reminders/[id]/route.ts`, `apps/web/app/api/events/route.ts`, `apps/web/app/api/reminders/route.test.ts`
- Modify: `apps/web/app/api/settings/route.ts` (accept `timezone`: an IANA zone that `Intl` accepts)

**Interfaces:**
- `GET /api/reminders?botId=&upcoming=1` → `{ reminders: ReminderView[] }`
- `POST /api/reminders` `{ botId, text, when, repeat? }` → 201 ReminderView; 400 `{ code: "unclear-time" | "past-time" }`
- `PATCH /api/reminders/:id` `{ text?, when?, repeat? }` | `{ action: "done" }` | `{ action: "snooze", preset }` → ReminderView; `DELETE` → 204 (cancel)
- `GET /api/events` → `text/event-stream`, `Cache-Control: no-cache, no-transform`, one `data: <GridEvent JSON>` per event, `: ping` every 25 s
- [ ] **Step 1: Failing route tests**: create from words, 400 for past and unclear, snooze preset, done, cancel, timezone setting rejects `"Mars/Base"`
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS
- [ ] **Step 5: Commit** `feat(reminders): reminders and live events API`

### Task 4: Bot tools

**Files:**
- Modify: `apps/web/lib/chat/tools.ts`, `apps/web/lib/chat/instructions.ts`, `apps/web/lib/models/mock.ts`, `apps/web/app/api/chat/route.ts` (pass `zone`), tests `lib/chat/tools.test.ts`, `lib/chat/instructions.test.ts`, `lib/models/mock.test.ts`

**Interfaces:**
- `makeTools({ botId, lastUserMessageId, zone })` adds `set_reminder({ text, when, repeat })`, `list_reminders()`, `change_reminder({ id, text?, when?, repeat? })`, `cancel_reminder({ id })`; each returns `{ ok: true, reminder: ReminderView, when: string, repeatLabel: string | null }` or `{ ok: false, error: string }` (error tells the model to ask the user)
- Instructions show the current time **in the user's zone** with the zone name, and (with tools on) one line on reminders: "Use set_reminder for anything time-based; pass the user's own words for `when`."
- Mock: "remind me <when> to <text>" → `set_reminder`; after the tool result → "Done — I'll remind you." or the tool's error text
- [ ] **Step 1: Failing tests**: tool creates and returns `when` label; past time → `ok:false` and nothing stored; change and cancel by id; instructions contain the local time; mock calls `set_reminder`
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS
- [ ] **Step 5: Commit** `feat(reminders): bots set, change and cancel reminders`

### Task 5: Cards, live updates and the profile list

**Files:**
- Create: `apps/web/components/reminders/reminder-card.tsx`, `apps/web/components/reminders/reminder-list.tsx`, `apps/web/components/reminders/reminders-store.tsx`, `apps/web/components/shell/live-events.tsx`, `apps/web/e2e/reminders.spec.ts`
- Modify: `components/chat/message-row.tsx` (draw `tool-*_reminder` and `data-reminder` parts), `components/chat/chat-view.tsx` (reload messages on a `message` event for this bot), `components/profile/profile-panel.tsx` (Reminders section), `components/shell/app-shell.tsx` (LiveEvents + timezone sync), `components/shell/bots-store.tsx` + `bot-list.tsx` (unread dot)

**Interfaces:**
- `useReminders(botId)` → `{ reminders: ReminderView[]; byId(id) }`, refreshed on `reminders` events
- Set card: bell in the bot's colour, text, `formatWhen`, repeat label, relative "in 2 hours"; **Change** (inline: text + when with live preview from `parseWhen`) and **Cancel**; "Get a notification then? Allow" when permission is `default`
- Due card: text, "Due 6:00 PM" (or "Late · was due …"), **Done** and **Snooze ▾** (the four presets); after Done it collapses to "Done · 6:02 PM"; state comes from the store so it survives reloads
- A `message` event for another bot: unread dot on its row, toast "<Bot>: <text>" with Open; a system notification when the tab is hidden and permission is granted; tab title prefixed with the unread count
- [ ] **Step 1: Failing e2e** (`reminders.spec.ts`): `remind me in 3 seconds to stretch` → set card shows "Today, …" → due card appears without reload → Snooze "10 minutes" → profile lists it as upcoming → cancel from profile; `add, change and cancel a reminder from the profile`; `a reminder for another bot shows an unread dot and a toast`
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS
- [ ] **Step 5: Commit** `feat(reminders): reminder cards, live updates and profile list`

### Task 6: Finish

- [ ] Full suite `pnpm typecheck && pnpm test && pnpm e2e` green
- [ ] Visual pass on the packaged build at 1440×900 and 375×812, light and dark, reduced motion; worst case: 500-character text, 200 reminders, a bot name of 24 characters, no notification permission, SSE dropped and reconnected
- [ ] Security self-review: SSE route under the guard, no reminder text in URLs, tool inputs validated
- [ ] README feature line; commit; push `next-50`
