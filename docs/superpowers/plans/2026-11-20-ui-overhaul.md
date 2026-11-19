# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Grid's chat should feel like a premium desktop app, not a demo:
- a Claude-style conversation and message box;
- a three-pane layout (bots · chat · the bot's computer);
- avatars that move like living things, never jumping between moods;
- a live "screen" for each bot showing exactly what it's doing (searching, reading pages, changing lists).

Asked for by the user with reference images: a three-pane bot app with "<bot>'s screen" and routines on the right, Claude Code's chat, and no "shadow" over the avatar.

**Architecture:**
- **Shell:** the rail folds into the sidebar's footer (Lists, Apps, Settings, inbox, theme), as in the reference.
- **Chat header:** a compact bar (small live avatar, name, live status, Computer and Profile buttons) replaces the floating avatar and the fade mask over the thread.
- **Messages:**
  - assistant replies are plain text in a readable column;
  - your messages are rounded bubbles;
  - tool work shows as quiet expandable rows;
  - time separators appear after gaps.
- **Message box:** a large rounded box, with + on the left and the mic/send button on the right. The model picker sits under it.
- **Right pane:** the bot's computer (live screen, expandable) above Routines, Reminders and Lists. The gear opens the existing profile.
- **Avatar motion:** one continuous motion loop per large avatar. Pose changes ease its breathing, bounce, tilt and speed toward new targets, so nothing snaps. Small list avatars keep their cheap CSS breathing.

**Spec:** user request 2026-11-20 (images in the conversation); UI.md taste — hairline edges, no shadows, no pulse/radar.

## Global Constraints

- **Tests stay valid:** every accessible name and test id that the e2e suite uses stays the same or is updated with the test in the same commit:
  - testids `bot-message`, `user-message`, `chat-scroller`, `list-card`, `source-chip`, `cite`, `research`;
  - placeholder `Message <name>`;
  - buttons `Profile`, `Notifications`;
  - links `Lists`, `Back`, `Models`.
- No shadows, glows or gradient masks over content. Edges are 1px hairlines (`edge` classes).
- **Reduced motion:** no motion loop, no scanning bar; changes are instant.
- **The computer screen** is derived from data Grid already has (the streaming reply's parts and routine run events). It is drawn, not a real screenshot. A real browser comes with the bot's-own-computer wave, and the screen component takes an optional image so that can slot in.

---

### Task 1: Avatar motion engine

**Files:** `lib/critter/motion.ts` (+test), `components/critter/critter.tsx`, `app/globals.css`

- [ ] Failing tests:
  - `POSE_MOTION` targets exist for every pose;
  - `step(state, target, dt)` moves the parameters toward the target smoothly (no jump bigger than a set fraction per frame);
  - the phase carries on across a pose change (the body doesn't snap to rest);
  - `bodyTransform(state)` keeps volume (scaleX × scaleY ≈ 1).
- [ ] Implement. Avatars of size ≥ 48 run the loop; it pauses off-screen, in hidden tabs and under reduced motion. The CSS body keyframes stay only for small avatars.
- [ ] Commit `feat(critter): continuous, eased avatar motion`.

### Task 2: Shell and chat header

**Files:** `components/shell/app-shell.tsx`, `rail.tsx` (removed from the desktop layout), `bot-list.tsx` (footer nav), `components/chat/chat-header.tsx`, `chat-view.tsx`, `presence.tsx` (retired), `app/globals.css` (`.fade-top` removed)

- [ ] Failing e2e (`e2e/shell.spec.ts`):
  - the chat header shows the bot's name and live status, and the thread has no mask;
  - the sidebar footer links to Lists and Models and has the Notifications button;
  - the Computer button toggles the right pane.
- [ ] Implement; commit `feat(ui): three-pane shell and compact chat header`.

### Task 3: Conversation and message box

**Files:** `components/chat/message-row.tsx`, `components/chat/time-breaks.ts` (+test), `components/research/research-strip.tsx` (quiet rows), `components/chat/composer.tsx`

- [ ] Failing tests:
  - `timeBreaks` puts a separator before the first message and after gaps of 15 minutes or more;
  - e2e: assistant text isn't in a bubble, your message is;
  - a separator shows the time;
  - the message box grows to 8 lines and Enter sends.
- [ ] Implement; commit `feat(ui): Claude-style conversation and message box`.

### Task 4: The bot's computer

**Files:** `components/computer/screen.ts` (+test: `screenOf(parts, run)`), `components/computer/computer.tsx` (mini screen + expanded view), `components/computer/side-pane.tsx` (screen + Routines + Reminders + Lists)

- [ ] Failing tests:
  - `screenOf`:
    - idle → desktop;
    - a running search → a search page with the query and results as they arrive;
    - a page being read → a browser with its address, title and the first lines of text;
    - a list change → the Lists app;
    - writing → the reply as it streams;
    - a routine run → its name.
  - e2e: during "deep dive into …" the screen shows "Reading grid.test", then the answer; expanding opens a large view that closes with Escape.
- [ ] Implement; commit `feat(computer): each bot's live screen`.

### Task 5: Finish

- [ ] Visual pass (packaged build; desktop + phone, light + dark, reduced motion, worst case); full suite; README; final self-review; push.
