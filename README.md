# Grid

**Your AI team, open source.** Make a bot with a face, a name and a job in ten seconds. It interviews you, writes its own soul, remembers what matters, and runs on any model: your ChatGPT plan, an API key, or a model on your own machine.

> Status: milestone 1 ("First bot") plus the first five of the [next 50 features](docs/superpowers/specs/2026-11-19-next-50-features-design.md). Bots chat, interview you, keep visible memory, run on 12 kinds of model provider, and set reminders from plain words ("remind me Friday 6pm to pay rent", "every 1st of the month") that go off right in the chat, with Done, Snooze and a notification. Bots also take on routines ("every weekday at 8, give me a briefing"): standing jobs they do on their own and post into the chat, with Run now, pause and a history. Everything a bot sends lands in one inbox, and only what matters pings you: per-bot mute, quiet hours, "ping me for" levels, routine results the bot rates itself, and Web Push when Grid is closed. Bots research the web too: they search (with Brave, Tavily or your own SearXNG, or the model's own search on ChatGPT, OpenAI and Claude), read pages safely, show their work, and answer with numbered citations and source chips. And bots keep your lists instead of answering in prose: checklists (groceries, packing, to-dos), habits with streaks, and expenses that add up, made from plain words ("I spent 250 on lunch"), shown as live cards in the chat and in a Lists tab where you tick, reorder, share and delete. Search across everything, a command palette, apps and the bot's own computer come next; see [PLAN.md](PLAN.md).

## Run it

Grid needs **Node 22+**.

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3210 and connect a model:

- **Continue with ChatGPT**: uses your ChatGPT Go, Plus, Pro or Business plan allowance (OpenAI's official sign-in for open-source apps).
- **Use a local model**: Ollama or LM Studio, detected automatically.
- **Paste an API key**: OpenAI, Anthropic (Claude), Google Gemini, xAI, Groq, Mistral, DeepSeek, OpenRouter, or any OpenAI-compatible server.

Claude subscriptions can't be used in third-party apps; use an Anthropic API key instead.

### One command (coming to npm)

Once published, this will be all you need:

```bash
npx gridbots@latest
```

To try the packaged version locally today:

```bash
pnpm bundle:cli
node packages/cli/bin/gridbots.mjs
```

Options: `--port <n>`, `--home <dir>` (default `~/.grid`), `--no-open`.

## Where your data lives

Everything stays on your computer under `~/.grid` (or `GRID_HOME`):

- `db/`: the database (embedded Postgres)
- `bots/<handle>/SOUL.md` and `MEMORY.md`: readable copies of each bot's soul and notes
- `USER.md`: what your bots know about you
- `files/`: attachments
- `master.key`: encrypts your API keys and sign-in tokens

Grid only listens on `127.0.0.1` and rejects requests from other websites.

## Develop

```bash
pnpm typecheck
pnpm test        # unit tests (Vitest)
pnpm e2e         # browser tests (Playwright, uses a built-in test model)
pnpm test:cli    # packs the CLI and starts it (run pnpm bundle:cli first)
```

Docs: [PLAN.md](PLAN.md) · [docs/FEATURES.md](docs/FEATURES.md) · [docs/UI.md](docs/UI.md) · [docs/RESEARCH.md](docs/RESEARCH.md)

## License

MIT
