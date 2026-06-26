// @ts-nocheck
// Cross-app slash-commands for claude-code-auth. Config name matches the package
// (claude-code-auth.json). The account command is namespaced (/claude-accounts)
// so it never collides with the other providers' account commands.
import { configCommand, runConfigCli } from "../core/src/index.js";
import { listAccounts } from "../core-auth/dist/index.js";

const PROVIDER_ID = "claude-code";

export const CLAUDE_COMMANDS = [
  configCommand("claude-code-auth"),
  {
    name: "claude-accounts",
    description: "List signed-in Claude subscription accounts",
    shell: 'node "{{BUNDLE}}" accounts',
    body: "Above are the Claude subscription accounts and their enabled state. Report them; if none, tell the user to add one (oc auth login → Claude, or the loader login flow).",
  },
];

function runAccounts() {
  let accounts = [];
  try {
    accounts = listAccounts(PROVIDER_ID) || [];
  } catch (e) {
    console.log(`Could not read accounts: ${e?.message || e}`);
    return;
  }
  if (!accounts.length) {
    console.log("No Claude accounts. Add one via the account menu / login flow.");
    return;
  }
  for (const a of accounts) {
    const state = a.enabled === false ? " (disabled)" : "";
    console.log(`- ${a.email || a.id}${state}`);
  }
}

export async function maybeRunCli(configName) {
  const argv = process.argv.slice(2);
  if (argv[0] === "config") {
    runConfigCli(configName, argv.slice(1));
    return true;
  }
  if (argv[0] === "accounts") {
    runAccounts();
    return true;
  }
  return false;
}
