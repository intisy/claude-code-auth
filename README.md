# claude-code-auth

[![npm version](https://img.shields.io/npm/v/claude-code-auth)](https://www.npmjs.com/package/claude-code-auth)
[![npm downloads](https://img.shields.io/npm/dm/claude-code-auth)](https://www.npmjs.com/package/claude-code-auth)
[![CI](https://github.com/intisy-ai/claude-code-auth/actions/workflows/publish.yml/badge.svg)](https://github.com/intisy-ai/claude-code-auth/actions/workflows/publish.yml)

A [core-auth](https://github.com/intisy-ai/core-auth) provider that signs in to Claude with the real Claude Code OAuth flow and lets you add **multiple Claude subscription accounts**. Both Claude Code (via the loader proxy) and OpenCode route requests through it, rotating accounts and respecting each one's subscription rate limits — so OpenCode uses your Claude Code subscription instead of a pay-per-token API key.

## Under-the-Hood Architecture

```mermaid
flowchart TD
    subgraph Driver [claude-code driver — thin layer on core-auth]
        HANDLE["handle(request) — Anthropic request rewrite"]
        LOGIN["loginFlow() — PKCE OAuth"]
    end
    subgraph Core [core-auth]
        MGR[AccountManager: select / refresh / rotate]
        STORE[(accounts.json)]
        MGR <--> STORE
    end
    CC[Claude Code loader proxy] -->|dist/handler.js handle| HANDLE
    OC[OpenCode loader] -->|loader.fetch| HANDLE
    HANDLE -->|acquire account + token| MGR
    HANDLE -->|"Bearer + anthropic-beta: oauth + Claude Code system block"| API[(api.anthropic.com)]
    API -->|429 / 529| MGR
    LOGIN -->|platform.claude.com OAuth| STORE
```

## Structure

- `src/` — TypeScript source (`driver/` driver + OAuth config/login, `oauth/` PKCE flow, `plugin/request.ts` Anthropic rewrite, `commands.ts` slash-commands, `handler.ts`/`index.ts`/`cli.ts` entries)
- `core-auth/` — the shared auth engine (git submodule)
- `core/` — shared [`intisy-ai/core`](https://github.com/intisy-ai/core) submodule (config + logging + command framework), bundled in
- `dist/` — Compiled bundles: `index.js` (OpenCode), `handler.js` (Claude loader), `cli.js` (CLI)

## Installation

### Via plugin-updater (recommended)
Add to `~/.config/opencode/config/plugins.json`:
```json
[{ "name": "claude-code-auth", "url": "https://github.com/intisy-ai/claude-code-auth", "enabled": true }]
```

### Via npm
```bash
npm install claude-code-auth
```

Add Claude accounts (shared by both apps):
```bash
npx claude-code-auth login    # repeat to add more accounts
npx claude-code-auth list
```

## Configuration

> Config files are **auto-created with defaults on first run** (via core `ensureConfig`). **Global console logging** for every plugin is toggled in `config/settings.json` (`logConsole: true`, the opencode.json-equivalent).

Accounts are stored by core-auth at `~/.config/opencode/accounts.json` (and `~/.claude/...` for Claude Code). The OAuth client is the public Claude Code installed-app client; override the client id with `CLAUDE_CODE_CLIENT_ID` if needed.

- **OpenCode**: registers a custom `claude-code` provider (SDK `@ai-sdk/anthropic`); run `opencode run -m claude-code/claude-sonnet-4-6`.
- **Claude Code**: select `claude-code` in the loader's Providers tab; the proxy routes Claude requests through your subscription accounts.

Plugin config (`claude-code-auth.json`) is editable from chat via `/claude-code-auth-config`.

## Commands

Deployed automatically to both apps on load (`~/.config/opencode/command/` and `~/.claude/commands/`):

| Command | Description |
| --- | --- |
| `/claude-code-auth-config` | View/change any config key: `list`, `get <key>`, `set <key> <value>`. 100% of the config is reachable here. |
| `/claude-accounts` | List signed-in Claude subscription accounts and their enabled state. |

## Dependencies

- **`core`** (required) — bundled git submodule (config + logging + commands); no separate install.
- **`core-auth`** (required) — bundled git submodule (account store + OAuth/rotation engine).
- **`sync-bridge`** (optional) — mirrors the account store to the other app when present.

## Logging

core-auth writes provider logs under the app config dir (`~/.config/opencode/logs/...` or `~/.claude/logs/...`).

## License

MIT
