# Grid: the plan

> **Grid is the open-source home for your AI team.** Make a bot with a face, a name and a job in ten seconds. It gets its own computer, connects to your apps, works while you sleep, and runs on any model, including the ChatGPT plan you already pay for or a model on your own machine.

Working name: **Grid** (from the folder). Companion docs:
- [docs/RESEARCH.md](docs/RESEARCH.md): Grok Bot, dots, Muse, Claude Duet and the open-source field, with sources
- [docs/FEATURES.md](docs/FEATURES.md): the 100 features
- [docs/UI.md](docs/UI.md): design language, motion system and the first 50 UI features

Nothing is built yet. This is the design to approve before any code.

---

## 1. Why this can win

Three giants shipped the same idea in eight weeks (Grok Bot, Aug; Muse, Sep; dots, Sep). Each one is locked to its own model, costs $20–$500 a month, works in a few countries, and keeps your email, calendar and logins on their servers. The open-source projects that copy the idea look like developer tools.

Grid's bet: **the open-source version can be the best-looking and best-feeling one.** Stars in this category went to projects that are easy to install, run on your machine, take any model and have personality (OpenClaw ~393k, Hermes ~256k). None of them has a product-grade interface. Grid combines both.

**The pitch in one breath:** *dots-quality characters, Grok-style bot team, Muse-style goals, free, any model, your machine.*

## 2. Who it's for

1. **Builders and power users** who already pay for ChatGPT or run local models and want agents that do real work (inbox, research, outreach, monitoring, coding chores). They star, self-host, write skills.
2. **Small teams and families** on one self-hosted server: a shared Chief of Staff, an inbox bot per person.
3. **People priced or geo-blocked out** of dots/Muse/Duet (India, EU, UK, students).

## 3. Product principles

1. **Ten seconds to a living bot.** Install in one command, first bot in one screen, first useful result in one message.
2. **Every bot is someone.** A face that reacts, a name, a voice, a soul you can read. Status is shown by the character, not by spinners.
3. **You can always see the work.** Live screen, step timeline, replay, cost. Nothing hidden.
4. **Nothing irreversible without you.** Sending, paying, deleting, publishing and logging in follow your rules; the default is "ask first".
5. **Your models, your data, your machine.** Any provider, local models, files you can open, export anything.
6. **Feels faster than it is.** Optimistic UI, streaming everywhere, motion that is quick, interruptible and purposeful (see [docs/UI.md](docs/UI.md)).

## 4. Core concepts

| Concept | What it is |
|---|---|
| **Bot** | A named character with a job. Has an avatar, a soul, a model setup, memory, apps, skills, a computer, rules and a budget. |
| **Soul** | `SOUL.md`: personality, tone, values, what it owns, what it never does without asking. Written by interviewing you; editable. |
| **Thread** | A chat with one bot, or a group chat with you + 2–6 bots. |
| **Task** | One unit of work a bot is doing (from a message, routine, goal or another bot). Has a timeline of steps. |
| **Computer** | The bot's own sandbox: browser, terminal, files. Watchable live, replayable, takeover-able. |
| **Routine** | When a bot runs a job: a schedule ("weekdays 8am") or a trigger ("new email from a client"). |
| **Goal** | A long-running objective with progress ("get flights to Goa under ₹9k before Dec 10"). |
| **Skill** | A `SKILL.md` folder: the *how* of a job. Same format as Claude Code / Codex / Cursor skills. |
| **Connection** | An app account the bot may use (via Composio, an MCP server or a native connector), with read/write scopes. |
| **Rule** | What a bot may do for a kind of action: *auto · ask first · only when I ask · never · hand to me*. |
| **Page** | Something a bot made: report, dashboard, draft, slide, file. Lives in the Library. |

## 5. Approaches considered

### 5.1 Overall architecture
| Option | Trade-off | Verdict |
|---|---|---|
| **A. Next.js only** (agents run in route handlers) | Simplest, but 24/7 bots, schedules and live browsers don't fit request/response lifetimes or serverless. | No |
| **B. Next.js UI + a long-running "runner" service, both TypeScript, one monorepo** | One language end to end, UI stays fast, runner owns schedules, sandboxes, channels. Two processes (merged into one in local mode). | **Pick** |
| **C. Wrap coding CLIs** (Claude Code, Codex) as the engine, like Suparagent | Gets strong agents for free, but ties Grid to CLI auth rules (Claude's subscription use is not allowed), CLI install pain, coding-shaped behaviour. | Only as an optional "engine" plugin later |

### 5.2 Avatars
| Option | Trade-off | Verdict |
|---|---|---|
| **Procedural SVG** (parametric shapes, eyes, accessories as layers) | Millions of combinations, tiny, crisp at 24px, themable, animates with CSS/Motion, works on any phone. | **Pick for every size** |
| **Plush 3D** (React Three Fiber + shell-texture fur) | The "wow" of dots. Heavier; one on screen at a time. | **Add for big moments** (studio, profile, calls), lazy-loaded, falls back to SVG |
| Rive state machines | Beautiful, but every shape × accessory combination has to be authored. | No |

Characters must be **original designs**: our own shape language, eyes and accessories, not copies of dots' or Grok's mascots.

### 5.3 The bot's computer
| Option | Trade-off | Verdict |
|---|---|---|
| **Local Docker container per bot** (Chromium + terminal + files) | Free, private, isolated. Needs Docker. | **Default for self-host** |
| **Cloud sandbox with your own key** (E2B, Daytona, Modal…) | Works with no Docker, scales, costs money. | **Driver option** |
| **Host browser profile without a container** | Zero setup, weaker isolation. | **Fallback** for local mode without Docker, with a clear warning |
| **Your own computer** (desktop app) | Most powerful, most dangerous. | **Later, opt-in, per-app permission** |

One `ComputerDriver` interface hides all four.

---

## 6. Architecture

```
┌──────────────── Browser / PWA (desktop + phone) ────────────────┐
│ Next.js 16 app · React 19 · Tailwind v4 · Motion · Base UI       │
│ chat · studio · live screen (WebSocket frames) · push            │
└──────────┬───────────────────────────────────────▲──────────────┘
           │ HTTP / server actions                 │ SSE + WebSocket events
┌──────────▼───────────────────────────────────────┴──────────────┐
│ apps/web (Next.js server)   auth · API · streaming chat          │
└──────────┬──────────────────────────────────────────────────────┘
           │ jobs + events (Postgres)
┌──────────▼──────────────────────────────────────────────────────┐
│ apps/runner (Node 22, always on)                                 │
│  agent runtime (AI SDK 7) · scheduler · triggers/webhooks        │
│  computer drivers · channel bridges · guard model · cost meter   │
└──┬────────────┬──────────────┬───────────────┬──────────────────┘
   │            │              │               │
 Models      Connectors     Computers        Channels
 15+ APIs    Composio       Docker/E2B/      Telegram, WhatsApp
 ChatGPT     MCP servers    host/desktop     (Cloud API), Slack,
 plan,       native IMAP,   (Playwright +    Discord, email
 Ollama…     CalDAV, RSS    CDP screencast)
                   │
             Postgres + pgvector (server)  ·  PGlite (local, zero install)
```

### Monorepo (pnpm + Turborepo, TypeScript everywhere)
| Package | Job |
|---|---|
| `apps/web` | Next.js 16 App Router UI and API. Responsive: one codebase for desktop and phone, installable PWA. |
| `apps/runner` | Always-on worker: agent loops, routines, goals, triggers, sandboxes, channels. |
| `apps/desktop` (later) | Tauri 2 shell: tray, global hotkey, notifications, opt-in local computer use. |
| `packages/core` | Agent runtime on Vercel AI SDK 7: tool loop, approvals, sub-agents, context and memory. |
| `packages/models` | Provider registry, ChatGPT plan sign-in, routing, fallbacks, price table. |
| `packages/connectors` | Composio adapter, MCP client, native connectors, trigger intake. |
| `packages/computer` | `ComputerDriver` + Docker/E2B/host drivers, Playwright/Stagehand, CDP screencast and input. |
| `packages/skills` | `SKILL.md` loader, GitHub importer, scanner, permission manifest. |
| `packages/critter` | Avatar system: SVG renderer, pose engine, plush 3D renderer, accessory packs. |
| `packages/ui` | Design system: tokens, components, motion presets. |
| `packages/db` | Drizzle schema + migrations for Postgres and PGlite. |
| `packages/sdk` | Public TypeScript client, CLI (`grid`), plugin API. |

### Stack calls
| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16.4.x, React 19 | Your request; RSC + streaming; View Transitions for route changes. |
| Styling | Tailwind v4 + CSS variables (OKLCH) | Per-bot colour tinting from one variable. |
| Primitives | Base UI (or Radix) | Accessible, origin-aware popovers. |
| Motion | Motion (motion.dev) for springs/gestures; CSS + WAAPI for loops; View Transitions API for pages | Smooth under load (see UI.md §3). |
| Mobile sheets/toasts | Vaul, Sonner | Best-in-class feel, tiny. |
| 3D | React Three Fiber, lazy | Plush avatars only where large. |
| AI | Vercel AI SDK 7 | Every major provider, tool approval, MCP, durable agents. |
| DB | Postgres + pgvector (server), PGlite (local) via Drizzle | Same schema; zero-install local mode. |
| Queue | Postgres-backed (pg-boss) in server mode; in-process in local mode | No Redis to run. |
| Auth | Better Auth | Open source, passkeys, multi-user for family/team servers. |
| Browser automation | Playwright + Stagehand-style DOM/vision actions | Robust actions; CDP gives live frames and takeover input. |
| Voice | LiveKit (self-hostable WebRTC) + pluggable speech-to-text / text-to-speech; realtime speech models where offered | Calls with the bot. |
| Push | Web Push (VAPID) | Works on Android and installed iOS PWAs (16.4+). |
| Testing | Vitest (units), Playwright (end-to-end, also drives a fake model and fake Composio), visual snapshots of every critter pose | Agents and motion both regress quietly; tests catch it. |

---

## 7. How a bot works

**A task's life:** message / routine / trigger / goal / another bot → runner creates a **task** → loads the bot's soul, relevant memories (vector + recency), its skills index and allowed tools → runs the **AI SDK agent loop** on the bot's "brain" model → each tool call passes the **rule check** (and the guard model for risky ones) → steps stream to the UI as a timeline → results land as chat messages, pages or drafts → memory update → cost recorded.

- **Models per bot:** *brain* (planning and talking), *hands* (cheap model for routine steps and sub-agents), *eyes* (vision model for screens). Fallback chain on errors or rate limits.
- **Context:** soul + charter first (cached), then memories, then the thread. Long threads summarised; old tool output trimmed.
- **Sub-agents:** a bot can split work into parallel sub-tasks on the hands model; results merge back. Chief of Staff can hand tasks to other bots (bot-to-bot messages are tasks, with a loop guard and a per-day cost cap).
- **Memory:** per-bot and shared ("About you"). Stored as rows with embeddings **and** mirrored to readable files (`USER.md`, `MEMORY.md`). Every memory shows where it came from and can be edited or deleted. Reactions and corrections become rules.
- **Goals:** a goal is a plan + check schedule + progress value. The runner wakes the bot on its schedule, the bot updates progress and pings you only on change ("noise budget").
- **Proactive mode:** a bot may message first only when a rule or goal says so, within quiet hours.

## 8. Models and accounts

- **API keys** for OpenAI, Anthropic, Google, xAI, Groq, Mistral, DeepSeek, Qwen, OpenRouter, Together, Fireworks, Azure OpenAI, Bedrock, Vertex, Foundry, and any OpenAI-compatible URL.
- **Local:** Ollama, LM Studio, llama.cpp, vLLM. Grid works fully offline with local models (minus cloud apps).
- **Sign in with ChatGPT:** uses the user's ChatGPT plan allowance through OpenAI's official flow for open-source / locally hosted apps (details in RESEARCH.md §4). Shows the plan's remaining allowance and lets the user set a cap. Local mode fits the flow directly (loopback callback on the same machine). For a self-hosted server reached over the internet, two things must be settled in M0: whether OpenAI counts it as "locally hosted", and how the loopback sign-in completes when the browser and server are on different machines (likely: sign in from the user's device, hand the token to the server).
- **Claude:** API key, Bedrock, Vertex, Foundry or OpenRouter. **Claude subscription login is not offered**, because Anthropic's terms forbid third-party apps from using it (RESEARCH.md §4). The docs say so plainly.
- **Price table** from a public model catalogue (e.g. models.dev), shipped with the app and refreshed, so every message shows its cost.
- **Keys** encrypted at rest with a per-install master key; never sent back to the browser after entry.

## 9. Apps, skills, channels

- **Composio** for 1,000+ apps with hosted OAuth (no Google verification work for self-hosters). Each install brings its own Composio key; setup wizard walks through it. Free tier limits are shown in the UI.
- **MCP:** any remote or local MCP server; a browser for public registries; MCP Apps render interactive UI in chat.
- **Native connectors** so Grid works with zero SaaS keys: IMAP/SMTP mail, CalDAV calendar, RSS, webhooks, generic REST.
- **Per-bot least privilege:** each bot only sees the connections you give it, with read/write split.
- **Skills:** `SKILL.md` from skills.sh, GitHub URLs, zips or folders. Every install is scanned (static checks + model review), shows what it touches, and runs with a declared permission manifest. Bots can write new skills; you approve them.
- **Channels:** Telegram (bot API), WhatsApp (**official Cloud API only**: unofficial libraries get numbers banned), Slack, Discord, email. Same bot, same memory everywhere.

## 10. Safety model

1. **Rules per action class** (read · write · send · publish · spend · delete · log in · change settings · run code), per bot, per app. Defaults: read = auto, everything outward = ask first, money and deletes = ask first + hold-to-confirm.
2. **Approval cards** show exactly what will happen, editable, *Allow once / Always / Deny*, expire after 30 minutes for routine runs.
3. **Guard model** reviews risky calls against your rules and checks whether the instruction came from untrusted content.
4. **Untrusted-content firewall:** emails, web pages, files and tool outputs are marked as data; bots don't take orders from them; links found in them are never auto-opened for logins or payments.
5. **Secrets the model never sees:** secure forms put passwords and cards into the vault; the runner fills them; the model sees placeholders.
6. **Isolation:** one sandbox and browser profile per bot; no shared cookies unless you link them.
7. **Budgets:** model spend per bot per day; purchase limits; hard stop at the cap.
8. **Stop everything:** one button (and a Telegram command) pauses all bots, routines and goals.
9. **Audit log:** append-only record of every action, approval and cost; exportable.
10. **Skills and plugins** run with declared permissions; anything undeclared is blocked.

## 11. Data model (first cut)

`users` · `bots` (name, handle, avatar json, soul md, model config, rules, budget) · `threads` + `thread_members` · `messages` (parts, reactions, reply_to) · `tasks` (source, status, parent, cost) · `task_events` (step timeline, screenshot refs) · `approvals` · `routines` · `goals` · `memories` (scope, text, embedding, source, pinned) · `skills` (source url, version, hash, manifest, trust) · `connections` (provider, toolkit, account ref, scopes, bot grants) · `computers` (driver, state) · `library_items` · `usage` (tokens, cost, model) · `secrets` (encrypted) · `channels` · `audit_log`.

## 12. Ways to run it

| Mode | How | For |
|---|---|---|
| **Local** | `npx gridbots@latest` → opens `localhost`; PGlite file DB; runner in-process; Docker sandboxes if Docker exists. (The npm name `grid` is taken; `gridbots` was free on 2026-11-18.) | Trying it, single user |
| **Self-host** | `docker compose up` (web, runner, Postgres); one-click templates for Railway/Fly/Coolify; works on a VPS or Raspberry Pi 5 | Always-on bots, family/team |
| **Desktop** (later) | Tauri app bundling local mode | Tray, hotkey, local computer use |
| **Hosted** (maybe, much later) | A managed cloud | Non-technical users. Needs OpenAI's interest form for plan usage, Composio billing, abuse controls. Not in scope now. |

---

## 13. Roadmap

Each milestone ends with something people can try. Order matters more than dates.

| Milestone | Ships | Done when |
|---|---|---|
| **M0 Spikes** | Throwaway tests: SVG critter feel (morph, blink, eyes); CDP live screen + takeover in the browser; ChatGPT plan sign-in end to end; Composio session through AI SDK 7; PGlite + Drizzle + pgvector. | Each risk is proven or replaced. |
| **M1 First bot** | Bot Studio, chat with any model (keys, local, ChatGPT plan), streaming, memory, soul interview, mobile PWA, `npx grid`. | A stranger installs it and has a bot with a face replying in under 2 minutes. |
| **M2 Bots that do things** | Composio + MCP + native connectors, skills import and scanner, rules + approval cards, task timeline, routines, cost meter. | "Every weekday 8am, triage my inbox and draft replies" works with approvals. |
| **M3 Bots with a computer** | Docker/E2B/host drivers, live screen, takeover, secure forms, recordings and replay, Library + Pages. | A bot books a table on a real site while you watch, asking you only for the login. |
| **M4 The team** | Group chats, Chief of Staff delegation, goals, morning brief, voice calls, Telegram/WhatsApp/Slack/Discord, push. | Your Chief of Staff runs three specialists overnight and briefs you at 8am on Telegram. |
| **M5 Launch** | Bot Hub (gallery), bot cards, templates, docs site with playground, demo mode, launch videos. | Public launch (section 14). |
| **After** | Desktop app, local computer use, plush 3D everywhere, plugin SDK, E2E-encrypted sync, hosted option. | |

---

## 14. The 100k-star plan

No feature list guarantees stars. Suparagent has a good list and 7.1k. OpenClaw and Hermes got there with **an easy install, a personality, chat-app reach, a skills ecosystem and shareable moments**. Grid adds the one thing they lack: it looks and feels better than the paid products.

1. **The hook GIF:** Studio → a bot is born → it opens its browser and does a real task → you approve with a hold. Ten seconds, top of the README.
2. **Install in one line**, demo mode without any keys.
3. **README comparison table** vs dots / Grok Bot / Muse: price, models, regions, data location.
4. **"Use your ChatGPT plan"** and **"runs on Ollama"** in the first screen of the README.
5. **Bot cards:** every bot exports a pretty card image + link that imports into anyone's Grid. People post their bots.
6. **Accessory packs and bot templates as community PRs.** The easiest first contribution in open source: draw a hat, get merged. Contributors star and share.
7. **Skills compatibility:** "works with the 90k skills you already have" draws the Claude Code / Codex crowd.
8. **Launch week:** Show HN, X thread with clips, r/selfhosted, r/LocalLLaMA, Product Hunt, Indian and global YouTube creators; ship visible updates weekly afterwards.
9. **Repo hygiene:** MIT licence, clean issues with `good first issue`, roadmap board, Discord, fast PR reviews, changelog videos.

---

## 15. Calls I made (overturn any)

1. Separate always-on **runner** next to Next.js, one TypeScript monorepo.
2. **Procedural SVG** avatars everywhere, **plush 3D** only for big moments.
3. **Local Docker** as the default bot computer, cloud sandboxes and host browser as options.
4. **PGlite** for zero-install local mode, Postgres for servers.
5. **Composio is one of three connector sources**, not a hard dependency.
6. **Claude by API key only**; no Claude subscription login.
7. **WhatsApp through the official Cloud API only.**
8. **Local + self-host first**; a hosted version is out of scope.
9. **MIT licence.**
10. **Original character designs**, not lookalikes of dots or Grok.

## 16. Still open (yours to decide)

1. **Claude subscription.** Grid can't offer Claude.ai login. The only grey path is an opt-in "engine" that drives the user's own unmodified Claude Code CLI on their own machine; Anthropic staff have called such harnesses prohibited. Recommendation: leave it out, ship Claude by API key.
2. **The name.** "Grid" is generic and taken on npm; `gridbots` is free. Check GitHub org, domain and trademark before launch.
3. **Hosted version** for non-technical users: later or never.

## 17. Risks

| Risk | Mitigation |
|---|---|
| Prompt injection through email and web pages | Firewall + guard model + ask-first defaults + no secrets in context. |
| Malicious skills | Scanner, permission manifests, trust levels, pinned versions. |
| ChatGPT plan rules change | It's one provider among many; keys and local models always work. |
| Composio free-tier limits or pricing changes | Native connectors and MCP as fallbacks; limits shown in the UI. |
| Sites blocking agent browsers | Prefer APIs and connectors; takeover for hard steps; never bypass CAPTCHAs. |
| Too much scope for one person | Milestones ship separately; M1 alone is a launchable product. |
| Motion that drops frames on cheap phones | Performance budget and device testing from M0 (UI.md §8). |
