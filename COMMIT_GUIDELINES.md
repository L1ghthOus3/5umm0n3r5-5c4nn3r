# Commit Guidelines

These rules apply to **everyone** working on this project — humans and AI agents
alike. Keep history clean, readable, and safe.

## Format — Conventional Commits

Every commit message follows:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Only the first line (`<type>(<scope>): <subject>`) is required.

### Subject line

- Use the imperative mood: "add", "fix", "remove" — not "added" or "adds".
- No capital letter after the colon, no trailing period.
- Keep it under ~72 characters.
- Describe *what* the change does, not *how*.

### Types

| Type       | Use for                                                        |
|------------|---------------------------------------------------------------|
| `feat`     | A new feature or user-facing capability                       |
| `fix`      | A bug fix                                                     |
| `chore`    | Tooling, config, ignores, housekeeping (no app behavior)     |
| `refactor` | Code change that neither fixes a bug nor adds a feature      |
| `style`    | Formatting, whitespace, CSS-only tweaks (no logic change)    |
| `docs`     | Documentation only                                           |
| `perf`     | A change that improves performance                           |
| `test`     | Adding or fixing tests                                       |

### Scopes

Use the area of the codebase the change touches. Common scopes here:

- `config` — `js/config.js`, runtime config, regional routing
- `api` — `js/riotApi.js`, Riot API calls
- `data` — `champion.json`, `queues.json` and their loaders
- `login` — `js/login.js`, the summoner login console
- `stats` — `js/statsView.js`, profile dashboard and match views
- `ui` — `index.html`, `js/main.js`, `js/starfield.js`, styling and shell

Scope is optional but encouraged. Omit it for repo-wide changes.

### Body (optional)

- Separate from the subject with one blank line.
- Explain the *why* and any context a reviewer needs.
- Wrap at ~72 characters.

## One logical change per commit

Split work into commits that each stand on their own:

- Group related files (e.g. a JSON data file with the loader that reads it).
- Don't mix unrelated changes — a bug fix and a new feature are two commits.
- Each commit should leave the app in a working state.

## Never commit secrets

- The Riot API key lives in `.env`, which is **gitignored** — never force-add it.
- Don't hardcode keys, tokens, or credentials in source. `js/config.js` loads
  `RIOT_API_KEY` from `.env` at runtime; keep it that way.
- If a secret is ever committed by mistake, rotate it immediately and scrub it
  from history.

## Attribution for AI agents

Commits authored with AI assistance must end the message with a trailer:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Examples

```
feat(stats): add profile dashboard and match detail scoreboard
```

```
fix(api): handle 429 rate-limit responses with a retry

Riot returns 429 with a Retry-After header when the dev key is throttled.
Respect that header instead of failing the whole match-history load.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

```
chore: ignore .env containing the Riot API key
```
