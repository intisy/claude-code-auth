// @ts-nocheck
// The claude-code driver: a thin object on top of core-auth. core-auth owns
// account storage, selection, token refresh, and rate-limit/cooldown state; this
// driver owns only the Anthropic request rewrite (Bearer OAuth + Claude Code
// system block) and rotation across subscription accounts.

import { defineProvider, AccountManager, proxyManager } from "../../core-auth/dist/index.js";
import { prepareClaudeRequest, parseResetMs } from "../plugin/request.js";
import { models } from "./models.js";
import { oauthConfig } from "./config.js";
import { login, loginFlow } from "./login.js";
import { createClaudeAccounts } from "./accounts-controller.js";
import { getMaxAttempts, getSetting, setSetting } from "./settings.js";

const PROVIDER_ID = "claude-code";
const LANE = "messages"; // Claude subscription limits are account-wide

const manager = new AccountManager(PROVIDER_ID, {
  selection: "hybrid",
  oauth: oauthConfig(),
});

function isRateLimitStatus(status) {
  return status === 429 || status === 529;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handle(request, ctx) {
  const log = (ctx && ctx.log) || (() => {});

  const url = request.url;
  let bodyText;
  try { bodyText = await request.clone().text(); } catch { bodyText = undefined; }
  const init = { method: request.method, headers: Object.fromEntries(request.headers), body: bodyText };

  const maxAttempts = getMaxAttempts(); // read per-request so config edits apply without a restart
  let lastResponse = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const acquired = await manager.acquire(LANE);
    if (!acquired || !acquired.account) return errorResponse(503, "No available Claude account. Run `claude-code-auth login`.");
    const account = acquired.account;
    const access = acquired.access;
    if (!access) { manager.reportError(account.id, attempt, "missing access token"); continue; }

    const proxyUrl = proxyManager.selectForAccount(account.id);

    let prepared;
    try { prepared = prepareClaudeRequest(url, init, access); }
    catch (error) { log("prepare failed: " + error); manager.reportError(account.id, attempt, String(error)); continue; }
    if (proxyUrl) prepared.init.proxy = proxyUrl; // Bun fetch honors .proxy

    let response;
    const started = Date.now();
    let proxyOk = false;
    try { response = await fetch(prepared.request, prepared.init); proxyOk = !!proxyUrl; }
    catch (error) {
      if (proxyUrl) {
        proxyManager.reportResult(proxyUrl, false);
        // proxy unreachable -> retry directly (a dead proxy gives no isolation anyway)
        log("fetch via proxy " + proxyUrl + " failed: " + error + " — retrying directly");
        try {
          const directInit = { ...prepared.init };
          delete directInit.proxy;
          response = await fetch(prepared.request, directInit);
        } catch (directError) {
          log("direct retry failed: " + directError);
          manager.reportError(account.id, attempt, String(directError));
          continue;
        }
      } else {
        log("fetch failed: " + error);
        manager.reportError(account.id, attempt, String(error));
        continue;
      }
    }
    if (proxyOk) proxyManager.reportResult(proxyUrl, true, Date.now() - started);

    if (isRateLimitStatus(response.status)) {
      lastResponse = response;
      manager.reportRateLimit(account.id, LANE, parseResetMs(response, attempt));
      if (proxyUrl) proxyManager.reportRateLimit(proxyUrl);
      continue; // rotate account
    }

    if (response.status === 401) {
      lastResponse = response;
      manager.reportError(account.id, attempt, "401 unauthorized");
      continue; // token may be revoked; try another account
    }

    if (response.ok) {
      manager.reportSuccess(account.id);
      return response; // already Anthropic format (incl. SSE) — pass through
    }

    return response; // non-retryable upstream error -> surface as-is
  }

  return lastResponse || errorResponse(502, "Claude request failed after " + maxAttempts + " attempts");
}

export const driver = {
  id: PROVIDER_ID,
  label: "Claude Code",
  opencodeProvider: "claude-code", // own namespace so OpenCode routes through our loader
  opencodeNpm: "@ai-sdk/anthropic",
  models,
  handle,
  login,
  loginFlow,
  accounts: createClaudeAccounts(manager),
  proxies: true,
  settings: {
    groups: [
      {
        title: "Account rotation",
        fields: [
          {
            key: "max_account_attempts",
            label: "Max account attempts",
            type: "number",
            min: 1,
            max: 20,
            hint: "How many accounts to try before giving up on a request.",
          },
        ],
      },
    ],
    get: (key) => (key === "max_account_attempts" ? getMaxAttempts() : getSetting(key, undefined)),
    set: (key, value) => setSetting(key, value),
  },
};

export const ClaudeCodeProvider = defineProvider(driver).opencode;
