// @ts-nocheck
// OpenCode entry. Export ONLY the provider plugin: OpenCode runs every export as
// a hook, so any extra export would register as a bogus plugin.
// Slash-command / config invocations shell back in as `node <bundle> <action>`;
// handle those first and exit so they never register the provider.
import { deployCommands, defineConfig } from "../core/src/index.js";
import { CLAUDE_COMMANDS, maybeRunCli } from "./commands.js";

// Register config defaults BEFORE the CLI guard so `config schema` sees them (no write).
defineConfig("claude-code-auth", { logging: true });

if (await maybeRunCli("claude-code-auth")) {
  process.exit(0);
}
try {
  deployCommands("claude-code-auth", CLAUDE_COMMANDS);
} catch {
  /* best-effort */
}

export { ClaudeCodeProvider } from "./driver/index.js";
