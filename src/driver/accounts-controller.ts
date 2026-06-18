// @ts-nocheck
// Claude's AccountController: provider-owned status + Verify / Refresh actions on
// top of core-auth's generic list/enable/remove helper.

import { accountControllerFromManager } from "../../core-auth/dist/index.js";
import { ANTHROPIC_API_BASE, ANTHROPIC_OAUTH_BETA, ANTHROPIC_VERSION, CLAUDE_CODE_SYSTEM } from "../constants.js";
import { login } from "./login.js";

function out(message) {
  process.stdout.write(message + "\n");
}

function claudeStatus(account, now) {
  if (account.enabled === false) return "disabled";
  if (typeof account.coolingDownUntil === "number" && account.coolingDownUntil > now) return "cooling-down";
  const lanes = account.rateLimitResetTimes || {};
  if (Object.values(lanes).some((reset) => typeof reset === "number" && reset > now)) return "rate-limited";
  return "active";
}

async function verify(manager, view) {
  const name = view.email || view.id;
  try {
    const access = await manager.ensureAccess(view.id);
    if (!access) { out("✗ " + name + ": no access token"); return; }
    const aborter = new AbortController();
    const timer = setTimeout(() => aborter.abort(), 20000);
    let response;
    try {
      response = await fetch(ANTHROPIC_API_BASE + "/v1/messages", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + access,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-beta": ANTHROPIC_OAUTH_BETA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          system: [{ type: "text", text: CLAUDE_CODE_SYSTEM }],
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: aborter.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 200 || response.status === 400 || response.status === 429) out("✓ " + name + ": verified");
    else if (response.status === 401) out("✗ " + name + ": token expired or revoked (401)");
    else if (response.status === 403) out("✗ " + name + ": forbidden (403)");
    else out("✗ " + name + ": " + response.status);
  } catch (error) {
    out("✗ " + name + ": " + ((error && error.message) || error));
  }
}

async function verifyAll(manager) {
  for (const account of manager.list()) await verify(manager, { id: account.id, email: account.email });
  out("Done.");
}

async function refreshToken(manager, view) {
  const name = view.email || view.id;
  try {
    out((await manager.refresh(view.id)) ? "✓ refreshed " + name : "✗ no OAuth config / refresh token for " + name);
  } catch (error) {
    out("✗ refresh failed for " + name + ": " + ((error && error.message) || error));
  }
}

export function createClaudeAccounts(manager) {
  return accountControllerFromManager(manager, {
    status: claudeStatus,
    login: async () => {
      const account = await login({ log: (message) => process.stderr.write(message + "\n") });
      return account ? { id: account.id, email: account.email, status: "active", enabled: true } : null;
    },
    actions: () => [{ label: "Verify all accounts", run: () => verifyAll(manager) }],
    accountActions: (view) => [
      { label: "Verify access", run: () => verify(manager, view) },
      { label: "Refresh token", run: () => refreshToken(manager, view) },
    ],
  });
}
