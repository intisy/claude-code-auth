// @ts-nocheck
// Claude Code OAuth (PKCE S256). authorizeClaude() builds the authorization URL;
// exchangeClaude() trades the pasted code for refresh/access tokens. The redirect
// is platform.claude.com/oauth/code/callback, which displays a `code#state`
// string the user pastes back (Claude Code's manual flow).

import { generatePKCE } from "@openauthjs/openauth/pkce";
import {
  CLAUDE_AUTHORIZE_URL,
  CLAUDE_CLIENT_ID,
  CLAUDE_REDIRECT_URI,
  CLAUDE_SCOPES,
  CLAUDE_TOKEN_URL,
} from "../constants.js";

// The PKCE verifier is packed into `state` so a bare pasted code (no state) can
// still recover it from this flow's own authorization result.
export function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(state) {
  const normalized = String(state).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  if (typeof parsed.verifier !== "string") throw new Error("Missing PKCE verifier in state");
  return { verifier: parsed.verifier };
}

export async function authorizeClaude() {
  const pkce = await generatePKCE();
  const url = new URL(CLAUDE_AUTHORIZE_URL);
  url.searchParams.set("code", "true");
  url.searchParams.set("client_id", CLAUDE_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", CLAUDE_REDIRECT_URI);
  url.searchParams.set("scope", CLAUDE_SCOPES.join(" "));
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", encodeState({ verifier: pkce.verifier }));
  return { url: url.toString(), verifier: pkce.verifier };
}

function calculateExpiry(startMs, expiresInSeconds) {
  const seconds = typeof expiresInSeconds === "number" && expiresInSeconds > 0 ? expiresInSeconds : 3600;
  return startMs + seconds * 1000;
}

export async function exchangeClaude(code, state) {
  try {
    const { verifier } = decodeState(state);
    const startTime = Date.now();
    const response = await fetch(CLAUDE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLAUDE_CLIENT_ID,
        code,
        redirect_uri: CLAUDE_REDIRECT_URI,
        code_verifier: verifier,
        state,
      }),
    });
    if (!response.ok) {
      return { type: "failed", error: await response.text().catch(() => String(response.status)) };
    }
    const payload = await response.json();
    if (!payload.refresh_token) return { type: "failed", error: "Missing refresh token in response" };
    const email =
      (payload.account && (payload.account.email_address || payload.account.email)) ||
      (payload.organization && payload.organization.name) ||
      undefined;
    return {
      type: "success",
      refresh: payload.refresh_token,
      access: payload.access_token,
      expires: calculateExpiry(startTime, payload.expires_in),
      email,
    };
  } catch (error) {
    return { type: "failed", error: error instanceof Error ? error.message : "Unknown error" };
  }
}
