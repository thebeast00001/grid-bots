# Grid: the next 50 features

Status: draft for approval · 2026-11-19 · builds on milestone 1 (branch `m1`)

## Why

Grid should beat Grok Bot, OpenAI dots and Meta Muse at the things people do every day, not only match their headline demos. They are closed, pricey ($20–$500/mo), locked to one model and to some countries, and keep your data. Grid is free, runs any model on your own machine, and already has the best-looking bots. What it lacks is **reach into daily life**: it can't remind you, check things on a schedule, search the web, keep a list, reach you on your phone, or act in your apps. These 50 close that gap and then go past the competitors.

## How each feature gets built ("absolute perfection")

Every feature is done only when all of this is true:

1. **A short design note** (what you do, what you see, edge cases) before code.
2. **Tests first**: unit tests for the logic, a browser test for the real path, each seen failing before passing.
3. **Works with the test model and with no extra accounts** wherever possible; anything that needs your account (a token or key) is built against a faithful fake and marked for your live check.
4. **Visual pass** at desktop and phone width, light and dark, with reduced motion, and with worst-case data (long names, empty states, 500 items, slow network, errors).
5. **Motion and feel** to UI.md: presses, springs, no animation on keyboard actions, hairline edges, no shadows.
6. **Self-review** of the diff against security (the local API guard, secrets, prompt injection from web pages and emails) and data safety.
7. **Committed and pushed** to GitHub, with a one-paragraph changelog entry.

## Approaches considered (the order to build them)

| | Order | Trade-off |
|---|---|---|
| **A. Everyday first (recommended)** | Things that work with zero extra accounts (reminders, routines, web research, lists, search, voice, Telegram), then bots acting in your apps, then the bot's own computer. | Every feature is usable the day it ships and testable here. It also builds the engine (scheduler, tools, notifications, approvals) that the later waves need. |
| B. Action first | Approvals, apps and the bot's browser first, to match dots and Grok's headline demos sooner. | Needs your Composio/email accounts to verify; built on an engine that doesn't exist yet, so it would be rebuilt. |
| C. Polish first | Command palette, transitions, swipe and reorder first. | Looks better quickly but doesn't change what Grid can do. |

## The 50, in build order

"Needs you" = something only you can provide for the live check (the feature is still built and tested with a fake).

### Wave 1 · Everyday essentials (no extra accounts)

1. **Reminders in plain words.** "Remind me Friday 6pm to pay rent", "every 1st of the month". The bot confirms the exact time, and at that time it messages you with Done and Snooze buttons. Upcoming reminders in the profile, editable. *Beats them:* none of the three treat reminders as first-class; Grok needs a routine for it.
2. **Routines.** "Every weekday at 8, give me a briefing." Plain-words schedule with next-run preview, Run now, pause, run history with each result. *Engine:* the in-process scheduler all later waves use.
3. **Notifications that respect you.** Desktop and phone notifications from the installed app, a notification inbox, per-bot mute, quiet hours, and "only ping me when it matters" (the bot rates importance; low ones wait for the daily brief).
4. **Web research with sources.** The bot searches and reads pages, shows "Reading 4 pages…", and answers with source chips you can open. Uses the model's own web search when the provider has one (ChatGPT plan, OpenAI, Anthropic, Gemini), else a free Brave/Tavily key or your own SearXNG. Page text is treated as untrusted (no instructions followed from it). *Needs you:* nothing for page reading; a key only if your model has no built-in search.
5. **Lists and trackers.** Groceries, packing, to-dos, habits, expenses. Bots create and update them; they render as live checklist cards in chat and in a Lists tab; tick items, reorder, share as text. *Beats them:* all three answer in prose; Grid keeps the list.
6. **Search everything.** One search across every chat, memory, list and file, grouped by bot, jumping to the exact message with a highlight.
7. **Command palette.** Ctrl+K / ⌘K: jump to any bot, chat, list or setting; run actions (new bot, new reminder, switch model, mute). Instant, fully keyboard.
8. **Bot management.** Pin favourites, reorder (drag on desktop, long-press on phone), swipe actions on phone (pin, mute, archive), archive, delete with undo, duplicate as a starting point.
9. **Voice in, voice out.** Hold to talk (browser speech, or the provider's transcription when available), voice notes saved with transcripts, Read aloud with a per-bot voice. Works in Hindi and other languages the browser supports.
10. **Starter bots.** A gallery of 12 real-life bots ready in one tap, each with its soul, lists and routines pre-wired: meal planner, fitness coach, travel planner, money buddy, study buddy, home admin, job hunt coach, gift finder, language tutor, health log, reading club, focus coach.

### Wave 2 · Your bots, everywhere

11. **Telegram.** Paste a bot token from @BotFather (60 seconds) and talk to any of your bots from anywhere: text, voice notes, photos; reminders and routine results arrive there too. Works without a public URL. *Needs you:* a Telegram bot token.
12. **Your phone on the same Wi-Fi.** Turn on "Use from my phone", scan a QR code, and the installed app on your phone talks to Grid on your computer. One-time pairing code, device list, revoke any device. Off by default; the guard still blocks other websites.
13. **Daily brief.** A Today screen and a morning message at your time: reminders due, list items, routine results, goals that moved, weather and news on topics you choose. Delivered in-app, as a notification or on Telegram.
14. **Goals.** Long-running objectives ("get a flight to Goa under ₹6,000 by Dec 10", "run 5k by March"): the bot makes a plan, checks on a schedule, shows progress, and only messages you when something changes. *Beats them:* Muse has goals but US-only and Meta-only models.
15. **Watchers.** Watch any page, price or RSS feed for a change ("tell me when this drops below X"); shows a before/after diff; feeds goals and the brief.
16. **Group chats.** 2–6 bots in one chat; `@` to hand one a job; bots answer in turn and can hand off; a "round table" mode for decisions.
17. **Chief of Staff.** One bot hands work to specialists and shows a task board of who is doing what; gathers results into one reply.
18. **Library and pages.** Bots write documents (plans, itineraries, reports, recipes) into a Library: rich page view, edit, version history, export to Markdown or PDF.
19. **Files both ways.** Each bot has a folder: it can make CSV, Markdown and HTML files you download; you drop files in for it to use.
20. **Knowledge base.** Give a bot documents, notes or web pages and it answers from them with citations. Works offline with local embeddings (Ollama) or with the provider's.

### Wave 3 · Bots that act, safely

21. **Rules and approval cards.** Every action has a rule (do it / ask first / never). Approval cards show the exact email, event or payment with editable fields, Allow once / Always / Deny, hold-to-confirm for money and deletes, and an expiry bar.
22. **Activity log with undo.** A timeline of everything every bot did (messages sent, files changed, items added), filterable, with undo where the action allows.
23. **Apps via Composio.** Gmail, Calendar, Drive, Slack, Notion, GitHub and 1,000 more with your own Composio key; per-bot access; read and write allowed separately. *Needs you:* a Composio key and the accounts to connect.
24. **Email without any service.** IMAP/SMTP for Gmail (app password), Outlook, iCloud, Zoho: read, search, summarise, draft replies; sending always asks first. *Needs you:* a mailbox to test.
25. **Calendar without any service.** Subscribe to your Google/iCloud/Outlook calendar link (read) or CalDAV (read/write): agenda, free slots, add events with approval.
26. **Any MCP server.** Add local or remote MCP servers, browse a registry, and give tools to chosen bots with rules.
27. **Skills.** Import `SKILL.md` skills from a GitHub URL, zip or folder; a scanner shows what each touches; turn on per bot.
28. **Teach a skill by chatting.** "Remember how we did that" turns a conversation into a skill you review and approve; versioned.
29. **Inbox triage (flagship).** "Every weekday at 8, triage my inbox and draft replies": a template that combines email, routines, approvals and the brief, end to end.
30. **Spend and safety controls.** Cost per message, per bot and per day; daily caps per bot; allowed domains and recipients; a guard model that reviews risky actions before they run.

### Wave 4 · The bot's own computer

31. **A browser per bot.** Each bot gets its own isolated browser on your machine to look things up, fill forms and compare prices. *Beats them:* Grok shares one computer across all bots.
32. **Watch it work.** A live screen tile in the chat header and a full split view with step captions.
33. **Take over, hand back.** Drive the bot's browser yourself for a login or captcha, then hand it back.
34. **Stays signed in, secure forms.** Each bot's browser keeps its logins (encrypted); passwords go through a form the model never sees.
35. **Recordings and replay.** Every browser task is saved as a replay with steps you can scrub and share.
36. **Code and data sandbox.** The bot runs code in a sandbox for maths, spreadsheets and charts; charts render inline.
37. **Mini apps.** "Make me a split-the-bill calculator": the bot builds a small web app, previews it beside the chat, and saves it to the Library.

### Wave 5 · Character and delight

38. **Plush 3D bots.** Fuzzy plush rendering in the Studio and profile, with the current SVG as the fast fallback.
39. **Bot cards.** Export a bot as a beautiful card image plus a link or code; anyone can import it into their Grid.
40. **Accessory packs.** Drop-in packs (SVG + JSON) that the community can contribute with a pull request.
41. **Live voice calls.** Talk to a bot in real time; its face moves with its voice. *Needs you:* a provider with realtime voice.
42. **Make and edit images.** Generate and edit images in chat through the provider's image model.
43. **Motion that connects.** The avatar flies list → chat → profile, chat-to-chat crossfades, rolling number counters.
44. **Learns from feedback.** Thumbs up/down and "don't do that" become memories or rules; a weekly "what I learned" note you can edit.
45. **Model face-off and fallbacks.** Compare two models on the same message side by side; set a fallback model for when one is down or out of allowance.

### Wave 6 · Trust and platform

46. **Backup and restore.** One-click export of everything (data, souls, files) and restore on another machine; scheduled automatic backups.
47. **Local-only mode.** A switch that guarantees nothing leaves your computer (local models only), with a visible badge; per-bot too.
48. **Household profiles.** Separate people on one Grid, each with their own bots and memory, with a PIN lock.
49. **Demo mode and tour.** Try Grid with no keys at all using demo bots, plus a short guided tour.
50. **Desktop app.** Tray icon, start at login, a global shortcut that opens a quick chat with any bot.

## Parked (you said later)

- Claude and Gemini connect (quick key connect + sign-in through `ant` / Google Cloud logins).

## Left to the builder

Per-feature designs, data model changes, which libraries (kept to what Grid already uses where possible), and the exact UI within UI.md's rules.
