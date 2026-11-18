# Research: what Grid is up against

Checked 2026-11-18. Facts marked *(unconfirmed)* came from one secondary source or sources that disagree.

---

## 1. The three products you named

### xAI Grok Bot (your screenshots 1, 2, 3)

- **Launched** 11 Aug 2026, first for the ~$200/mo tier; from 26 Aug on every SuperGrok plan (~$30/mo) and paid Cursor plans. Apps for macOS, Windows, iPhone (Android and Linux reports conflict).
- **Bots:** name, title, description (the description is the system prompt), avatar picked as **shape + colour**. Your screenshot 3 shows 10 colours and 8 shapes (circle, blob, rounded square, pill, triangle, hexagon, cloud, drop), all flat with two little eye dashes.
- **Layout (screenshots 1–2):** iMessage-style. Left: bot list with last message + time + unread dot, *Plugins* and profile at the bottom. Middle: chat, black user bubbles, grey bot bubbles, file cards (PDF, size, download). Right: **"Chief of Staff's screen"** (live thumbnail of the bot's computer) and **Routines** (Morning briefing daily 8:00, Inbox cleanup weekdays 18:00, Weekly update *Paused*). Mobile: favourite bots as a big-avatar row on top, list below.
- **Chief of Staff pattern:** one coordinator bot, specialists under it. Bots message each other by default (no off switch).
- **Group chats:** 2–6 bots, `@` to hand a bot a job.
- **Routines:** scheduled or event-triggered (new email, Slack message, Git event, interval). "Test" runs one now (real work). Approval cards from routines expire after 30 min. A skill is the *how*, a routine is the *when*.
- **Plugins** = connectors + MCP + skills in one place (Gmail, Calendar, Drive, Sheets, Slack, Notion, X, GitHub, HubSpot…).
- **Computer:** one cloud computer *per user*, each bot gets its own screen on it. Cookies, files and logins are **shared across all bots**, so bots are not a security boundary.
- **Safety:** "Auto Review" model check + "Ask first" rules; cards say *Allow once / Always allow / Deny*. Vault, 1Password, Secure Form fill logins without the bot seeing them; **Take over → I'm done**.
- **Teach a Task:** record yourself doing it once; it becomes a skill.
- **Library → Pages:** reports and dashboards the bots build.
- **Weak spots:** every message (bot-to-bot included) burns your usage allowance; shared computer; Grok models only; mostly closed-tier pricing.

### OpenAI dots (your screenshots 4–8)

- **Launched** 29 Sep 2026 at DevDay, running on GPT-6 Astra. Only ChatGPT Pro ($100–$500/mo), Business Premium and some Enterprise. Pro not offered in the EEA/UK/Switzerland.
- **Characters:** every dot has a name and a cartoon body. You choose **shape, colour, eyes, glasses, accessories**. Handle starts as `@yourname-dot`. In the screenshots they are fuzzy 3D plush mascots (Iggy with headphones, Todd the frog with a bow tie, Felipe in a beret, Jojo the heart with sunglasses, Alfred with round glasses).
- **Chat UI seen in screenshots:** left icon rail (home, library, history, mentions, apps). The avatar **floats at the top of the chat with its name and a live status line** ("Thinking…", "Clarifying the experiment goal"). User bubbles take the dot's colour. Emoji reactions on messages from both sides. "Read 5:49 PM" receipts. Bot messages carry inline links ("Review the fix", "Updated study · View plot", "Draft post · Show notes"). A quoted standing instruction ("↳ Read the brief in #aster-launch and keep an eye on updates…"). Header buttons: computer, **phone call**, side panel.
- **Split view:** right half is the **dot's own browser with tabs**: a local app on `127.0.0.1`, a Gmail draft with a chart, Google Slides with two variants. You watch the work happen.
- **Computer:** own cloud computer + browser, keeps working when your laptop is off. **Take over** to do a step, hand back. Local Mac/PC access optional, off by default.
- **Permission rules per action:** act without asking / act only when asked / ask first / hand to you. An automatic reviewer decides proceed / ask / hand off. Passwords go through a private form the model never sees.
- **Memory** separate from normal ChatGPT memory. Corrections are learned. Deleting the dot wipes memory, chats and schedules.
- **Always-on:** reads connected apps proactively, runs parallel background agents, recurring checks. "Pause" stops the main task, but scheduled and delegated work keeps going until stopped under *Activity* / *Scheduled*.
- **Channels:** ChatGPT desktop, web, mobile, Slack, Teams (alpha), voice call. Texting is a small US beta.
- **Specialist dots** with their own identity, credentials and tools; dots in group chats; 4,000+ apps.
- **Weak spots:** price; GPT only; region locks; created on desktop only; launched the day after OpenAI apologised for one of its agents breaching an Australian government site, and with GPT-6.1 Astra held back for staying out of scope.

### Meta Muse (your screen recording + the YouTube link)

- **Your recording** is Muse's sign-in page: dark background, Meta wordmark, blue scribble "m" logo, headline **"Muse [tiny 3D face], AI that ___"** with a rotating ending and emoji (manages calendars 📅, builds fitness plans 👟, gets it done for you, sorts your email ✉️, shops for you 🛒, saves you money 🐷), one "mobile number or email" field, "Continue", "Learn more ↓". The whole pitch is one sentence and one face.
- **The YouTube link** is Meta's official "Take the full tour of Muse" (channel @muse). YouTube would not return the description or transcript, so Muse details below come from reviews.
- **Launched** 8 Sep 2026, US only: iOS, Android, web, **WhatsApp**. Model: Muse Spark 1.3 (multimodal). #1 free app on the App Store ten days in; ~2.5M downloads.
- **Goals:** long-running objectives (watch flight prices, find a cheaper phone plan, organise a move). Keeps working after you close the app; comes back when something changes or needs you. Proactive messages.
- **Subagents** for parallel work, recurring jobs.
- **Muse Secure VM:** a Linux VM per user with browser, files, tools. You can watch the browser **and inspect the harness files** (AGENTS.md, scripts, cron folder).
- **Connectors:** Gmail, Google Calendar, OpenTable, Facebook, Instagram, Peloton, Plaid. **Writes its own integration** for any service with an API or CLI.
- **Purchases:** one-time virtual cards via Link by Stripe; Shop Pay announced. Amazon reportedly blocks it.
- **Safety:** "Sentinel", a separate guard agent, rules each action allowed / blocked / needs approval. Permissions split by action (read mail but can't send). Audit log. Vault Muse can't read. Memory you can inspect and edit.
- **Price:** free, $20, $100. No ads.
- **Weak spots:** trust in Meta (Meta can access the VM at launch; a user-keyed VM is promised later), Facebook-login dependence, US only, prompt injection unsolved.

---

## 2. Also in the race

| Product | What matters for Grid |
|---|---|
| **Anthropic Claude Duet** (21 Oct 2026, waitlist, US Pro/Max/Ultra) | Proactive agent in its own app. Morning brief, checks your apps every few hours and messages only when needed, own VM + browser (not viewable yet), shows exactly what it will send/pay/sign/delete and waits. 6,000+ connectors. **No avatars or named characters.** |
| **Suparagent** (ex "open-duet", Apache-2.0, **7.1k stars**) | The closest open-source rival: named agents, Chief of Staff, routines, approval modes, Composio via your key, MCP marketplace, phone app. Python FastAPI backend that **wraps CLIs** (Claude Code, Codex, Gemini). README has **no screenshots**; self-host "experimental"; Composio "tested against a fake service"; no iOS, no push; no automated backend tests. Proof that a feature list alone does not get stars. |
| **OpenClaw** (~393k stars, Oct 2026) | Local-first assistant you talk to from chat apps; the fastest repo ever to 100k. |
| **Hermes Agent** (Nous Research, ~256k) | Self-improving local agent; ~199k stars in 16 weeks. |
| **OpenCode** (~220k), **Browser Use** (~119k) | Coding agent; browser automation. Both show the appetite. |

What the star leaders share: **one-command install, runs on your machine, any model, lives in apps people already use (Telegram/WhatsApp), a personality file, and a skills ecosystem.** None of them has a beautiful product UI. That is the gap.

---

## 3. Side by side

| | Grok Bot | dots | Muse | Claude Duet | **Grid (plan)** |
|---|---|---|---|---|---|
| Price | $30–$200/mo | $100–$500/mo | Free / $20 / $100 | In Pro+ | **Free, open source** |
| Models | Grok | GPT | Muse Spark | Claude | **Any: 15+ providers, local, ChatGPT plan** |
| Where | Most countries | Not EU/UK (Pro) | US | US | **Anywhere, self-hosted** |
| Characters | Flat shape + colour | Plush, rich custom | One face | None | **Procedural, flat + plush, community accessories** |
| Own computer | Shared across bots | Per dot | Per user VM | Per user VM | **Per bot, isolated, watchable** |
| Watch it work | Thumbnail | Split-view browser | Yes | Not yet | **Live view + replay** |
| Routines / goals | Routines | Scheduled checks | Goals | Brief + checks | **Routines + goals + triggers** |
| Apps | Plugins | 4,000+ | Handful | 6,000+ | **Composio 1,000+ + any MCP + native** |
| Chat apps | — | Slack, Teams | WhatsApp | — | **Telegram, WhatsApp, Slack, Discord** |
| Your data | xAI | OpenAI | Meta | Anthropic | **Your machine** |

---

## 4. Rules that shape the plan

### Using a ChatGPT subscription: allowed
OpenAI's "Sign in with ChatGPT" plan usage is documented **for open-source and locally hosted apps** (OpenClaw, OpenCode, Pi, T3 are listed examples). Paid or remotely hosted apps must fill in OpenAI's interest form first.
- Flow: app keeps a stable `ext_agent_host_id`, opens the browser with state + nonce + PKCE to a loopback callback, OpenAI issues the `client_id` (no client secret), app swaps the code for tokens.
- Inference: bearer token on the public **Responses API** with `store: false`, `stream: true`; the model list comes from the signed-in account.
- Eligible plans: Go, Plus, Pro, Business (per OpenAI's page; some blogs say Plus/Pro only).
- Usage counts toward the plan's existing limits; users can set a weekly cap per app; when the cap is hit, requests fail, no fallback billing.
- Preview gaps *(unconfirmed)*: no image generation, hosted file search, code interpreter or hosted computer use through it. So Grid must bring its own browser/computer tools, which it does anyway.

### Using a Claude subscription: not allowed
Anthropic's legal page says third-party developers may not offer Claude.ai login in their apps or route requests through Free/Pro/Max plans, and may not collect or relay Claude.ai credentials or session tokens. Developers building products must use **API keys**. The only opening: nothing stops a user from signing in to the **unmodified Claude Code CLI** themselves, but Anthropic staff have called third-party harnesses around it prohibited. Grid therefore supports Claude through **API key, Amazon Bedrock, Google Vertex, Microsoft Foundry or OpenRouter**. Current models: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-2`.

### Google / GitHub subscriptions
No official Gemini-plan login for third-party apps found. GitHub Copilot plan use outside GitHub's own products is limited. Treat both as API-key only.

### Composio
- MIT SDK (`@composio/core`, ~31k stars), 1,000–1,700 toolkits. Provider adapter for the Vercel AI SDK: `@composio/vercel`.
- Per-user accounts keyed by a stable `user_id`; users connect through a hosted Connect Link (can be branded). Composio-managed OAuth by default, so self-hosters do **not** need their own Google/Slack OAuth apps (and skip Google's restricted-scope security review).
- Triggers/webhooks exist (e.g. new Gmail email).
- Hosted MCP via sessions (`session.mcp.url`).
- **Free tier: 10,000 tool calls/month** on the pricing page (homepage says 100,000; confirm). Standard $18/seat. Extra calls $0.005.
- **The platform can't be self-hosted** (enterprise only). **Every self-hoster needs their own Composio key.**
- Implication: Composio is one connector provider behind an interface, next to MCP and native connectors, so Grid still works with zero SaaS accounts.

### Agent Skills (`SKILL.md`)
Open standard (agentskills.io, now under the Linux Foundation's Agentic AI Foundation). Used by Claude Code, Codex, Cursor, VS Code, Copilot and 30–40+ tools. Vercel's skills.sh lists ~90k skills. Security studies found a quarter to a third of published skills contain exploitable patterns, so **install-time scanning and runtime permissions are required, not optional**.

### Current stack versions
Next.js 16.4.x (Nov 2026 security release: 16.4.5+). Vercel AI SDK 7 (durable agents, harness abstraction, MCP Apps, tool search).

---

## 5. Patterns worth taking

1. **Shape + colour creator** that takes 10 seconds (Grok) **plus** eyes and accessories (dots).
2. **Avatar as live status**: floating on top of the chat with a status line (dots).
3. **Bubbles in the bot's colour** so you always know who you're talking to (dots).
4. **Watch it work**: live screen thumbnail in the side panel (Grok) and full split-view browser (dots).
5. **Take over / hand back** (dots, Grok).
6. **Four-way action rules**: auto / only when asked / ask first / hand to me (dots), shown as approval cards with *Allow once / Always / Deny* (Grok).
7. **Guard model** reviewing risky steps (Muse Sentinel, dots auto review, Grok Auto Review).
8. **Goals**, not just chats (Muse); **morning brief + "only ping me when it matters"** (Duet).
9. **Chief of Staff** and specialists; group chats with `@` (Grok).
10. **Teach by showing** → skill (Grok).
11. **Inspectable harness**: the user can open the bot's files and see its rules (Muse).
12. **Writes its own integration** when no connector exists (Muse).
13. **Pages** in a Library (Grok).
14. **One-sentence landing** with a living face and a rotating verb (Muse).

## 6. Openings nobody fills

- **Open source with a product-grade UI.** Every open project in this space looks like a dev tool.
- **Any model, including the ChatGPT plan you already pay for, and fully local models.**
- **Isolated computer per bot** (Grok shares one).
- **Works outside the US**, including India, the EU and UK.
- **Your data on your machine**, with a transparent memory you can edit as files.
- **Characters as a community thing**: shareable bot cards, accessory packs, a bot gallery.

---

## Sources

- Grok Bot: [aibuilderclub guide](https://www.aibuilderclub.com/blog/grok-bot-guide) · [Coursiv](https://coursiv.io/blog/grok-bot) · [The AI Impact](https://www.theaiimpact.co/guides/grok-bot-beginners-guide) · [grok-bot-cos repo](https://github.com/twhit223/grok-bot-cos) · [Wright Mode](https://wrightmode.substack.com/p/7-levels-of-grok-bot-from-your-first)
- dots: [TechCrunch](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/) · [NBC News](https://www.nbcnews.com/tech/tech-news/openai-launches-dots-ai-agents-safety-questions-rcna600338) · [Fello AI](https://felloai.com/openai-dots/) · [Fast Company](https://www.fastcompany.com/91615068/openai-dots-agent-crew-of-friendly-mascots) (blocked, not read)
- Muse: [KDnuggets](https://www.kdnuggets.com/meta-muse-explained-what-it-is-how-it-works-and-what-it-can-do) · [eesel review](https://www.eesel.ai/blog/meta-muse-agent-review) · [CNN](https://www.cnn.com/2026/09/23/tech/meta-muse-ai-agent) (blocked, not read) · [YouTube tour](https://youtu.be/wHn0hTjvFoo)
- Claude Duet: [announcement](https://claude.com/resources/articles/claude-duet) · [product page](https://claude.com/product/claude-duet)
- Open source: [Suparagent / open-duet](https://github.com/Anil-matcha/open-duet) · [coworkos star data](https://coworkosapp.com/research/open-source-ai-agents-2026/) · [Context Studios](https://www.contextstudios.ai/blog/openclaw-vs-hermes-agent-an-honest-2026-comparison) · [effoma](https://effoma.com/blog/open-source-ai-agents-openclaw-zeroclaw-picoclaw/)
- Subscriptions: [OpenAI plan usage for open-source apps](https://developers.openai.com/siwc/token-sharing-open-source) · [OpenAI Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt) · [xenospectrum](https://xenospectrum.com/en/chatgpt-sign-in-subscription-apps/) · [Anthropic legal & compliance](https://code.claude.com/docs/en/legal-and-compliance) · [The Register](https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546)
- Composio: [pricing](https://composio.dev/pricing) · [docs](https://docs.composio.dev) · [GitHub](https://github.com/ComposioHQ/composio)
- Skills: [noqta on SKILL.md adoption](https://www.noqta.tn/en/news/skill-md-open-standard-30-ai-coding-tools-adoption-2026) · [agentskills.io](https://agentskills.io)
- Stack: [Next.js blog](https://nextjs.org/blog) · [AI SDK 7 changelog](https://vercel.com/changelog/ai-sdk-7)
