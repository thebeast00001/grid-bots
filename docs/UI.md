# Grid: UI, motion and the first 50 UI features

Goal: the open-source app that **looks better and feels smoother than dots, Grok Bot and Muse**. Same responsive Next.js app on desktop and phone.

---

## 1. What the screenshots and the Muse page teach

| Seen in | Lesson for Grid |
|---|---|
| Grok Bot desktop | Three panes work: bots like iMessage contacts, chat, and a context panel showing the bot's **screen** and **routines**. Monochrome canvas; colour comes only from the bots. |
| Grok Bot mobile | Favourite bots as a **row of big avatars** on top, list below. |
| Grok Bot creator | Ten seconds to a bot: **colour + shape + name**, two suggestion cards under it. |
| dots chat | The avatar **floats at the top of the chat** with name and live status ("Thinking…"). Your bubbles take the bot's colour. Reactions both ways. Links inside bot messages ("Review the fix"). Read receipts. |
| dots split view | The bot's **own browser with tabs** next to the chat: the user watches drafts and slides being made. |
| dots marketing | Plush 3D characters with **accessories** (headphones, beret, bow tie, glasses) are the brand. |
| Muse sign-in page | **One sentence, one face, one field.** "Muse 🙂, AI that ___" with a rotating verb and emoji. |

Grid takes all of it, then adds what none of them do: characters whose **face is the status**, a live screen you can replay, motion tuned to feel instant, and the same quality on a cheap Android phone.

---

## 2. Design language

**Feel:** calm canvas, characters full of life. Warm, playful, precise.

| Token area | Decision |
|---|---|
| **Canvas** | Warm neutral greys, light and dark. Colour on screen comes from the bots, not from chrome. |
| **Bot colour** | Each bot has one OKLCH hue. One CSS variable on a thread root generates its scale (`--bot-50…--bot-900`) for avatar, bubbles, focus rings, send button and status. 16 hues tuned so text on any tint passes WCAG AA in both themes. |
| **Type** | Inter Variable for UI (optical sizes, tabular numbers for times, costs, counts); JetBrains Mono for code. Base 15px on desktop, 16–17px on phones. |
| **Shape** | Radii 10 (controls), 18 (bubbles), 24 (cards, panels). Continuous "squircle" corners where the browser supports `corner-shape`, plain radius elsewhere. |
| **Depth** | **Hairline edges, no drop shadows** (same taste as your Regular app). Frosted blur (≤ 20px) only on floating layers: composer, presence pill, sheets. |
| **Status** | Shown by the **character** (eyes, pose) plus a text line. **No pulsing rings or radar effects.** |
| **Icons** | Lucide, one stroke weight, sized to the text they sit with. |
| **Sound** | Tiny optional sounds for send, approve and "bot is born". Off by default. |
| **Brand motif** | A faint dot grid behind the Studio stage and the landing page: the "grid" the bots live on. |

---

## 3. Motion system

### 3.1 Rules
1. **Every animation has a job:** feedback, showing where something went, showing state, or a rare moment of delight. "Looks cool" on a frequent action is cut.
2. **Keyboard actions never animate.** ⌘K, switching chats with shortcuts, Esc closing panels: instant.
3. **Fast:** UI motion under 300ms. Exits faster than entrances (≈ 0.7×).
4. **Interruptible:** gestures and toggles use springs or CSS transitions that retarget mid-flight; keyframes only for loops.
5. **Cheap to draw:** only `transform`, `opacity`, `clip-path` and small `filter: blur` animate. Never width, height, top, margin.
6. **Nothing grows from zero:** entrances start at `scale(0.95)` + `opacity: 0` (0.9 for popovers), from the trigger's side (`transform-origin` at the trigger). Modals stay centred.
7. **No ease-in on UI.** Ease-out for enter/exit, ease-in-out for things moving on screen, linear only for progress.
8. **Reduced motion** keeps fades and colour changes, removes movement, bob, parallax and follow-the-cursor.
9. **Hover effects** only behind `@media (hover: hover) and (pointer: fine)`.

### 3.2 Tokens (one file, used everywhere)

| Token | Value | Used for |
|---|---|---|
| `spring.snappy` | `{ type: "spring", duration: 0.25, bounce: 0 }` | Presses, toggles, small reveals |
| `spring.smooth` | `{ type: "spring", duration: 0.4, bounce: 0.1 }` | Panels, sheets, shared elements, layout |
| `spring.lively` | `{ type: "spring", duration: 0.5, bounce: 0.3 }` | Avatar reactions, studio, celebrations only |
| `ease.out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Enter/exit |
| `ease.inOut` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen movement |
| `ease.drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets and drawers |
| `dur.press` | 120ms | Press feedback |
| `dur.tooltip` | 150ms (0ms once one tooltip is open) | Tooltips |
| `dur.menu` | 180ms | Menus, popovers |
| `dur.panel` | 260ms | Panels, modals |
| `stagger` | 40ms per item, first open only | Lists entering together |

### 3.3 Which tool for which motion

| Motion | Tool | Why |
|---|---|---|
| Idle loops (breathing, bob) | CSS keyframes / WAAPI on `transform` | Runs off the main thread, stays smooth while the chat streams |
| Blinks, one-shot reactions | WAAPI | Precise timing, no React re-render |
| Gestures, drags, springs, eye tracking | Motion (motion.dev, v14.2+ for hardware-accelerated `x`/`y`/`scale`) | Velocity-aware, interruptible |
| Route changes, avatar flying between screens | View Transitions API (React `<ViewTransition>` in Next.js) with Motion `layoutId` fallback | Native shared-element morphs |
| Enter states | `@starting-style` | No mount-effect hacks |
| Live screen frames | `<canvas>` + `createImageBitmap` off the main thread | Decoding never blocks the UI |

---

## 4. The critter (avatar) system

**Anatomy:** body (a closed curve with a fixed point count, so any shape morphs into any other) · eyes (pair, style, pupils) · optional mouth (appears when talking or happy) · blush · accessory slots: head, face, ears, neck, held prop.

**Shapes (12, original):** orb, bean, pebble, capsule, soft cube, onigiri, gem, cloud, drop, sprout (blob with a leaf), puff (five lobes), ghost.
**Eyes (10):** dots, ovals, dashes, sleepy, sparkle, button, glossy, happy arcs, wide, wink.
**Accessories (30+ at launch, community packs after):** round glasses, square glasses, sunglasses, monocle, headphones, headset mic, beanie, beret, cap, chef hat, grad cap, crown, party hat, bow, bow tie, scarf, bandana, flower, antenna, halo, earrings, a chai cup, a laptop, a notebook, a magnifier…
**Materials:** flat (fill + soft inner highlight), clay (gradient + grain), plush (3D fur).

**Pose engine:** each state is a set of parameters (eye shape and look direction, squash, bob amplitude and speed, tilt, accessory wobble). Moving between states springs the parameters, so a bot *eases* from thinking into happy instead of cutting.

| State | Looks like |
|---|---|
| idle | slow breathing, random blinks, occasional glance |
| attentive | eyes find your cursor/finger, slight lean toward you |
| thinking | eyes up and to the side, slow bob |
| reading / browsing | eyes scan left-right, small nods |
| typing | quick small bounces |
| waiting on you | looks straight at you, gentle lean forward, status says what it needs |
| done | small hop, happy eyes |
| stuck | slight wobble, worried eyes |
| asleep (quiet hours) | eyes closed, slow deep breathing |
| listening / talking (calls) | eyes and body squash follow voice volume |

**Sizes:** 20 (inline mention) · 36 (list) · 40 (header) · 96 (chat presence) · 240 (studio, profile) · full screen (call).

**Cost control:** list avatars only breathe and blink; eye tracking runs only on visible avatars ≥ 40px on hover-capable devices; everything off-screen or in a hidden tab pauses; at most one plush 3D canvas alive at once, with a PNG snapshot as its placeholder.

---

## 5. Key screens

### 5.1 Desktop: three panes
```
┌──┬──────────────────┬───────────────────────────────┬─────────────────────┐
│◉ │ Search       ⌘K  │             (•‿•)              │ Maya's screen        │
│⌂ │                  │             Maya               │ ┌─────────────────┐  │
│▤ │ (•‿•) Maya  7:34 │   Reading 14 emails · Gmail    │ │ live browser    │  │
│◷ │ Drafts ready…    │                                │ └─────────────────┘  │
│@ │ (o_o) Scout 9:04 │ ┌────────────────────────┐     │ Routines             │
│  │ Shortlist of 6…  │ │ bot message            │     │ ◷ Brief    daily 8:00│
│  │ (-_-) Quill   zz │ └────────────────────────┘     │ ◷ Inbox    M–F 18:00 │
│  │                  │          ┌────────────────────┐│ ⏸ Weekly    paused   │
│  │                  │          │ your message (tint)││ Goals                │
│  │ + New bot        │ ┌ Send this email to Priya? ─┐ │ ▓▓▓▓░░  Goa < ₹9k    │
│☺ │ You              │ │ preview…  Deny · Once · Always│                     │
│  │                  │  [+] Message Maya…     🎙  ↑   │                      │
└──┴──────────────────┴───────────────────────────────┴─────────────────────┘
```

### 5.2 Phone: home
```
┌──────────────────────────┐
│ ☺              🔍   ＋   │
│  (•‿•)   (o_o)   (^‿^)   │  pinned bots, big
│  Maya    Scout   Quill   │
│ ──────────────────────── │
│ Needs you · 2          › │
│ (•_•) Ledger      8:41   │
│ Receipts coded, 1 to … │
│ (-_-) Night       7:02   │
│ Overnight: 3 tasks done  │
└──────────────────────────┘
```

### 5.3 Bot Studio
```
┌────────────────────────────────────────────┐
│ New bot                                     │
│                 (  •‿•  )    240px, alive   │
│        · · · · · · · · · · · ·  (dot grid)  │
│  ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●   colour   │
│  orb bean pebble capsule cube onigiri …     │
│  eyes:  •• ‿‿ ◕◕ -- ^^ …                    │
│  wear:  glasses  headphones  beret  more ›  │
│  Flat · Clay · Plush                        │
│  Name [ Maya             ]   @maya          │
│  Job  [ Runs my inbox    ]                  │
│        [ 🎲 ]      [ Bring to life ]        │
│  Or start from: Chief of Staff · Night Shift│
└────────────────────────────────────────────┘
```

### 5.4 Chat with work in progress
```
                 (•‿•)
                 Maya
     Checking Gmail · drafting 2 replies   ▾   ← work line (expands to steps)

 ┌──────────────────────────────────────────┐
 │ 2 replies drafted. One needs your call.  │
 │ ┌ Email · to Priya ────────────────────┐ │
 │ │ Subject: Kickoff moved to Tuesday     │ │
 │ │ Hi Priya, …                           │ │
 │ │ [Edit]   Deny · Send once · Always    │ │
 │ └───────────────────────────────────────┘ │
 └──────────────────────────────────────────┘
                              ┌─────────────┐
                              │ send it 👍  │  ← your bubble, Maya's colour
                              └─────────────┘
```

### 5.5 Take over
The live screen expands into split view. The frame turns your colour, a bar says **You're driving**, Maya shrinks to the corner and watches your cursor, **Hand back** returns control.

### 5.6 Call
Full-screen in the bot's colour, the bot large in the middle moving with its voice, captions underneath, hold anywhere to interrupt, one big hang-up button.

---

## 6. The first 50 UI features

### Foundation (1–8)
| # | Feature | Detail |
|---|---|---|
| 1 | **Token system** | Warm-neutral light/dark canvas; per-bot OKLCH scale from one CSS variable; contrast-checked bubble text. |
| 2 | **Type and numbers** | Inter Variable, optical sizing, tabular numbers for times, costs and counters. |
| 3 | **Surfaces** | Hairline edges, no drop shadows; frosted blur only on floating layers. |
| 4 | **Motion tokens** | The springs, eases and durations in §3.2 in one module; exit = 0.7 × enter; reduced-motion map. |
| 5 | **App shell** | Desktop rail + bot list + chat + context panel; drag to resize, collapse to icons, layout remembered. |
| 6 | **Page transitions** | View Transitions: chat-to-chat crossfade 150ms; avatar morphs list → chat → profile; back reverses direction. |
| 7 | **Command palette** | ⌘K / Ctrl+K, opens instantly with no animation; bots, chats, actions, settings; fully keyboard-driven. |
| 8 | **Toasts and sheets** | Sonner toasts (swipe away, pause on hover and hidden tab); Vaul sheets with detents and flick-to-dismiss (velocity > 0.11 px/ms). |

### The critter (9–17)
| # | Feature | Detail |
|---|---|---|
| 9 | **SVG critter renderer** | Body, eyes, mouth, blush, accessory slots; one component from 20px to 240px; crisp everywhere. |
| 10 | **Idle life** | Breathing (scale 1 → 1.02, 3.6s, CSS), random blinks every 2.5–6s (120ms, WAAPI), occasional glance; each bot's timing offset so a list never moves in unison. |
| 11 | **Eye contact** | Eyes follow the pointer with a spring (stiffness 150, damping 18), capped travel; visible avatars ≥ 40px, hover devices only. |
| 12 | **State poses** | The ten states in §4, blended by springs, driven by real task events. |
| 13 | **Chat presence** | 96px bot floating at the top of the chat over a soft fade; name and status pill below; status text swaps with a 150ms blur crossfade (4px → 0). |
| 14 | **One avatar, many places** | The same avatar flies sidebar → chat → profile → call; never two copies on screen. |
| 15 | **Pet the bot** | Tap the big avatar: squash and stretch (1.08 / 0.92, bounce 0.4), happy eyes. A small secret. |
| 16 | **Plush material** | 3D fur renderer for studio, profile and calls; loads after first paint behind a PNG snapshot; clay SVG on low-power devices. |
| 17 | **Accessory weight** | Hats, antennas and headphones trail the body slightly (secondary spring), so they feel physical. |

### Bot Studio (18–24)
| # | Feature | Detail |
|---|---|---|
| 18 | **Studio stage** | Big living avatar on a faint dot grid; colour, shape, eyes, wear and material rows below; name and job fields; "Bring to life". |
| 19 | **Shape morph** | Changing shape morphs the outline (≈ 280ms spring, bounce 0.15); eyes and accessories glide to their new anchors. No flash, no swap. |
| 20 | **Colour pour** | New colour spreads out from the swatch's side (circular `clip-path` reveal, 300ms ease-out); bubble preview recolours with it. |
| 21 | **Try-on** | An accessory drops onto its anchor and settles (bounce 0.3); the bot glances up at it the first time. |
| 22 | **Instant eye preview** | Hovering an eye style shows it immediately (no animation); clicking commits with a blink. |
| 23 | **Shuffle** | Dice cycles six random looks 60ms apart, lands on the last with a hop; hold to keep shuffling. |
| 24 | **Birth moment** | "Bring to life": eyes open, stretch, hop, then the bot flies into its sidebar slot and its first message types in. Once per bot. |

### Home and bot list (25–30)
| # | Feature | Detail |
|---|---|---|
| 25 | **Bot rows** | 36px avatar, name, last line, time, unread dot; status through the avatar's eyes and a short text, never a pulsing ring. |
| 26 | **Pinned row** | Favourite bots as big avatars on top (phone), live poses visible at a glance; long-press to reorder. |
| 27 | **Drag to reorder** | Lifted row (scale 1.02, edge darkens) follows the pointer on a spring; siblings slide aside; drop settles without bounce. |
| 28 | **Swipe actions** | Phone: swipe for pin / mute / archive; rubber-band past the edge; flick commits by velocity; Android haptic tick at the threshold. |
| 29 | **Today view** | *Needs you* (approval cards), *While you slept* (night results), *Coming up* (next 24h of routines and goals); cards stagger 40ms on first open only. |
| 30 | **Rolling counters** | Unread, cost and task counts roll digits vertically (200ms) when they change. |

### Chat (31–41)
| # | Feature | Detail |
|---|---|---|
| 31 | **Bubbles** | Bot messages on a neutral surface; yours in the bot's colour (or your own accent); grouped runs drop repeated avatars; time on hover or swipe. |
| 32 | **Streaming text** | Words arrive in small chunks that fade and un-blur (120ms, 2px → 0). No typewriter, no jumping layout; code blocks and tables reserve their space first. |
| 33 | **Scroll that behaves** | Sticks to the bottom while streaming, lets go when you scroll up, "↓ 3 new" pill springs in; position saved per chat. |
| 34 | **Send** | The text leaves the composer and lands as the bubble (same element, 220ms); composer clears at once; sending is optimistic with silent retry. |
| 35 | **Work line** | While a bot works: one compact line with the app icons in use and the current step ("Reading 14 emails · Gmail"). Expands to the step list with thumbnails. Replaces typing dots. |
| 36 | **Approval card** | Plain sentence + full preview + editable fields + *Deny · Allow once · Always*. Money and deletes need hold-to-confirm (1.2s linear fill; release snaps back in 200ms). Expiry shown as a thin countdown bar. |
| 37 | **Draft cards** | Email, post, slide and page previews; open into the side panel as a shared-element expansion; revisions show a diff toggle. |
| 38 | **Reactions** | Hover or long-press opens a small bar scaling from its trigger (0.9 → 1); the emoji pops onto the bubble corner (bounce 0.35); bots react to you the same way. |
| 39 | **Reply and mention** | Swipe right (phone) or hover action to quote; the quote slides into the composer; `@` opens a picker with avatars; mentions show as coloured chips. |
| 40 | **Composer** | Grows with text; paste or drop files with instant thumbnails; slash commands; bot/model chip; mic morphs into a live waveform recorder; send button in the bot's colour, presses to 0.97. |
| 41 | **Group chats** | Each bot's messages carry its colour and mini avatar; a hand-off marker ("→ @scout") shows when one bot passes work to another. |

### Side panel and the bot's computer (42–46)
| # | Feature | Detail |
|---|---|---|
| 42 | **Live screen tile** | The bot's browser streamed at 5–15 fps (adaptive), a quiet "Live" label, the bot's clicks as a cursor trail fading over 600ms. |
| 43 | **Full view** | The tile expands into split view with the bot's browser tabs (≈ 300ms spring); Esc collapses instantly. |
| 44 | **Take over** | Frame turns your colour; "You're driving" bar; the bot shrinks to a corner and watches; "Hand back" returns control. |
| 45 | **Routines and goals** | Next-run countdown, toggles, "Run now"; goal bars animate only when the value changes; schedule typed in plain English with the next five runs previewed. |
| 46 | **Profile and replay** | Soul, memories (search, edit, delete with undo), apps, skills, model, budget in tabs with a sliding `clip-path` indicator; scrub through any past task. |

### Voice (47)
| # | Feature | Detail |
|---|---|---|
| 47 | **Call screen** | Grows out of the header call button; full-screen in the bot's colour; the bot moves with its voice (audio level, smoothed); live captions; hold to interrupt; big hang-up. |

### Phone and polish (48–50)
| # | Feature | Detail |
|---|---|---|
| 48 | **Phone navigation** | List → chat push with edge-swipe back that follows your finger (layer below moves at 0.3× for depth, flick commits); context panel becomes a bottom sheet (peek / half / full); pull down on the list to search. |
| 49 | **Feedback layer** | Every pressable presses to 0.97; `:focus-visible` rings in the bot's colour; Android haptics map (tick at thresholds, success on approve); optional sounds. |
| 50 | **Landing + README hero** | Muse-style one-liner: **"Grid. Bots that ___"** with rotating verbs (answer your email, watch flight prices, work the night shift…) and a living critter inline that changes shape and colour with each verb; one install command with a copy button; the hook video below. |

---

## 7. Phone specifics

- Safe areas, keyboard-aware composer (`interactive-widget=resizes-content` + VisualViewport), 44px minimum targets.
- iPhone push works only for PWAs added to the Home Screen (iOS 16.4+): onboarding shows a one-time "Add to Home Screen" nudge on iPhone.
- iOS web has no vibration API; haptics come later through a thin native wrapper (Tauri mobile or Capacitor) around the same app.
- Live screen on phones: lower frame rate, tap to expand full screen, two-finger takeover disabled (takeover is desktop-first).

## 8. Performance budget

| Metric | Budget |
|---|---|
| Chat route first-load JavaScript | ≤ 180 KB gzipped (3D adds ≤ 250 KB, only in studio/profile/call) |
| Interaction to next paint | ≤ 100ms p75 on a ~₹15k Android phone |
| Frame rate | 60 fps (120 on high-refresh screens) while streaming with avatars idling, at 4× CPU throttle |
| Layout shift in chat | 0 |
| Animated critters on screen | ≤ 12 SVG + 1 plush; the rest static |
| Live screen decode | Off the main thread |

## 9. Accessibility

- Avatars are decorative; every status also exists as text and is announced politely to screen readers.
- Full keyboard use: every action reachable, visible focus, no keyboard action animates.
- Reduced motion: no bob, no parallax, no eye tracking; fades and colour changes stay.
- Colour is never the only signal (unread = dot + bold; status = text).

## 10. How we hold the bar

1. Every animation reviewed at 0.25× and frame by frame before merge, then again the next day.
2. Each milestone tested on a real low-end Android phone and an iPhone.
3. Side-by-side screen recordings against dots and Grok Bot for the same flows (make a bot, ask for a task, approve, watch). Grid must win on time to first bot, perceived reply speed and smoothness.
4. A motion lint in CI: no `transition: all`, no `scale(0)`, no `ease-in` on UI, no animation bound to keyboard shortcuts, no animated layout properties.
