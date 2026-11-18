# Grid: the first 100 features

★ = a star driver: the feature people screenshot, post or mention when they recommend Grid.
**When** = the milestone in [PLAN.md §13](../PLAN.md#13-roadmap) (M1 first bot · M2 does things · M3 computer · M4 team · M5 launch · Later).
Where a feature comes from a rival, the source is noted: *(Grok)*, *(dots)*, *(Muse)*, *(Duet)*.

---

## A. Bots with an identity (1–13)

| # | Feature | What you get | When |
|---|---|---|---|
| 1 ★ | **Bot Studio** | Make a bot in ten seconds: name, shape, colour, eyes, accessory, material. The preview reacts while you edit. *(Grok, dots)* | M1 |
| 2 ★ | **Procedural critters** | 12 shapes × 16 colours × 10 eye styles × 30+ accessories × 3 materials (flat, clay, plush). Millions of unique bots, all original designs. | M1 |
| 3 ★ | **A living avatar** | Breathes, blinks, follows your cursor or finger, and shows what it's doing through its face and pose: thinking, browsing, waiting on you, done, stuck, asleep. | M1 |
| 4 | **Soul file** | Personality, tone, values and hard limits in a readable `SOUL.md` you can edit, diff and share. | M1 |
| 5 | **Interview onboarding** | A new bot asks you five questions about its job and writes its own soul and charter. *(Grok guides)* | M1 |
| 6 | **Job charter** | What the bot owns, its goals, what it must always ask about. Shown on its profile. | M1 |
| 7 | **Handles and mentions** | `@maya`, `@scout` in any chat or channel. | M1 |
| 8 | **Per-bot voice** | Each bot gets a voice (any speech provider, local included) and speaking style. | M4 |
| 9 | **Clone, remix, history** | Duplicate a bot, change its job, roll back its personality to any earlier version. | M2 |
| 10 ★ | **Bot cards** | Export a pretty card (avatar, name, job, skills) as image + link; anyone can import it into their Grid in one click. | M5 |
| 11 ★ | **Bot Hub** | A community gallery of bots, templates and accessory packs, backed by a public GitHub registry. | M5 |
| 12 | **Starter templates** | Chief of Staff, Inbox Triage, Night Shift, Researcher, Job Hunter, Apartment Hunter, Expense Manager, Social Manager, Study Buddy, Fitness Coach, Dev Bot, Sales Outbound. | M2 |
| 13 | **Accessory packs** | Hats, glasses, headphones and props as installable packs; the easiest open-source contribution. | M5 |

## B. Any model, any account (14–24)

| # | Feature | What you get | When |
|---|---|---|---|
| 14 ★ | **Every provider** | OpenAI, Anthropic, Google, xAI, Groq, Mistral, DeepSeek, Qwen, OpenRouter, Together, Fireworks, Azure, Bedrock, Vertex, Foundry, any OpenAI-compatible URL. | M1 |
| 15 ★ | **Use your ChatGPT plan** | Sign in with ChatGPT and spend your Go/Plus/Pro/Business allowance in Grid, through OpenAI's official flow for open-source apps. Shows remaining allowance, lets you cap it. | M1 |
| 16 ★ | **Local and offline** | Ollama, LM Studio, llama.cpp, vLLM. Everything except cloud apps works with no internet. | M1 |
| 17 | **Brain / hands / eyes routing** | Per bot: a smart model to plan and talk, a cheap one for routine steps and sub-agents, a vision model for screens. | M2 |
| 18 | **Fallback chains** | When a provider errors or rate-limits, the bot moves to the next model and tells you. | M2 |
| 19 | **Live model catalogue** | Context size, price, vision/tool support for every model, refreshed from a public catalogue. | M1 |
| 20 ★ | **Cost meter** | Cost per message, task, routine, bot and day. Budgets and hard caps per bot. | M2 |
| 21 | **Key vault** | Keys encrypted at rest, never shown to the browser again, usage per key. | M1 |
| 22 | **Model face-off** | Send one prompt to 2–4 models side by side, pick the winner for this bot. | M2 |
| 23 | **Claude the right way** | Claude through API key, Bedrock, Vertex, Foundry or OpenRouter, with a clear note on why subscription login isn't offered. | M1 |
| 24 | **Pluggable speech and embeddings** | Local Whisper / Kokoro or any cloud speech provider; local or cloud embeddings. | M4 |

## C. Chat that feels like texting a friend (25–36)

| # | Feature | What you get | When |
|---|---|---|---|
| 25 | **Messenger-grade chat** | Streaming replies, markdown, code, tables, maths, diagrams, link previews. | M1 |
| 26 | **Reactions both ways** | React to bot messages; bots react to yours. Your reactions teach the bot. *(dots)* | M1 |
| 27 | **Replies and standing instructions** | Quote any message; pin an instruction the bot keeps following ("keep an eye on #launch"). *(dots)* | M1 |
| 28 | **Attachments** | Drop or paste files, images, PDFs, audio, screenshots, links. | M1 |
| 29 | **Voice notes** | Send a voice note, get one back in the bot's voice. | M4 |
| 30 ★ | **Call your bot** | Live voice call; the avatar's eyes and body move with its voice; live captions; interrupt any time. *(dots)* | M4 |
| 31 | **Group chats** | You + 2–6 bots; `@` assigns work; bots coordinate in the open. *(Grok)* | M4 |
| 32 | **Rich cards** | Approval cards, email/post/slide previews, file cards, choice buttons, mini forms. | M2 |
| 33 | **Edit, regenerate, branch** | Change a message and fork the conversation from there. | M1 |
| 34 | **Search everything** | One search over chats, files, pages and memories (⌘K). | M2 |
| 35 | **Live status and receipts** | "Reading 14 emails", "In Gmail", "Waiting for you", plus read receipts. *(dots)* | M1 |
| 36 | **Reminders in plain words** | "Remind me Friday to chase the invoice"; "send this at 9am". | M2 |

## D. Every bot gets a computer (37–46)

| # | Feature | What you get | When |
|---|---|---|---|
| 37 ★ | **A computer per bot** | Isolated sandbox with browser, terminal and files: local Docker, your own cloud sandbox key, or a host browser profile. Unlike Grok, bots never share cookies. | M3 |
| 38 ★ | **Watch it work** | Live screen in the side panel; expand to full view; the bot's clicks show as a cursor trail. *(Grok, dots)* | M3 |
| 39 | **Take over, hand back** | Drive the bot's browser yourself for a step (login, tricky form), then hand it back. *(dots, Grok)* | M3 |
| 40 | **Robust browsing** | Uses the page structure first, vision as fallback, retries with a different approach before asking you. | M3 |
| 41 | **Stays logged in** | Each bot keeps its own browser profile, so it doesn't re-login every run. | M3 |
| 42 | **Secure forms** | When a site needs a password or card, the bot asks through a form; the value goes to the vault; the model never sees it. *(dots, Grok)* | M3 |
| 43 | **Files both ways** | Move files between your chat and the bot's computer; browse its files. | M3 |
| 44 | **Builds and previews apps** | The bot writes code, runs it and gives you a live preview link. *(dots)* | M3 |
| 45 | **Use my computer** | Opt-in in the desktop app, per-app permission, always visible. | Later |
| 46 ★ | **Replay any task** | Every computer session is recorded as a timeline of screens and actions you can scrub. | M3 |

## E. Apps, triggers and channels (47–56)

| # | Feature | What you get | When |
|---|---|---|---|
| 47 | **1,000+ apps via Composio** | Gmail, Calendar, Slack, Notion, GitHub, Linear, Drive, Sheets, HubSpot… one click to connect. | M2 |
| 48 | **Any MCP server** | Remote URL or local process; a browser for public MCP registries; interactive MCP Apps in chat. | M2 |
| 49 | **Per-bot access** | The inbox bot gets Gmail, the talent bot gets LinkedIn. Nobody gets everything. | M2 |
| 50 | **Read vs write scopes** | Let a bot read mail without being able to send. *(Muse)* | M2 |
| 51 | **Triggers** | New email from a client, Slack mention, meeting in 15 minutes, new GitHub issue, webhook, RSS item: wake a bot. *(Grok)* | M2 |
| 52 | **Works without SaaS keys** | Native mail (IMAP/SMTP), calendar (CalDAV), RSS, webhooks, generic REST. | M2 |
| 53 | **Writes its own integration** | No connector? The bot builds one from the app's API or CLI as a skill, and asks you to approve it. *(Muse)* | M3 |
| 54 ★ | **Talk from any chat app** | Telegram, WhatsApp (official API), Slack, Discord, email. Same bot, same memory. *(Muse, dots)* | M4 |
| 55 | **Notifications that respect you** | Web push, channel pings, email digest, quiet hours, per-bot mute. | M4 |
| 56 ★ | **Bring your history** | Import ChatGPT and Claude export files so bots know you on day one. | M2 |

## F. Skills (57–64)

| # | Feature | What you get | When |
|---|---|---|---|
| 57 ★ | **Speaks SKILL.md** | Install any of the ~90k skills on skills.sh or any Claude Code / Codex / Cursor skill. | M2 |
| 58 | **Import from anywhere** | GitHub URL, gist, zip or folder; pinned versions; update when you say. | M2 |
| 59 | **Skill scanner** | Static checks + model review before install; shows what it touches; trust levels. | M2 |
| 60 | **Skill builder** | Describe a job; the bot writes the skill; test it in a playground. | M3 |
| 61 ★ | **Teach by showing** | Do a task once in the bot's browser while it records; it becomes a skill. *(Grok)* | M3 |
| 62 | **Permission manifest** | Each skill declares the apps, domains and secrets it needs; anything else is blocked. | M2 |
| 63 | **Publish in one click** | Share a skill to Bot Hub (opens a pull request on the registry). | M5 |
| 64 | **Skill marketplace** | Browse, search, ratings, "used by N bots", install into a bot. | M5 |

## G. Autonomy: routines, goals, memory (65–76)

| # | Feature | What you get | When |
|---|---|---|---|
| 65 | **Routines in plain words** | "Every weekday at 8" becomes a schedule; test-run now; pause; history. *(Grok)* | M2 |
| 66 | **Event routines** | A trigger fires, a bot runs a skill. | M2 |
| 67 ★ | **Goals** | Long-running objectives with a progress bar: "Goa flights under ₹9k before Dec 10". The bot checks on schedule and pings you only on change. *(Muse)* | M4 |
| 68 ★ | **Morning brief** | One digest across your apps and bots each morning, in Grid or on Telegram. *(Duet, Grok)* | M4 |
| 69 | **Noise budget** | Bots message first only when something changed or needs you; you set how chatty. *(Duet)* | M4 |
| 70 | **Memory you can see** | Per-bot and shared memories; "remember this"; every memory shows its source; edit or delete. *(Muse)* | M1 |
| 71 | **Memory as files** | `USER.md` and `MEMORY.md` mirrors with semantic search on top: readable and portable. | M1 |
| 72 | **Learns from feedback** | Corrections and reactions become rules ("always cc Priya"). *(dots)* | M2 |
| 73 ★ | **Night Shift** | Queue work before bed; bots run overnight; results waiting at breakfast. | M4 |
| 74 | **Delegation** | Chief of Staff splits work across bots and parallel sub-agents. *(Grok, dots)* | M4 |
| 75 | **Bot-to-bot with guards** | Bots message each other with loop detection and a daily cost cap. | M4 |
| 76 | **Task board** | Every task of every bot: queued, running, waiting on you, done. | M2 |

## H. Trust and safety (77–86)

| # | Feature | What you get | When |
|---|---|---|---|
| 77 | **Rules per action** | For each kind of action: auto · ask first · only when I ask · never · hand to me. Per bot, per app. *(dots)* | M2 |
| 78 | **Approval cards** | Exactly what will be sent, bought or deleted; edit before approving; *Allow once / Always / Deny*; hold to confirm money and deletes. *(Grok, Duet)* | M2 |
| 79 | **Guard model** | A second model reviews risky actions and spots instructions smuggled in through emails and pages. *(Muse, dots)* | M2 |
| 80 | **Untrusted-content firewall** | Emails, pages and files are treated as data, never as orders. | M2 |
| 81 | **Spend controls** | Daily model budget and purchase limit per bot; hard stop. | M2 |
| 82 | **Allowlists** | Limit which websites and apps each bot can touch. | M3 |
| 83 | **Audit log** | Append-only log of every action, approval and cost; export it. *(Muse)* | M2 |
| 84 ★ | **Stop everything** | One button (or `/stop` on Telegram) pauses all bots, routines and goals. | M2 |
| 85 | **Private by default** | Data on your machine, telemetry off, open code you can read. | M1 |
| 86 | **Inspectable harness** | Open any bot's soul, rules, skills and memory files and see why it acted. *(Muse)* | M2 |

## I. Library and outputs (87–92)

| # | Feature | What you get | When |
|---|---|---|---|
| 87 | **Library** | Every file, draft, report and page any bot made, searchable. | M3 |
| 88 ★ | **Pages** | Bots publish live mini-dashboards and reports you can open, pin and refresh. *(Grok)* | M3 |
| 89 | **Drafts with diffs** | Emails, posts and docs land as drafts; revisions show what changed. | M2 |
| 90 | **Inline previews** | Slides, docs, sheets, charts and images render right in chat. *(dots)* | M3 |
| 91 | **Share a page** | Public link to a page from your own server. | M5 |
| 92 | **Export everything** | Bots, chats, memories, pages as Markdown/JSON. No lock-in. | M2 |

## J. Platform and community (93–100)

| # | Feature | What you get | When |
|---|---|---|---|
| 93 ★ | **One-line install** | `npx gridbots@latest` with zero dependencies, or `docker compose up`. | M1 |
| 94 | **Self-host anywhere** | VPS, home server, Raspberry Pi 5, one-click templates; multiple users for family or team. | M2 |
| 95 | **Installable app on phone and desktop** | PWA with offline shell and push notifications. | M1 |
| 96 | **Desktop app** | Tray icon, global hotkey, native notifications, local computer use. | Later |
| 97 | **Plugin SDK** | Add providers, tools, channels, accessory packs and themes. | Later |
| 98 | **API and CLI** | REST + WebSocket API, webhooks, and `grid ask maya "…"` from the terminal. | M4 |
| 99 | **For everyone** | Themes, Hindi and other languages, full keyboard control, screen-reader support, reduced motion. | M2 |
| 100 ★ | **Try it without keys** | Demo mode on the docs site and a local-model quick start, so anyone can play in a minute. | M5 |

---

### What goes on the README's first screen
The eight ★ features that sell Grid in one scroll:
1. Bot Studio + living avatar (#1, #3)
2. Use your ChatGPT plan, or run local (#15, #16)
3. A computer per bot you can watch (#37, #38)
4. Talk from Telegram / WhatsApp (#54)
5. Goals and Night Shift (#67, #73)
6. Speaks SKILL.md (#57)
7. Stop everything + ask-first rules (#84, #77)
8. One-line install (#93)
